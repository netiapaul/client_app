import { useState, useEffect, useCallback, useRef } from 'react'

/**
 * Drives a step-by-step payment attempt.
 *
 * All of the logic, none of the markup. The admin screen and the client portal have different
 * design systems — bootstrap utility classes against the portal's `pt-*` namespace — and a single
 * component serving both would need a class-name mapping layer bigger than the markup it saves.
 * The part worth sharing is the state machine: which method, which mode, what the form collected,
 * when to poll, when to stop, and how to not leave a timer running on an unmounted screen.
 *
 * The flow it drives:
 *
 *   pick a method/mode  ->  fill the form the SERVER described  ->  Start
 *     ->  poll Status every `pollMs` while the provider and the payer do their bit
 *     ->  a terminal state: paid, pending clearance, declined, cancelled, timed out
 *
 * Nothing about any specific method lives here. The fields, the modes, the failure outcomes and
 * the waiting messages all come from the catalogue endpoint, so a new payment method is a backend
 * file and this keeps working.
 *
 * @param get   (path) => Promise<data>    scoped to the caller's API base
 * @param post  (path, body) => Promise<data>
 * @param base  the checkout route prefix — 'Checkout' for admin, 'Portal/Payments/Checkout'
 */
/**
 * An id for one intention to pay. Only has to be unique per account — the server namespaces it by
 * the signed-in user — so randomUUID is ample, and the fallback is only for an old browser or a
 * page served over plain HTTP, where crypto.randomUUID is absent.
 */
const newKey = () =>
  window.crypto?.randomUUID?.() ??
  `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/**
 * Seed a mode's form from whatever the server supplied.
 *
 * Two sources, and `defaultValue` wins: it is a fact about the person paying — the portal filling
 * in the signed-in customer's own phone number — while `simulatedValue` is a fixture chosen to
 * rehearse a flow. Taking the fixture over the fact would push a real M-PESA prompt at 0712345678.
 *
 * Both are defaults and stay editable, so validation still gets exercised by anyone who changes
 * them — which, for the phone number, is the common case of an accountant paying on someone
 * else's behalf.
 *
 * Outside the hook because it is pure, and because a function defined inside would be a new
 * identity every render and therefore a dependency every callback had to declare.
 */
const prefill = (m) => {
  const seed = {}
  for (const f of m?.fields ?? []) {
    const value = f.defaultValue || f.simulatedValue
    if (value) seed[f.key] = value
  }
  return seed
}

const usePaymentCheckout = ({ get, post, readError }) => {
  const [catalogue, setCatalogue] = useState(null)
  const [loading, setLoading] = useState(true)

  const [mode, setMode] = useState(null) // the chosen FlowModeOption
  const [details, setDetails] = useState({})
  const [outcome, setOutcome] = useState('Success')
  const [amount, setAmount] = useState('')

  const [state, setState] = useState(null) // the live CheckoutState
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Polling must stop when the screen goes away. Without this the timer keeps firing against an
  // unmounted component — and because Status is the call that BANKS the payment, a stray poll is
  // not merely a wasted request.
  const timer = useRef(null)
  const alive = useRef(true)

  // Refs, not state, because both are read in the same tick they are written — see `start`.
  const inFlight = useRef(false)
  const idemKey = useRef(null)

  /**
   * `readError` behind a ref, so this hook's work never depends on its IDENTITY.
   *
   * It is only a formatter — it turns an exception into a sentence — and callers naturally write
   * it inline:
   *
   *   const readErr = (e) => e?.response?.data?.message ?? 'Something went wrong.'
   *
   * which is a new function on every render. With it in the dependency array of `loadCatalogue`,
   * and `loadCatalogue` in the dependency array of the effect that calls it, that produced an
   * infinite loop: render -> new formatter -> new callback -> effect fires -> setState -> render.
   * The screen never settled and the catalogue endpoint was called continuously. It cost the
   * admin payments screen exactly that, while the portal happened to escape it only because its
   * own handler was wrapped in useCallback.
   *
   * A hook used by two apps must not be a trap that springs on the one that wrote the obvious
   * thing. Updated on every render so the latest closure is always used, and read through
   * `fail()` rather than captured — which is what keeps every callback below stable.
   */
  const readErrorRef = useRef(readError)
  readErrorRef.current = readError

  const fail = useCallback((e) => {
    const format = readErrorRef.current
    if (format) return format(e)

    // No formatter supplied. Still has to say something — an empty error banner is worse than a
    // vague one, because it reads as the screen having failed to load rather than the request.
    return e?.message || 'Something went wrong.'
  }, [])

  useEffect(() => {
    alive.current = true
    return () => {
      alive.current = false
      if (timer.current) clearTimeout(timer.current)
    }
  }, [])

  const loadCatalogue = useCallback(async () => {
    setLoading(true)
    try {
      const data = await get('Methods')
      setCatalogue(data ?? null)

      // Preselect the first method that is actually usable, so the common case is one click.
      const first = (data?.modes ?? []).find((m) => !m.notReadyReason)
      if (first) {
        setMode(first)
        setDetails(prefill(first))
      }
      setError('')
    } catch (e) {
      setError(fail(e))
    } finally {
      setLoading(false)
    }
  }, [get, fail])

  useEffect(() => {
    loadCatalogue()
  }, [loadCatalogue])

  const chooseMode = useCallback((m) => {
    setMode(m)
    setDetails(prefill(m))
    // The outcomes are per-mode, so a carried-over choice may not exist on the new one.
    setOutcome((m?.outcomes ?? []).find((o) => o.isSuccess)?.outcome ?? 'Success')

    // Paying a different way is a different intention, whatever was keyed before it.
    idemKey.current = null

    setState(null)
    setError('')
  }, [])

  const setField = useCallback((key, value) => {
    setDetails((d) => ({ ...d, [key]: value }))
  }, [])

  /** Poll until the server says to stop. `pollMs` of 0 is the server saying it is over. */
  const schedule = useCallback(
    (s) => {
      if (timer.current) clearTimeout(timer.current)
      if (!s || s.isFinished || !s.pollMs) return

      timer.current = setTimeout(async () => {
        if (!alive.current) return
        try {
          const next = await get(encodeURIComponent(s.sessionRef))
          if (!alive.current) return
          setState(next)
          schedule(next)
        } catch (e) {
          if (!alive.current) return
          // A failed poll is not a failed payment — the attempt may still be in flight on the
          // provider's side, so the error is shown without declaring an outcome.
          setError(fail(e))
        }
      }, s.pollMs)
    },
    [get, fail],
  )

  /**
   * Begin the attempt. `extra` is merged into the payload — which company is paying, in practice.
   * The hook deliberately does not own that: the admin screen picks a client from a list while the
   * portal is told one by the server from the signed-in account, and neither should be the other's
   * business.
   *
   * Two things stop one intention becoming two payments:
   *
   *  - `inFlight`, a ref rather than the `busy` state. `setBusy(true)` does not take effect until
   *    React re-renders, so two clicks in the same tick both get past a disabled attribute driven
   *    by state. A ref is written synchronously and the second click sees it.
   *
   *  - `idemKey`, sent to the server. That is the one that matters, because the duplicate we
   *    cannot afford is not two clicks — it is a retry after a request we never saw the answer to.
   *    The attempt may well have succeeded and put an M-PESA prompt on the customer's phone; a
   *    second one beside it is a customer who pays twice, and two pushes come back with two
   *    different Safaricom receipts so nothing downstream can tell them apart.
   *
   * The key is therefore KEPT across a failure and reused: a failed start wrote no session, so
   * nothing claims it, and a start that failed only from our side needs exactly this to be safe to
   * repeat. It is minted afresh in `reset`, when the user deliberately begins a new attempt.
   */
  const start = useCallback(
    async (extra) => {
      if (!mode) return
      if (inFlight.current) return

      inFlight.current = true
      if (!idemKey.current) idemKey.current = newKey()

      setBusy(true)
      setError('')
      setState(null)

      try {
        const parsed = amount.trim() === '' ? null : Number(amount)

        const s = await post('Start', {
          ...(extra ?? {}),
          method: mode.method,
          mode: mode.mode,
          amount: parsed,
          details,
          outcome,
          idempotencyKey: idemKey.current,
        })

        if (!alive.current) return
        setState(s)
        schedule(s)
      } catch (e) {
        if (alive.current) setError(fail(e))
      } finally {
        inFlight.current = false
        if (alive.current) setBusy(false)
      }
    },
    [mode, amount, details, outcome, post, schedule, fail],
  )

  const cancel = useCallback(async () => {
    if (!state?.sessionRef) return
    if (timer.current) clearTimeout(timer.current)

    try {
      const s = await post(`${encodeURIComponent(state.sessionRef)}/Cancel`)
      if (alive.current) setState(s)
    } catch (e) {
      if (alive.current) setError(fail(e))
    }
  }, [state, post, fail])

  /** Back to the form, keeping the method so a second attempt is quick. */
  const reset = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)

    // A NEW intention, so a new key. Keeping the old one would make the next Pay return the
    // attempt that just failed — which is the correct answer to a retry and the wrong answer to
    // somebody trying again.
    idemKey.current = null

    setState(null)
    setError('')
    setAmount('')
    if (mode) setDetails(prefill(mode))
  }, [mode])

  // A required field left blank is caught here so the button can be disabled, rather than the
  // server refusing a submit the screen could have seen coming. The server still validates —
  // this is courtesy, not the control.
  const missing = (mode?.fields ?? [])
    .filter((f) => f.required !== false && !String(details[f.key] ?? '').trim())
    .map((f) => f.label)

  const amountInvalid =
    amount.trim() !== '' && (!Number.isFinite(Number(amount)) || Number(amount) <= 0)

  return {
    catalogue,
    loading,
    enabled: !!catalogue?.simulated,
    blockedReason: catalogue?.blockedReason,
    extendsExpiry: !!catalogue?.extendsExpiry,
    modes: catalogue?.modes ?? [],

    mode,
    chooseMode,
    details,
    setField,
    outcome,
    setOutcome,
    amount,
    setAmount,

    state,
    busy,
    error,
    setError,

    missing,
    amountInvalid,
    canStart: !!mode && !busy && missing.length === 0 && !amountInvalid && !state,

    start,
    cancel,
    reset,
    reload: loadCatalogue,
  }
}

export default usePaymentCheckout
