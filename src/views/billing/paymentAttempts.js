import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { Link } from 'react-router-dom'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import { formatMoney as money } from '../../utils/money'
import DataTable from '../../components/DataTable'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/** Payment attempts — every M-PESA push, card authorisation and transfer entry. */
const METHODS = [
  { key: '', label: 'All methods' },
  { key: 'Mpesa', label: 'M-PESA' },
  { key: 'Card', label: 'Card' },
  { key: 'Bank', label: 'Bank transfer' },
  { key: 'Cheque', label: 'Cheque' },
  { key: 'Cash', label: 'Cash' },
  { key: 'Manual', label: 'Other' },
]

/** Attempt statuses, in the words the session uses. */
const STATUS_BADGE = {
  Succeeded: 'bg-success',
  Started: 'bg-secondary',
  AwaitingPayer: 'bg-info text-dark',
  Processing: 'bg-info text-dark',
  Failed: 'bg-danger',
  Cancelled: 'bg-dark',
  Expired: 'bg-warning text-dark',
}

const STATUSES = [
  { key: '', label: 'Any outcome' },
  { key: 'Succeeded', label: 'Paid' },
  { key: 'AwaitingPayer', label: 'Waiting on the payer' },
  { key: 'Failed', label: 'Declined' },
  { key: 'Cancelled', label: 'Cancelled' },
  { key: 'Expired', label: 'Timed out' },
]

/** What each Daraja result code actually means, in the words a person would use. */
const DARAJA = {
  0: 'Paid — the customer approved it on their phone.',
  1: 'The M-PESA wallet did not have enough money.',
  17: 'Safaricom internal error — the push never reached the handset.',
  26: 'Another transaction was already in progress on that number.',
  1001: 'A transaction was already in progress for that number.',
  1019: 'The transaction expired before it could be processed.',
  1032: 'The customer cancelled the prompt on their phone.',
  1037: 'Nobody answered — the prompt timed out on the handset.',
  2001: 'The M-PESA PIN was entered incorrectly.',
  404: 'No M-PESA payment was found with that receipt number.',
  409: 'That receipt was already credited — the money was banked once.',
}

const PaymentAttempts = () => {
  // Matches PaymentCheckoutController's own route.
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Payments/Checkout`
  const canRecord = hasModule(MODULES.RecordPayments)

  const [confirm, confirmDialog] = useConfirm()

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [method, setMethod] = useState('')
  const [status, setStatus] = useState('')
  const [failedOnly, setFailedOnly] = useState(false)
  const [hideSimulated, setHideSimulated] = useState(false)

  // The open attempt, fetched separately: the listing carries no raw provider payload.
  const [detail, setDetail] = useState(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await axios.get(`${api}/Attempts`, {
        params: {
          search: search || undefined,
          method: method || undefined,
          status: status || undefined,
          failedOnly: failedOnly || undefined,
          hideSimulated: hideSimulated || undefined,
          take: 200,
        },
        headers: authHeaders(),
      })
      setRows(r.data ?? [])
      setError('')
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, search, method, status, failedOnly, hideSimulated])

  useEffect(() => {
    load()
  }, [load])

  const open = async (row) => {
    setDetail({ loading: true, sessionRef: row.sessionRef })
    try {
      const r = await axios.get(`${api}/Attempts/${encodeURIComponent(row.sessionRef)}`, {
        headers: authHeaders(),
      })
      setDetail(r.data)
    } catch (e) {
      setDetail(null)
      setError(readErr(e))
    }
  }

  /** Catch an attempt up with reality. */
  const refresh = async (row) => {
    const live = !row.isSimulated && row.checkoutRequestId && row.status !== 'Succeeded'

    if (
      live &&
      !(await confirm({
        title: `Ask Safaricom about ${row.sessionRef}?`,
        body:
          `This reads Safaricom's own record of the ${money(row.amount, row.currency)} prompt ` +
          'and applies what they say. If the money did move and we never heard, this is what ' +
          'banks it.',
        detail:
          'Safe to repeat — an attempt that already became a payment is left alone, and the ' +
          'same M-PESA receipt cannot be banked twice.',
        confirmText: 'Ask Safaricom',
      }))
    )
      return

    setBusy(row.sessionRef)
    setError('')
    try {
      const r = await axios.get(`${api}/${encodeURIComponent(row.sessionRef)}`, {
        headers: authHeaders(),
      })

      toast.info(r.data?.message ?? 'Refreshed.', { theme: 'colored', autoClose: 10000 })

      await load()
      if (detail && !detail.loading && detail.sessionRef === row.sessionRef) await open(row)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setBusy('')
    }
  }

  const fmtWhen = (v) =>
    v ? new Date(v).toLocaleString('en-KE', { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  /** Pretty-print a stored JSON payload, falling back to the raw text when it is not JSON. */
  const pretty = (text) => {
    if (!text) return ''
    try {
      return JSON.stringify(JSON.parse(text), null, 2)
    } catch {
      return text
    }
  }

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${what} copied.`, { theme: 'colored', autoClose: 2000 })
    } catch {
      // Clipboard access is refused outside a secure context, which is every plain-HTTP deployment.
      toast.info('Select and copy it by hand — the browser refused clipboard access.', {
        theme: 'colored',
      })
    }
  }

  const counts = {
    total: rows.length,
    paid: rows.filter((r) => r.status === 'Succeeded').length,
    waiting: rows.filter((r) => r.status === 'AwaitingPayer' || r.status === 'Processing').length,
    lost: rows.filter((r) => ['Failed', 'Cancelled', 'Expired'].includes(r.status)).length,
  }

  return (
    <>
      {confirmDialog}

      {/* The shared page header, as every other screen uses. */}
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">swap_horiz</span>
          Payment attempts
          {rows.length > 0 && (
            <span className="cb-page-head__sub">{counts.total} attempt(s) shown</span>
          )}
        </h1>
        <div className="cb-page-head__actions">
          <Link to="/payments" className="btn btn-sm filter-btn rounded-0">
            <span className="material-icons" style={{ fontSize: 14, verticalAlign: -3 }}>
              receipt_long
            </span>{' '}
            The ledger
          </Link>
          <Link to="/setup?s=mpesa" className="btn btn-sm cancel-btn rounded-0">
            <span className="material-icons" style={{ fontSize: 14, verticalAlign: -3 }}>
              settings
            </span>{' '}
            M-PESA settings
          </Link>
        </div>
      </div>

      {/* What the page is for. */}
      <p className="cb-fs-meta text-muted mb-2">
        Every push, authorisation and entry — including the ones that never became money.
      </p>

      {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

      {/* The four figures worth knowing before reading the table. */}
      <div className="email-stats mb-2">
        <span className="email-stat">
          <span className="email-stat__value">{counts.total}</span>
          <span className="email-stat__label">Attempts shown</span>
        </span>
        <span className="email-stat">
          <span className="email-stat__value">{counts.paid}</span>
          <span className="email-stat__label">Became money</span>
        </span>
        <span className="email-stat email-stat--setup">
          <span className="email-stat__value">{counts.waiting}</span>
          <span className="email-stat__label">Still waiting</span>
        </span>
        <span className="email-stat">
          <span className="email-stat__value">{counts.lost}</span>
          <span className="email-stat__label">Did not go through</span>
        </span>
      </div>

      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={rows}
            rowKey={(r) => r.sessionRef}
            loading={loading}
            maxHeight="56vh"
            onRowClick={open}
            search={{
              value: search,
              placeholder: 'Search our ref, client, M-PESA receipt or Safaricom checkout id…',
              onChange: setSearch,
            }}
            toolbar={
              <>
                <select
                  className="form-select form-select-sm rounded-0"
                  style={{ width: 'auto' }}
                  aria-label="Method"
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  {METHODS.map((m) => (
                    <option key={m.key} value={m.key}>
                      {m.label}
                    </option>
                  ))}
                </select>

                <select
                  className="form-select form-select-sm rounded-0"
                  style={{ width: 'auto' }}
                  aria-label="Outcome"
                  value={status}
                  disabled={failedOnly}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {STATUSES.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.label}
                    </option>
                  ))}
                </select>

                <button
                  type="button"
                  className={`btn btn-sm rounded-0 ${failedOnly ? 'add-btn' : 'filter-btn'}`}
                  title="Everything that is not a completed payment, including attempts still in flight"
                  onClick={() => {
                    setFailedOnly((v) => !v)
                    setStatus('')
                  }}
                >
                  Anything but paid
                </button>

                <button
                  type="button"
                  className={`btn btn-sm rounded-0 ${hideSimulated ? 'add-btn' : 'filter-btn'}`}
                  title="Hide rehearsals, leaving only attempts at real money"
                  onClick={() => setHideSimulated((v) => !v)}
                >
                  Real only
                </button>
              </>
            }
            empty={{
              icon: 'swap_horiz',
              title: 'No attempts match.',
              hint: 'Attempts appear here as soon as anyone starts a payment, from the portal or from the ledger screen.',
            }}
            columns={[
              {
                key: 'createdAt',
                title: 'Started',
                nowrap: true,
                render: (r) => (
                  <>
                    {fmtWhen(r.createdAt)}
                    {r.isSimulated && (
                      <span className="badge bg-warning text-dark ms-2" style={{ fontSize: 9 }}>
                        TEST
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'cusCode',
                title: 'Client',
                render: (r) => (
                  <>
                    <strong>{r.cusCode}</strong>
                    <span className="d-block cb-fs-meta text-muted">
                      {r.companyName}
                      {/* A grouped attempt was settling several clients. */}
                      {r.coversCusCodes && (
                        <span className="badge bg-info text-dark ms-1" style={{ fontSize: 9 }}>
                          + {r.coversCusCodes.split(';').filter(Boolean).length} more
                        </span>
                      )}
                    </span>
                  </>
                ),
              },
              {
                key: 'method',
                title: 'How',
                nowrap: true,
                render: (r) => (
                  <>
                    {METHODS.find((m) => m.key === r.method)?.label ?? r.method}
                    <span className="d-block cb-fs-meta text-muted">{r.mode}</span>
                  </>
                ),
              },
              {
                key: 'amount',
                title: 'Amount',
                align: 'right',
                nowrap: true,
                render: (r) => <span className="fw-bold">{money(r.amount, r.currency)}</span>,
              },
              {
                key: 'status',
                title: 'Outcome',
                nowrap: true,
                render: (r) => (
                  <>
                    <span className={`badge ${STATUS_BADGE[r.status] ?? 'bg-secondary'}`}>
                      {STATUSES.find((s) => s.key === r.status)?.label ?? r.status}
                    </span>
                    {r.failureCode && (
                      <span className="d-block cb-fs-meta text-muted">code {r.failureCode}</span>
                    )}
                  </>
                ),
              },
              {
                key: 'reference',
                title: 'Reference',
                render: (r) => (
                  <>
                    {/* The customer's side of it — what they can read off their SMS. */}
                    <span style={{ fontVariantNumeric: 'tabular-nums' }}>
                      {r.providerReference || '—'}
                    </span>
                    {r.paymentNo && (
                      <span className="d-block cb-fs-meta text-muted">banked as {r.paymentNo}</span>
                    )}
                  </>
                ),
              },
            ]}
            actions={(r) => (
              <>
                <button
                  type="button"
                  className="cb-act"
                  title="Everything we hold about this attempt"
                  aria-label={`Open attempt ${r.sessionRef}`}
                  onClick={() => open(r)}
                >
                  <span className="material-icons">info</span>
                </button>

                {/* Offered on anything not yet settled. */}
                {canRecord && r.status !== 'Succeeded' && (
                  <button
                    type="button"
                    className={`cb-act ${r.checkoutRequestId ? 'cb-act--primary' : ''}`}
                    title={
                      r.checkoutRequestId
                        ? 'Ask Safaricom what happened to this push, and apply it'
                        : 'Catch this attempt up'
                    }
                    aria-label={`Refresh attempt ${r.sessionRef}`}
                    disabled={busy === r.sessionRef}
                    onClick={() => refresh(r)}
                  >
                    <span className="material-icons">
                      {busy === r.sessionRef ? 'hourglass_empty' : 'sync'}
                    </span>
                  </button>
                )}
              </>
            )}
          />
        </div>
      </div>

      {/* ---- one attempt, in full ---- */}
      <CModal visible={!!detail} onClose={() => setDetail(null)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">Attempt {detail?.sessionRef}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detail?.loading ? (
            <div className="cb-empty">Loading…</div>
          ) : detail ? (
            <>
              <div className="row g-2 cb-fs-body">
                <Field label="Client">
                  {detail.cusCode} — {detail.companyName}
                </Field>
                <Field label="Amount">{money(detail.amount, detail.currency)}</Field>
                <Field label="Method">
                  {METHODS.find((m) => m.key === detail.method)?.label ?? detail.method}
                  {detail.mode ? ` · ${detail.mode}` : ''}
                </Field>
                <Field label="Outcome">
                  <span className={`badge ${STATUS_BADGE[detail.status] ?? 'bg-secondary'}`}>
                    {detail.status}
                  </span>
                  {detail.step ? <span className="text-muted ms-2">at {detail.step}</span> : null}
                </Field>
                <Field label="Started">{fmtWhen(detail.createdAt)}</Field>
                <Field label="Finished">{fmtWhen(detail.completedAt)}</Field>
                <Field label="Prompt expires">{fmtWhen(detail.expiresAt)}</Field>
                <Field label="Started by">{detail.startedBy || '—'}</Field>

                {detail.coversCusCodes && (
                  <Field label="Also settling">
                    {detail.coversCusCodes.split(';').filter(Boolean).join(', ')}
                  </Field>
                )}

                {detail.simulatedOutcome && (
                  <Field label="Scripted ending">{detail.simulatedOutcome}</Field>
                )}
              </div>

              {/* What went wrong, said properly. */}
              {detail.failureCode && (
                <div className="alert alert-warning rounded-0 py-2 cb-fs-body mt-3">
                  <strong>Code {detail.failureCode}</strong>
                  {DARAJA[Number(detail.failureCode)] && (
                    <span className="d-block">{DARAJA[Number(detail.failureCode)]}</span>
                  )}
                  {detail.failureReason && (
                    <span className="d-block text-muted">{detail.failureReason}</span>
                  )}
                </div>
              )}

              {/* Safaricom's identifiers, with a copy button each. */}
              {(detail.checkoutRequestId || detail.merchantRequestId) && (
                <>
                  <h3 className="cb-fs-section mt-3 mb-1">Safaricom&rsquo;s references</h3>
                  {[
                    ['CheckoutRequestID', detail.checkoutRequestId],
                    ['MerchantRequestID', detail.merchantRequestId],
                    ['M-PESA receipt', detail.providerReference],
                  ]
                    .filter(([, v]) => !!v)
                    .map(([label, value]) => (
                      <div
                        key={label}
                        className="d-flex align-items-center justify-content-between gap-2 border-bottom py-1"
                      >
                        <span className="cb-fs-meta text-muted">{label}</span>
                        <span className="d-flex align-items-center gap-1">
                          <code className="cb-fs-body">{value}</code>
                          <button
                            type="button"
                            className="cb-act"
                            title={`Copy the ${label}`}
                            aria-label={`Copy the ${label}`}
                            onClick={() => copy(value, label)}
                          >
                            <span className="material-icons">content_copy</span>
                          </button>
                        </span>
                      </div>
                    ))}
                </>
              )}

              {detail.details && (
                <>
                  <h3 className="cb-fs-section mt-3 mb-1">What the form collected</h3>
                  <span className="cb-fs-meta text-muted d-block mb-1">
                    Already redacted when it was stored — no security codes, card numbers masked.
                  </span>
                  <pre className="cb-pre">{pretty(detail.details)}</pre>
                </>
              )}

              {detail.rawPayload && (
                <>
                  <h3 className="cb-fs-section mt-3 mb-1">
                    What the provider actually sent
                    <button
                      type="button"
                      className="cb-act ms-1"
                      title="Copy the payload"
                      aria-label="Copy the payload"
                      onClick={() => copy(detail.rawPayload, 'Payload')}
                    >
                      <span className="material-icons">content_copy</span>
                    </button>
                  </h3>
                  <span className="cb-fs-meta text-muted d-block mb-1">
                    Kept verbatim. When a figure is disputed months later this is the only record of
                    what they sent, as opposed to what we parsed out of it.
                  </span>
                  <pre className="cb-pre">{pretty(detail.rawPayload)}</pre>
                </>
              )}
            </>
          ) : null}
        </CModalBody>
        <div className="d-flex flex-wrap gap-1 p-3 pt-0">
          {canRecord && detail && !detail.loading && detail.status !== 'Succeeded' && (
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={busy === detail.sessionRef}
              onClick={() => refresh(detail)}
            >
              {detail.checkoutRequestId ? 'Ask Safaricom again' : 'Catch it up'}
            </button>
          )}
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0 ms-auto"
            onClick={() => setDetail(null)}
          >
            Close
          </button>
        </div>
      </CModal>
    </>
  )
}

/** One labelled value in the detail grid. */
const Field = ({ label, children }) => (
  <div className="col-sm-6">
    <span className="cb-fs-meta text-muted d-block">{label}</span>
    <span>{children}</span>
  </div>
)

Field.propTypes = {
  label: PropTypes.string.isRequired,
  children: PropTypes.node,
}

export default PaymentAttempts
