import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import {
  portalGet,
  portalPost,
  readErr,
  fmtDate,
  PortalSessionEnded,
  initialsOf,
  tintOf,
} from '../../utils/portalApi'
import { formatMoney as money } from '../../utils/money'
import usePaymentCheckout from '../../hooks/usePaymentCheckout'
import PortalNotActive from './portalNotActive'

/**
 * Paying, from the customer's side — the whole process, step by step.
 *
 * The same checkout the admin screen drives, through the same `usePaymentCheckout` hook and the
 * same server-described forms, rendered in the portal's own idiom rather than shared as a
 * component: the two apps have different design systems and bridging them would cost more than it
 * saved.
 *
 * What a customer actually sees depends on what they pick, because the server says so:
 *  - M-PESA, push    — a phone number, then "check your phone" for as long as it really takes
 *  - M-PESA, receipt — they already paid the paybill; the receipt number gets looked up
 *  - Card            — card details, then the issuer's 3-D Secure challenge
 *  - Bank transfer   — the bank, the statement reference, the value date
 *
 * Cheque and cash are deliberately absent: the server does not offer them to a customer. A cheque
 * is handed over in person, and a customer recording that they paid cash is a claim, not a payment.
 *
 * Nothing here decides whether paying works. The catalogue endpoint does, from server
 * configuration — a customer-facing checkout that a client could switch on would be a way to
 * settle invoices for free.
 */
const PortalPay = () => {
  const navigate = useNavigate()

  // ?cus= is where the invoices page sends someone who pressed Pay on a particular company's
  // invoice. A REQUEST, not authority: it only ever selects among the companies the server already
  // returned for this user, so a hand-typed code for somebody else's company selects nothing.
  const [params] = useSearchParams()
  const wantedCus = params.get('cus')
  const wantedAll = params.get('all') === '1'

  const [companies, setCompanies] = useState([])
  const [cusCode, setCusCode] = useState('')

  // Settle every company at once. Sent to the server as a FLAG, not as a list of companies — the
  // server resolves it from the signed-in account's own scope, so nothing the browser says can
  // reach a company this customer does not own.
  const [payAll, setPayAll] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // A 401 anywhere means the session is over; the hook reports errors through this, so the
  // redirect is handled once rather than at every call site.
  const onError = useCallback(
    (e) => {
      if (e instanceof PortalSessionEnded) {
        navigate('/', { replace: true })
        return e.message
      }
      return readErr(e)
    },
    [navigate],
  )

  const checkoutGet = useCallback((path) => portalGet(`/Portal/Payments/Checkout/${path}`), [])

  const checkoutPost = useCallback(
    (path, body) => portalPost(`/Portal/Payments/Checkout/${path}`, body),
    [],
  )

  const flow = usePaymentCheckout({
    get: checkoutGet,
    post: checkoutPost,
    readError: onError,
  })

  const loadDue = useCallback(async () => {
    setLoading(true)
    try {
      const list = (await portalGet('/Portal/Payments/Due')) ?? []
      setCompanies(list)

      // A payment may have settled every other company, leaving one. "All companies" would then
      // be a choice between a thing and the same thing, and the option disappears — so the state
      // behind it has to go too, or the hidden radio stays selected and the button reads "Pay all
      // 1" against a single company.
      if (list.length <= 1) setPayAll(false)
      else if (wantedAll) setPayAll(true)

      // Keep an existing choice across the reload that follows a payment — unless it has gone,
      // which is what happens when that payment settled the company's last invoice. Only on the
      // first load does ?cus= get a say; after a payment the URL is stale and the rules above win.
      setCusCode((c) => {
        if (c && list.some((x) => x.cusCode === c)) return c

        const asked =
          wantedCus && list.find((x) => x.cusCode?.toLowerCase() === wantedCus.toLowerCase())

        return asked?.cusCode ?? list[0]?.cusCode ?? ''
      })
      setError('')
    } catch (e) {
      setError(onError(e))
    } finally {
      setLoading(false)
    }
  }, [onError, wantedCus, wantedAll])

  useEffect(() => {
    loadDue()
  }, [loadDue])

  const chosen = useMemo(
    () => companies.find((c) => c.cusCode === cusCode) ?? null,
    [companies, cusCode],
  )

  const totalOutstanding = companies.reduce((s, c) => s + (c.outstanding ?? 0), 0)
  const totalInvoices = companies.reduce((s, c) => s + (c.invoices?.length ?? 0), 0)
  const currency = companies[0]?.currency ?? 'KES'

  // Renew the licence and leave the add-ons.
  //
  // Add-ons are billed on their own invoice precisely so this is possible: a customer who has
  // finished with one should not have to buy it again to keep their licence running. Choosing it
  // CANCELS NOTHING — the add-on invoice simply stays outstanding, the grant lapses on its own
  // date, and paying it later still renews it.
  const [licenceOnly, setLicenceOnly] = useState(false)

  const addOnDue = payAll
    ? companies.reduce((s, c) => s + (c.addOnOutstanding ?? 0), 0)
    : chosen?.addOnOutstanding ?? 0

  const licenceDue = payAll
    ? companies.reduce((s, c) => s + (c.licenceOutstanding ?? 0), 0)
    : chosen?.licenceOutstanding ?? 0

  // Only worth asking when there is actually an add-on charge to decline.
  const canSplit = addOnDue > 0

  // The choice is meaningless once there is nothing to decline, and leaving it latched would
  // quietly underpay the next company the customer selects.
  useEffect(() => {
    if (!canSplit && licenceOnly) setLicenceOnly(false)
  }, [canSplit, licenceOnly])

  // What the Pay button is about to collect, and what the amount box defaults to. One figure
  // whichever mode they are in, so the two cannot disagree.
  const fullDue = payAll ? totalOutstanding : chosen?.outstanding ?? 0
  const due = licenceOnly ? licenceDue : fullDue

  const { state, mode, modes } = flow
  const running = state && !state.isFinished

  // Whether anything here can take real money. Used for the page-level banner; the per-method
  // notice uses mode.isLive, because one page can legitimately have a live M-PESA and a
  // still-simulated card.
  const anyLive = modes.some((m) => m.isLive)

  // Once an attempt settles, the amounts on this page are stale — that invoice may be paid off.
  const [settledRef, setSettledRef] = useState(null)

  useEffect(() => {
    if (!state?.isFinished || !state.isSuccess) return
    if (settledRef === state.sessionRef) return

    setSettledRef(state.sessionRef)
    loadDue()
  }, [state, settledRef, loadDue])

  const label = (fieldType) =>
    fieldType === 'date' ? 'date' : fieldType === 'tel' ? 'tel' : 'text'

  /** The portal styles its inputs inline rather than through a class. */
  const box = (invalid) => ({
    width: '100%',
    height: 46,
    padding: '0 14px',
    font: 'inherit',
    fontSize: 'var(--pt-fs-body)',
    color: 'var(--pt-ink)',
    background: 'var(--pt-surface)',
    border: `1px solid ${invalid ? 'var(--pt-red)' : 'var(--pt-border)'}`,
    borderRadius: 12,
    outline: 'none',
  })

  const fieldLabel = {
    display: 'block',
    fontSize: 'var(--pt-fs-xs)',
    fontWeight: 600,
    color: 'var(--pt-muted)',
    marginBottom: 6,
  }

  const hint = { fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)', marginTop: 4 }

  return (
    <>
      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">Billing</span>
          <h1>Make a payment</h1>
        </div>
      </div>

      {/* The banner tracks the CHOSEN method, not the page: with M-PESA live and card still
          simulated, one page genuinely has both, and a single blanket notice would be wrong for
          whichever one you picked. */}
      {anyLive && (
        <div className="pt-note pt-note--green">
          <span className="pt-note__icon">
            <span className="material-icons">verified</span>
          </span>
          <span>
            <strong>M-PESA is live</strong>
            <span>
              Choosing &ldquo;Send a prompt to the phone&rdquo; sends a real M-PESA request and
              takes real money. The other methods on this page are still rehearsals.
            </span>
          </span>
        </div>
      )}

      {flow.enabled && !mode?.isLive ? (
        <div className="pt-note pt-note--amber">
          <span className="pt-note__icon">
            <span className="material-icons">science</span>
          </span>
          <span>
            <strong>Test mode</strong>
            <span>
              {mode
                ? `${mode.label} is not connected to a provider yet, so nothing is charged and no money moves. `
                : 'No payment provider is connected for this method yet. '}
              The steps are the real ones and a payment made here goes through the real billing
              ledger, so your invoices will show as paid.{' '}
              {flow.extendsExpiry
                ? 'Licence expiry dates WILL move forward.'
                : 'Licence expiry dates are left alone.'}
            </span>
          </span>
        </div>
      ) : flow.enabled || anyLive ? null : (
        <PortalNotActive>
          You will be able to pay for a company and have your licence expiry move forward
          automatically once a month is paid in full.
        </PortalNotActive>
      )}

      {error && <div className="pt-note pt-note--amber">{error}</div>}

      {/* ---- 1. what are they paying for ---- */}
      <section className="pt-card">
        <h2 className="pt-card__title">1 · Choose what to pay for</h2>

        {loading ? (
          <div className="pt-empty">Loading…</div>
        ) : companies.length === 0 ? (
          <div className="pt-empty">
            <span className="material-icons">check_circle</span>
            Nothing outstanding. Every invoice on your account is settled.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 14 }}>
            {/*
              Pay the lot in one go. Only offered to somebody who actually owns more than one
              company with something outstanding — on a single-company account it would be a
              choice between a thing and the same thing.

              One payment, not several: one M-PESA prompt and one PIN. The server allocates it
              oldest-month-first across every company, so a short payment clears the most overdue
              month wherever it is rather than working through the list.
            */}
            {companies.length > 1 && (
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: payAll ? 'var(--pt-accent-soft, var(--pt-soft))' : 'var(--pt-soft)',
                  border: `1px solid ${payAll ? 'var(--pt-accent)' : 'var(--pt-border)'}`,
                  borderRadius: 14,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1,
                }}
              >
                <input
                  type="radio"
                  name="pt-pay-company"
                  checked={payAll}
                  disabled={!!state}
                  onChange={() => setPayAll(true)}
                  style={{ width: 17, height: 17, accentColor: 'var(--pt-accent)' }}
                />
                <span className="pt-initials" aria-hidden="true">
                  <span className="material-icons" style={{ fontSize: 19 }}>
                    done_all
                  </span>
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="pt-company__name">All {companies.length} companies</span>
                  <span className="pt-company__code">
                    One payment, one prompt — each licence extends on its own date
                  </span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 'var(--pt-fs-h3)', fontWeight: 800 }}>
                    {money(totalOutstanding, currency)}
                  </span>
                  <span style={{ fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)' }}>
                    {totalInvoices} invoice{totalInvoices === 1 ? '' : 's'} in total
                  </span>
                </span>
              </label>
            )}

            {companies.map((c) => (
              <label
                key={c.cusCode}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  background: 'var(--pt-soft)',
                  border: `1px solid ${
                    !payAll && c.cusCode === cusCode ? 'var(--pt-accent)' : 'var(--pt-border)'
                  }`,
                  borderRadius: 14,
                  cursor: running ? 'not-allowed' : 'pointer',
                  opacity: running ? 0.6 : 1,
                }}
              >
                <input
                  type="radio"
                  name="pt-pay-company"
                  checked={!payAll && c.cusCode === cusCode}
                  disabled={!!state}
                  onChange={() => {
                    setPayAll(false)
                    setCusCode(c.cusCode)
                  }}
                  style={{ width: 17, height: 17, accentColor: 'var(--pt-accent)' }}
                />
                <span className={`pt-initials ${tintOf(c.cusCode)}`}>
                  {initialsOf(c.companyName)}
                </span>
                <span style={{ minWidth: 0, flex: 1 }}>
                  <span className="pt-company__name">{c.companyName}</span>
                  <span className="pt-company__code">{c.cusCode}</span>
                </span>
                <span style={{ textAlign: 'right' }}>
                  <span style={{ display: 'block', fontSize: 'var(--pt-fs-h3)', fontWeight: 800 }}>
                    {money(c.outstanding, c.currency)}
                  </span>
                  <span style={{ fontSize: 'var(--pt-fs-xs)', color: 'var(--pt-muted)' }}>
                    {c.invoices.length} invoice{c.invoices.length === 1 ? '' : 's'} · oldest due{' '}
                    {fmtDate(c.invoices[0]?.dueDate)}
                  </span>
                </span>
              </label>
            ))}
          </div>
        )}

        {/* ---- renew the licence, or renew everything ----

            Only shown when there is an add-on charge to decline. Most customers want their
            add-ons and should not be asked a question with one sensible answer; the ones who have
            finished with one need this, because the alternative is buying it again to keep their
            licence running. Declining writes nothing off — the add-on invoice stays on the
            account and paying it later renews the feature. */}
        {canSplit && !state && (
          <div style={{ marginTop: 16 }}>
            <span style={{ ...fieldLabel, marginBottom: 8 }}>What would you like to pay for?</span>

            <div style={{ display: 'grid', gap: 8 }}>
              {[
                {
                  only: false,
                  title: 'Everything outstanding',
                  amount: fullDue,
                  note: `Includes ${money(
                    addOnDue,
                    currency,
                  )} for your add-ons, which keeps them running.`,
                },
                {
                  only: true,
                  title: 'Licence only',
                  amount: licenceDue,
                  note: `Leaves ${money(
                    addOnDue,
                    currency,
                  )} of add-ons unpaid. They stay on your account — pay them any time to keep them, or let them lapse.`,
                },
              ].map((opt) => (
                <label
                  key={String(opt.only)}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 12,
                    padding: '12px 14px',
                    background: 'var(--pt-soft)',
                    border: `1px solid ${
                      licenceOnly === opt.only ? 'var(--pt-accent)' : 'var(--pt-border)'
                    }`,
                    borderRadius: 14,
                    cursor: running ? 'not-allowed' : 'pointer',
                    opacity: running ? 0.6 : 1,
                  }}
                >
                  <input
                    type="radio"
                    name="pt-pay-scope"
                    checked={licenceOnly === opt.only}
                    disabled={!!state}
                    onChange={() => setLicenceOnly(opt.only)}
                    style={{
                      width: 17,
                      height: 17,
                      marginTop: 3,
                      accentColor: 'var(--pt-accent)',
                    }}
                  />
                  <span style={{ minWidth: 0, flex: 1 }}>
                    <span style={{ display: 'block', fontWeight: 700 }}>{opt.title}</span>
                    <span
                      style={{
                        display: 'block',
                        fontSize: 'var(--pt-fs-xs)',
                        color: 'var(--pt-muted)',
                      }}
                    >
                      {opt.note}
                    </span>
                  </span>
                  <span style={{ fontSize: 'var(--pt-fs-h3)', fontWeight: 800 }}>
                    {money(opt.amount, currency)}
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ---- 2. how ---- */}
      <section className="pt-card">
        <h2 className="pt-card__title">2 · Choose how to pay</h2>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
            gap: 12,
            marginTop: 14,
          }}
        >
          {modes.map((m) => {
            const on = mode?.method === m.method && mode?.mode === m.mode
            const blocked = !!m.notReadyReason || !!state

            return (
              <button
                key={`${m.method}-${m.mode}`}
                type="button"
                className={`pt-tile pt-tile--pick ${on ? 'is-on' : ''}`}
                disabled={blocked}
                onClick={() => flow.chooseMode(m)}
                title={m.notReadyReason ?? undefined}
              >
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    fontSize: 'var(--pt-fs-body)',
                    fontWeight: 700,
                  }}
                >
                  <span className="material-icons" style={{ fontSize: 19 }}>
                    {m.icon}
                  </span>
                  {m.label}
                </span>
                <span className="pt-tile__note" style={{ fontWeight: 400 }}>
                  {m.notReadyReason ?? m.description}
                </span>
              </button>
            )
          })}

          {modes.length === 0 && !flow.loading && (
            <div className="pt-empty" style={{ gridColumn: '1 / -1' }}>
              <span className="material-icons">lock</span>
              {flow.blockedReason ?? 'No payment methods are available yet.'}
            </div>
          )}
        </div>
      </section>

      {/* ---- 3. the method's own form ---- */}
      {mode && !state && (
        <section className="pt-card">
          <h2 className="pt-card__title">3 · {mode.label}</h2>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))',
              gap: 14,
              marginTop: 14,
            }}
          >
            {(mode.fields ?? []).map((f) => (
              <label key={f.key} htmlFor={`pt-f-${f.key}`}>
                <span style={fieldLabel}>
                  {f.label}
                  {f.required === false && ' (optional)'}
                </span>

                {f.type === 'select' ? (
                  <select
                    id={`pt-f-${f.key}`}
                    style={box(false)}
                    value={flow.details[f.key] ?? ''}
                    onChange={(e) => flow.setField(f.key, e.target.value)}
                  >
                    <option value="">Choose…</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o} value={o}>
                        {o}
                      </option>
                    ))}
                  </select>
                ) : f.type === 'textarea' ? (
                  <textarea
                    id={`pt-f-${f.key}`}
                    rows={3}
                    maxLength={f.maxLength ?? undefined}
                    placeholder={f.placeholder ?? ''}
                    style={{ ...box(false), height: 'auto', padding: '10px 14px' }}
                    value={flow.details[f.key] ?? ''}
                    onChange={(e) => flow.setField(f.key, e.target.value)}
                  />
                ) : (
                  <input
                    id={`pt-f-${f.key}`}
                    type={label(f.type)}
                    maxLength={f.maxLength ?? undefined}
                    placeholder={f.placeholder ?? ''}
                    style={box(false)}
                    value={flow.details[f.key] ?? ''}
                    onChange={(e) => flow.setField(f.key, e.target.value)}
                  />
                )}

                {f.help && <span style={hint}>{f.help}</span>}
              </label>
            ))}

            <label htmlFor="pt-f-amount">
              <span style={fieldLabel}>Amount</span>
              <input
                id="pt-f-amount"
                type="number"
                min="0"
                step="0.01"
                placeholder={due > 0 ? String(due) : '0.00'}
                style={box(flow.amountInvalid)}
                value={flow.amount}
                onChange={(e) => flow.setAmount(e.target.value)}
              />
              <span style={hint}>
                {flow.amountInvalid
                  ? 'Enter an amount greater than zero, or leave it blank.'
                  : payAll
                  ? 'Leave blank to pay everything outstanding across all your companies. ' +
                    'A smaller amount clears your oldest months first.'
                  : 'Leave blank to settle your oldest invoice in full.'}
              </span>
            </label>

            {/* Rehearsal only. A customer never chooses how their own payment fails — when the
                gateway is live the outcome is theirs to decide on their handset, so the picker
                disappears entirely rather than sitting there inert. */}
            {flow.enabled && !mode.isLive && (mode.outcomes ?? []).length > 1 && (
              <label htmlFor="pt-f-outcome">
                <span style={fieldLabel}>Test outcome</span>
                <select
                  id="pt-f-outcome"
                  style={box(false)}
                  value={flow.outcome}
                  onChange={(e) => flow.setOutcome(e.target.value)}
                >
                  {mode.outcomes.map((o) => (
                    <option key={o.outcome} value={o.outcome}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span style={hint}>
                  {mode.outcomes.find((o) => o.outcome === flow.outcome)?.description}
                </span>
              </label>
            )}
          </div>

          {flow.missing.length > 0 && (
            <p style={{ ...hint, marginTop: 12 }}>Still needed: {flow.missing.join(', ')}.</p>
          )}
        </section>
      )}

      {/* ---- 4. the attempt, live ---- */}
      {state && (
        <section
          className={`pt-note ${
            running
              ? ''
              : state.awaitingClearance
              ? 'pt-note--amber'
              : state.isSuccess
              ? 'pt-note--green'
              : 'pt-note--amber'
          }`}
        >
          <span className="pt-note__icon">
            <span className="material-icons">
              {running
                ? 'hourglass_top'
                : state.awaitingClearance
                ? 'schedule'
                : state.isSuccess
                ? 'check_circle'
                : 'error_outline'}
            </span>
          </span>
          <span>
            <strong>{state.title}</strong>
            <span>
              {state.message}
              {state.expiresInSeconds != null && running
                ? ` Expires in ${state.expiresInSeconds} seconds.`
                : ''}
            </span>
            <span style={{ ...hint, marginTop: 6 }}>
              Reference {state.sessionRef}
              {state.providerReference ? ` · ${state.providerReference}` : ''}
            </span>
          </span>
        </section>
      )}

      {flow.error && <div className="pt-note pt-note--amber">{flow.error}</div>}

      {/* ---- the action ---- */}
      <section className="pt-card pt-card--dark pt-hero">
        <span aria-hidden="true" className="pt-hero__ring pt-hero__ring--a" />
        <span className="pt-hero__label">
          {licenceOnly
            ? payAll
              ? `Licence renewals across ${companies.length} companies`
              : `Licence renewal for ${chosen?.companyName ?? 'your company'}`
            : payAll
            ? `Outstanding across ${companies.length} companies`
            : chosen
            ? `Outstanding for ${chosen.companyName}`
            : 'Total outstanding'}
        </span>
        <span className="pt-hero__value">{money(due || totalOutstanding, currency)}</span>
        {licenceOnly && (
          <span className="pt-hero__label">{money(addOnDue, currency)} of add-ons left unpaid</span>
        )}

        <div className="pt-hero__actions">
          {!state && (
            <button
              type="button"
              className="pt-btn pt-btn--accent"
              // A live method is payable even with simulation switched off — that is the whole
              // point of switching the gateway on.
              disabled={!flow.canStart || !cusCode || (!flow.enabled && !mode?.isLive)}
              title={
                !flow.enabled && !mode?.isLive
                  ? flow.blockedReason ?? 'Paying from the portal is being built'
                  : !cusCode
                  ? 'Choose what to pay for'
                  : flow.missing.length
                  ? `Still needed: ${flow.missing.join(', ')}`
                  : undefined
              }
              // cusCode travels even when paying for everything: a payment still has to say who
              // paid it, and it is the company the receipt is addressed to. payAll is what widens
              // which invoices the money may settle, and the server resolves that from the scope.
              onClick={() => flow.start({ cusCode, payAll, licenceOnly })}
            >
              {flow.busy
                ? 'Starting…'
                : payAll
                ? `Pay all ${companies.length}${mode?.isLive || !flow.enabled ? '' : ' (test)'}`
                : mode?.isLive
                ? 'Pay now'
                : flow.enabled
                ? 'Pay now (test)'
                : 'Pay now'}
              <span className="material-icons">
                {mode?.isLive || flow.enabled ? 'arrow_forward' : 'lock'}
              </span>
            </button>
          )}

          {running && state.canCancel && (
            <button type="button" className="pt-btn pt-btn--ghost-dark" onClick={flow.cancel}>
              Cancel
              <span className="material-icons">close</span>
            </button>
          )}

          {state?.isFinished && (
            <button type="button" className="pt-btn pt-btn--accent" onClick={flow.reset}>
              {state.isSuccess ? 'Make another payment' : 'Try again'}
              <span className="material-icons">refresh</span>
            </button>
          )}

          <button
            type="button"
            className="pt-btn pt-btn--ghost-dark"
            onClick={() => navigate('/portal')}
          >
            Back to dashboard
          </button>
        </div>
      </section>
    </>
  )
}

export default PortalPay
