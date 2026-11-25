import { useState, useEffect, useCallback, useRef } from 'react'
import { parseAmount } from '../utils/money'

/** Drives a step-by-step payment attempt. */
/** An id for one intention to pay. */
const newKey = () =>
  window.crypto?.randomUUID?.() ??
  `k-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`

/** Seed a mode's form from whatever the server supplied. */
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

  // Polling must stop when the screen goes away.
  const timer = useRef(null)
  const alive = useRef(true)

  // Refs, not state, because both are read in the same tick they are written — see `start`.
  const inFlight = useRef(false)
  const idemKey = useRef(null)

  /** `readError` behind a ref, so this hook's work never depends on its IDENTITY. */
  const readErrorRef = useRef(readError)
  readErrorRef.current = readError

  const fail = useCallback((e) => {
    const format = readErrorRef.current
    if (format) return format(e)

    // No formatter supplied.
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
          // A failed poll is not a failed payment.
          setError(fail(e))
        }
      }, s.pollMs)
    },
    [get, fail],
  )

  /** Begin the attempt. `extra` is merged into the payload — which company is paying. */
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
        // null means "the oldest invoice in full", which is what an empty box asks for.
        const parsed = parseAmount(amount)

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

    // A NEW intention, so a new key.
    idemKey.current = null

    setState(null)
    setError('')
    setAmount('')
    if (mode) setDetails(prefill(mode))
  }, [mode])

  // A required field left blank is caught here so the button can be disabled.
  const missing = (mode?.fields ?? [])
    .filter((f) => f.required !== false && !String(details[f.key] ?? '').trim())
    .map((f) => f.label)

  // Blank is VALID and means "settle their oldest invoice exactly".
  const amountInvalid = amount.trim() !== '' && !(parseAmount(amount) > 0)

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
