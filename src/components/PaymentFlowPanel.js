import React, { useEffect, useRef, useState } from 'react'
import PropTypes from 'prop-types'
import { formatMoney as money, parseAmount } from '../utils/money'
import { getToken } from '../utils/session'
import MoneyInput from './MoneyInput'
const axios = require('axios')

/** The step-by-step payment flow, in the admin screens' idiom. */
const PaymentFlowPanel = ({ flow, cusCode, alsoCovers, onSettled }) => {
  const {
    loading,
    enabled,
    blockedReason,
    modes,
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
    missing,
    amountInvalid,
    canStart,
    start,
    cancel,
    reset,
  } = flow

  // Tell the parent once, at the moment an attempt finishes.
  const settled = useRef(null)

  useEffect(() => {
    if (!state?.isFinished) return
    if (settled.current === state.sessionRef) return

    settled.current = state.sessionRef
    if (state.isSuccess && onSettled) onSettled()
  }, [state, onSettled])

  // The slip attached to the payment this attempt produced.
  const [attached, setAttached] = useState(null)
  const [docBusy, setDocBusy] = useState(false)
  const [docError, setDocError] = useState('')

  useEffect(() => {
    if (!state) {
      setAttached(null)
      setDocError('')
    }
  }, [state])

  /** Attach the paperwork to the payment that was just recorded. */
  const attach = async (file, input) => {
    if (!file || !state?.paymentId) return

    setDocBusy(true)
    setDocError('')
    try {
      const body = new FormData()
      body.append('file', file)

      // Content-Type left OFF deliberately.
      const r = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Payments/${state.paymentId}/Document`,
        body,
        { headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' } },
      )
      setAttached(r.data?.name ?? file.name)
      if (onSettled) onSettled()
    } catch (e) {
      setDocError(
        e?.response?.data?.message ||
          'That file could not be attached. The payment is recorded — you can add it from the payment itself.',
      )
    } finally {
      setDocBusy(false)
      // Cleared so choosing the SAME file again still fires onChange after a failure.
      if (input) input.value = ''
    }
  }

  if (loading) return <div className="cb-fs-meta text-muted py-2">Loading payment methods…</div>

  // A live gateway is usable even with simulation off.
  const anyLive = modes.some((m) => m.isLive)

  if (!enabled && !anyLive) {
    return (
      <div className="alert alert-secondary rounded-0 py-2 cb-fs-body mb-0 mt-2">
        {blockedReason ?? 'Payment collection is not available.'}
      </div>
    )
  }

  const running = state && !state.isFinished
  const outcomes = mode?.outcomes ?? []

  return (
    <div className="mt-3 pt-2 border-top">
      {/* ---- 1. how are they paying ---- */}
      <label className="cb-fs-meta text-muted d-block mb-1">How is the payment being made?</label>

      <div className="d-flex flex-wrap gap-1 mb-3">
        {modes.map((m) => {
          const on = mode?.mode === m.mode && mode?.method === m.method
          const blocked = !!m.notReadyReason

          return (
            <button
              key={`${m.method}-${m.mode}`}
              type="button"
              className={`btn btn-sm rounded-0 ${on ? 'add-btn' : 'filter-btn'}`}
              disabled={blocked || !!state}
              title={m.notReadyReason ?? m.description}
              onClick={() => chooseMode(m)}
            >
              <span className="material-icons" style={{ fontSize: 14, verticalAlign: -3 }}>
                {m.icon}
              </span>{' '}
              {m.label}
            </button>
          )
        })}
      </div>

      {mode && (
        <>
          <p className="cb-fs-meta text-muted mb-2">{mode.description}</p>

          {/* ---- 2. the method's own form, described by the server ---- */}
          {!state && (
            <div className="row g-2">
              {(mode.fields ?? []).map((f) => (
                <div className="col-md-3" key={f.key}>
                  <label className="cb-fs-meta text-muted d-block mb-1" htmlFor={`pf-${f.key}`}>
                    {f.label}
                    {f.required === false && <span className="text-muted"> (optional)</span>}
                  </label>

                  {f.type === 'select' ? (
                    <select
                      id={`pf-${f.key}`}
                      className="form-select form-select-sm rounded-0"
                      value={details[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
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
                      id={`pf-${f.key}`}
                      className="form-control form-control-sm rounded-0"
                      rows={2}
                      maxLength={f.maxLength ?? undefined}
                      placeholder={f.placeholder ?? ''}
                      value={details[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  ) : (
                    <input
                      id={`pf-${f.key}`}
                      type={f.type === 'date' ? 'date' : f.type === 'tel' ? 'tel' : 'text'}
                      className="form-control form-control-sm rounded-0"
                      maxLength={f.maxLength ?? undefined}
                      placeholder={f.placeholder ?? ''}
                      value={details[f.key] ?? ''}
                      onChange={(e) => setField(f.key, e.target.value)}
                    />
                  )}

                  {f.help && <span className="cb-fs-meta text-muted d-block">{f.help}</span>}
                </div>
              ))}

              <div className="col-md-3">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="pf-amount">
                  Amount
                </label>
                {/* Grouped while typing. */}
                <MoneyInput
                  id="pf-amount"
                  className={`form-control form-control-sm rounded-0 ${
                    amountInvalid ? 'is-invalid' : ''
                  }`}
                  placeholder="Oldest invoice in full"
                  value={amount}
                  onChange={setAmount}
                />
                <span className="cb-fs-meta text-muted">
                  Blank settles their oldest invoice exactly.
                </span>
              </div>

              {/* ---- 3. which ending to rehearse ---- */}
              {/* Gone entirely when the gateway is live: there is nothing to script. */}
              <div className={`col-md-3 ${mode.isLive ? 'd-none' : ''}`}>
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="pf-outcome">
                  Simulated outcome
                </label>
                <select
                  id="pf-outcome"
                  className="form-select form-select-sm rounded-0"
                  value={outcome}
                  onChange={(e) => setOutcome(e.target.value)}
                >
                  {outcomes.map((o) => (
                    <option key={o.outcome} value={o.outcome}>
                      {o.label}
                    </option>
                  ))}
                </select>
                <span className="cb-fs-meta text-muted">
                  {outcomes.find((o) => o.outcome === outcome)?.description}
                </span>
              </div>
            </div>
          )}

          {/* ---- 4. the attempt, live ---- */}
          {state && (
            <div
              className={`alert rounded-0 py-2 cb-fs-body mt-1 ${
                running
                  ? 'alert-info'
                  : state.awaitingClearance
                  ? 'alert-warning'
                  : state.isSuccess
                  ? 'alert-success'
                  : 'alert-danger'
              }`}
            >
              <div className="d-flex align-items-start gap-2">
                {running ? (
                  <span
                    className="spinner-border spinner-border-sm mt-1"
                    role="status"
                    aria-hidden="true"
                  />
                ) : (
                  <span className="material-icons" style={{ fontSize: 18 }}>
                    {state.awaitingClearance
                      ? 'schedule'
                      : state.isSuccess
                      ? 'check_circle'
                      : 'error_outline'}
                  </span>
                )}

                <div className="flex-grow-1">
                  <span className="fw-bold d-block">{state.title}</span>
                  <span>{state.message}</span>

                  <span className="d-block cb-fs-meta mt-1">
                    {state.sessionRef}
                    {state.providerReference ? ` · ${state.providerReference}` : ''}
                    {/* The provider's own code, kept visible. */}
                    {state.failureCode ? ` · code ${state.failureCode}` : ''}
                    {state.expiresInSeconds != null && running
                      ? ` · expires in ${state.expiresInSeconds}s`
                      : ''}
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* ---- 4b. the paperwork, attached here ---- */}
          {state?.isSuccess && state.acceptsDocument && state.paymentId && (
            <div className="mt-2">
              {attached ? (
                <span className="cb-fs-meta text-success d-flex align-items-center gap-1">
                  <span className="material-icons" style={{ fontSize: 15 }}>
                    check_circle
                  </span>
                  {attached} attached.
                </span>
              ) : (
                <>
                  <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="pf-doc">
                    Attach the slip (optional)
                  </label>
                  <input
                    id="pf-doc"
                    type="file"
                    accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                    className="form-control form-control-sm rounded-0"
                    disabled={docBusy}
                    onChange={(e) => attach(e.target.files?.[0], e.target)}
                  />
                  <span className="cb-fs-meta text-muted">
                    {docBusy
                      ? 'Uploading…'
                      : 'The bank slip, cheque or statement line — a PDF or a photo, up to 10 MB. ' +
                        'It can also be added later from the payment.'}
                  </span>
                  {docError && <span className="cb-fs-meta text-danger d-block">{docError}</span>}
                </>
              )}
            </div>
          )}

          {/* ---- 5. the buttons ---- */}
          <div className="d-flex flex-wrap gap-1 mt-2">
            {!state && (
              <button
                type="button"
                className="btn btn-sm add-btn rounded-0"
                disabled={!canStart || !cusCode}
                title={
                  !cusCode
                    ? 'Choose a client first'
                    : missing.length
                    ? `Still needed: ${missing.join(', ')}`
                    : undefined
                }
                onClick={() => start({ cusCode, alsoCovers })}
              >
                {busy
                  ? 'Starting…'
                  : // parseAmount so a part-typed "." reads as no figure yet, not "KES NaN"
                    `Pay ${
                      parseAmount(amount) != null ? money(parseAmount(amount), 'KES') : ''
                    }`.trim() + (alsoCovers?.length ? ` for ${alsoCovers.length + 1} clients` : '')}
              </button>
            )}

            {running && state.canCancel && (
              <button type="button" className="btn btn-sm delete-btn rounded-0" onClick={cancel}>
                Cancel the payment
              </button>
            )}

            {state?.isFinished && (
              <button type="button" className="btn btn-sm filter-btn rounded-0" onClick={reset}>
                Another payment
              </button>
            )}
          </div>

          {!state && missing.length > 0 && cusCode && (
            <span className="cb-fs-meta text-muted d-block mt-1">
              Still needed: {missing.join(', ')}.
            </span>
          )}

          {error && (
            <div className="alert alert-danger rounded-0 py-2 cb-fs-body mt-2">{error}</div>
          )}
        </>
      )}
    </div>
  )
}

PaymentFlowPanel.propTypes = {
  /** Whatever usePaymentCheckout returned. */
  flow: PropTypes.object.isRequired,
  /** The paying client. The flow will not start without one. */
  cusCode: PropTypes.string,
  /** The OTHER clients this one payment settles. */
  alsoCovers: PropTypes.arrayOf(PropTypes.string),
  /** Called once when an attempt settles, so the caller can refresh what is behind the panel. */
  onSettled: PropTypes.func,
}

export default PaymentFlowPanel
