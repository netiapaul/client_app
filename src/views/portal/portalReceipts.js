import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { portalGet, readErr, fmtDate, apiUrl, PortalSessionEnded } from '../../utils/portalApi'
import { formatMoney as money } from '../../utils/money'
import { downloadFile } from '../../utils/download'
import { PortalListFilters, PortalListPager, rangeOf } from './PortalListControls'

/**
 * The customer's payment history — what they have paid us, and what each payment settled.
 *
 * "Applied to" is the column that earns this page. An amount and a date tell a customer nothing
 * they did not already know from their own bank statement; which invoices the money cleared is the
 * thing only we can tell them, and it is what they ring up to ask.
 *
 * Two kinds of row never appear, both decided server-side:
 *
 *  - failed attempts, because a declined card is not a payment — they watched it fail at the time;
 *  - payments not yet matched to a company, which have no owner to show them to.
 *
 * SIMULATED payments do appear, badged, but only where the server permits simulating — off by
 * default and refused in production. They were hidden at first, for the good reason that test
 * money in a customer's history is us claiming money we never received. The trouble is that the
 * simulator settles invoices through the REAL ledger, so hiding the payment left a paid invoice
 * with no receipt behind it: the one state nobody can explain while demonstrating the thing. A
 * clearly marked rehearsal is more honest than a silent gap.
 *
 * Reversed payments DO appear, marked. Somebody whose payment was reversed has an invoice that
 * went back to unpaid, and hiding that would be the one omission they would be right to be angry
 * about.
 */
/**
 * Server-side, like the invoices page — a method filter applied in the browser would have filtered
 * the current page only once this list was paged.
 *
 * The keys are the server's own method values, except "other", which the endpoint reads as
 * everything-except-M-PESA.
 */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'Mpesa', label: 'M-PESA' },
  { key: 'other', label: 'Bank & card' },
]

const PAGE_SIZE = 20

/** How each method reads to a customer, with the icon the rest of the portal uses for it. */
const METHOD = {
  Mpesa: { label: 'M-PESA', icon: 'smartphone' },
  Bank: { label: 'Bank transfer', icon: 'account_balance' },
  Card: { label: 'Card', icon: 'credit_card' },
  Cheque: { label: 'Cheque', icon: 'receipt' },
  Cash: { label: 'Cash', icon: 'payments' },
  Manual: { label: 'Recorded by Corebase', icon: 'edit_note' },
}

const PortalReceipts = () => {
  const navigate = useNavigate()

  const [payments, setPayments] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')

  // `preset` is only which button looks pressed; `from`/`to` are the truth, so a typed date simply
  // deselects the presets rather than contradicting one.
  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  // Both from the server: the matching count over the whole filtered set, and the account totals
  // over everything. Adding up the page would make the hero wrong as soon as there are two pages.
  const [matchingRows, setMatchingRows] = useState(0)
  const [account, setAccount] = useState(null)
  const [span, setSpan] = useState({})

  // Held by id rather than as a boolean so the spinner appears on the row that was clicked and
  // every other row stays usable.
  const [downloading, setDownloading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await portalGet('/Portal/Payments', {
        method: filter === 'all' ? undefined : filter,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })

      setPayments(r?.items ?? [])
      setMatchingRows(r?.matchingRows ?? 0)
      setAccount(r?.account ?? null)
      setSpan({ earliest: r?.earliestPaid, latest: r?.latestPaid })
      setError('')
    } catch (e) {
      if (e instanceof PortalSessionEnded) {
        navigate('/', { replace: true })
        return
      }
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [navigate, filter, from, to, page])

  useEffect(() => {
    load()
  }, [load])

  /** Any change to what is being looked at goes back to page one — see portalInvoices. */
  const refilter = (fn) => {
    setPage(1)
    fn()
  }

  const applyPreset = (key) => {
    const r = rangeOf(key)
    refilter(() => {
      setPreset(key)
      setFrom(r.from)
      setTo(r.to)
    })
  }

  const applyFrom = (v) =>
    refilter(() => {
      setPreset('')
      setFrom(v)
    })
  const applyTo = (v) =>
    refilter(() => {
      setPreset('')
      setTo(v)
    })

  const totals = useMemo(
    () => ({
      paid: account?.paid ?? 0,
      credit: account?.credit ?? 0,
      currency: account?.currency ?? 'KES',
    }),
    [account],
  )

  // Any rehearsals on THIS page. Their presence is itself the signal that this is not a production
  // ledger — the server only sends them where simulating is permitted.
  const simulated = payments.filter((p) => p.isSimulated).length

  // Filter result or empty account? Anything narrowing the view says the first.
  const narrowed = filter !== 'all' || !!from || !!to || page > 1

  /** The receipt, rendered on demand. Only offered where the server says one exists. */
  const saveReceipt = async (row) => {
    setDownloading(row.id)
    setError('')
    try {
      await downloadFile(apiUrl(`/Portal/Payments/${row.id}/Receipt`), `${row.paymentNo}.pdf`)
    } catch (e) {
      setError(e.message)
    } finally {
      setDownloading(null)
    }
  }

  if (loading) return <div className="pt-empty">Loading…</div>

  return (
    <>
      <div className="pt-head">
        <div>
          <span className="pt-head__eyebrow">Billing</span>
          <h1>Payments</h1>
        </div>
      </div>

      {error && (
        <div className="pt-note pt-note--amber">
          <span className="pt-note__icon">
            <span className="material-icons">error_outline</span>
          </span>
          <span>
            <span>{error}</span>
          </span>
        </div>
      )}

      {/* Said once at the top rather than only per row: somebody reading the total needs to know
          it includes money that never moved, before they read the figure. */}
      {simulated > 0 && (
        <div className="pt-note pt-note--amber">
          <span className="pt-note__icon">
            <span className="material-icons">science</span>
          </span>
          <span>
            <strong>
              {simulated} test payment{simulated === 1 ? '' : 's'} shown
            </strong>
            <span>
              {simulated === 1 ? 'It was' : 'They were'} made up by the payment simulator, so no
              money moved — but {simulated === 1 ? 'it' : 'they'} did settle the invoice
              {simulated === 1 ? '' : 's'} shown below, which is why{' '}
              {simulated === 1 ? 'it appears' : 'they appear'} here. Test money is only ever shown
              where simulation is switched on.
            </span>
          </span>
        </div>
      )}

      {/* Gated on the account having paid something, not on this page having rows — otherwise
          narrowing to a quiet month hides "paid to date", which is an account-level fact. */}
      {totals.paid > 0 && (
        <section className="pt-card pt-card--dark pt-hero">
          <span aria-hidden="true" className="pt-hero__ring pt-hero__ring--a" />
          <span className="pt-hero__label">
            Paid to date
            {totals.credit > 0 && (
              <span
                style={{
                  background: 'var(--pt-green)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 999,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
                title="Money received that is not yet applied to an invoice. It comes off your next one."
              >
                {money(totals.credit, totals.currency)} in credit
              </span>
            )}
          </span>
          <span className="pt-hero__value">{money(totals.paid, totals.currency)}</span>
          <div className="pt-hero__actions">
            <button
              type="button"
              className="pt-btn pt-btn--accent"
              onClick={() => navigate('/portal/pay')}
            >
              Make a payment
              <span className="material-icons">arrow_forward</span>
            </button>
          </div>
        </section>
      )}

      <PortalListFilters
        label="payments"
        idPrefix="pt-rcp"
        views={FILTERS}
        view={filter}
        onView={(k) => refilter(() => setFilter(k))}
        preset={preset}
        from={from}
        to={to}
        onPreset={applyPreset}
        onFrom={applyFrom}
        onTo={applyTo}
        earliest={span.earliest}
        busy={loading}
      />

      <section className="pt-card">
        <div className="pt-scroll">
          <table className="pt-table">
            <thead>
              <tr>
                <th>Confirmation</th>
                <th style={{ width: '1%' }}>Paid on</th>
                <th>Company</th>
                <th>Method</th>
                <th>Reference</th>
                <th>Applied to</th>
                <th style={{ width: '1%', textAlign: 'right' }}>Amount</th>
                <th style={{ width: '1%' }}>
                  <span className="visually-hidden">Download</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {payments.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ padding: 0 }}>
                    <div className="pt-empty">
                      <span className="material-icons">receipt_long</span>
                      {/* "Nothing matches" and "you have none" are different facts. */}
                      {narrowed ? 'Nothing matches those filters' : 'No payments yet'}
                      <span style={{ fontSize: 'var(--pt-fs-sm)' }}>
                        {narrowed
                          ? 'Try a wider date range, or clear the filters.'
                          : 'Every payment you make is confirmed here, showing which invoices it settled and any credit left over. Official receipts are issued separately.'}
                      </span>
                    </div>
                  </td>
                </tr>
              ) : (
                payments.map((p) => {
                  const m = METHOD[p.method] ?? { label: p.method, icon: 'payments' }
                  const reversed = !!p.reversedAt

                  // A cheque sits here, cleared nothing and settled nothing, until it clears.
                  const pending = p.status === 'Pending'

                  return (
                    <tr key={p.id} style={reversed ? { opacity: 0.6 } : undefined}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {p.paymentNo}
                        {/* First, and on its own: whether this was real money is a bigger fact
                            about the row than whether it cleared. */}
                        {p.isSimulated && (
                          <span
                            className="pt-pill is-expiringsoon"
                            style={{ marginLeft: 8 }}
                            title="Made up by the payment simulator — no money moved"
                          >
                            Test
                          </span>
                        )}
                        {reversed && (
                          <span className="pt-pill is-inactive" style={{ marginLeft: 8 }}>
                            Reversed
                          </span>
                        )}
                        {!reversed && pending && (
                          <span className="pt-pill is-expiringsoon" style={{ marginLeft: 8 }}>
                            Clearing
                          </span>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{fmtDate(p.receivedAt)}</td>
                      {/* A grouped payment settled several companies, and naming only the payer
                          would read as a single-company payment of a suspiciously large amount.
                          The Applied-to column lists which. */}
                      <td>
                        {p.companyName}
                        {p.appliedTo?.length > 1 &&
                          new Set(p.appliedTo.map((a) => a.cusCode)).size > 1 && (
                            <span
                              style={{
                                display: 'block',
                                fontSize: 'var(--pt-fs-xs)',
                                color: 'var(--pt-muted)',
                              }}
                            >
                              + {new Set(p.appliedTo.map((a) => a.cusCode)).size - 1} more
                            </span>
                          )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                          title={p.bankName ?? undefined}
                        >
                          <span
                            className="material-icons"
                            style={{ fontSize: 18, color: 'var(--pt-muted)' }}
                          >
                            {m.icon}
                          </span>
                          {m.label}
                        </span>
                      </td>
                      {/* Their own side of the record — the one field they can check against
                          their phone or statement. */}
                      <td style={{ whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }}>
                        {p.reference || <span style={{ color: 'var(--pt-muted)' }}>—</span>}
                      </td>
                      <td>
                        {p.appliedTo?.length ? (
                          <span style={{ display: 'grid', gap: 2 }}>
                            {p.appliedTo.map((a) => (
                              <span key={a.invoiceId} style={{ whiteSpace: 'nowrap' }}>
                                {a.invoiceNo}
                                <span style={{ color: 'var(--pt-muted)' }}>
                                  {' '}
                                  · {money(a.amount, p.currency)}
                                </span>
                                {/* Only when the payment spans companies — otherwise it
                                    repeats the Company column on every line. */}
                                {new Set(p.appliedTo.map((x) => x.cusCode)).size > 1 && (
                                  <span
                                    style={{
                                      color: 'var(--pt-muted)',
                                      fontSize: 'var(--pt-fs-xs)',
                                    }}
                                  >
                                    {' '}
                                    · {a.companyName ?? a.cusCode}
                                  </span>
                                )}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--pt-muted)' }}>
                            {pending ? 'Once it clears' : 'Held as credit'}
                          </span>
                        )}
                        {p.credit > 0 && p.appliedTo?.length > 0 && (
                          <span
                            style={{
                              display: 'block',
                              fontSize: 'var(--pt-fs-sm)',
                              color: 'var(--pt-muted)',
                            }}
                          >
                            {money(p.credit, p.currency)} left as credit
                          </span>
                        )}
                      </td>
                      <td
                        style={{
                          textAlign: 'right',
                          whiteSpace: 'nowrap',
                          fontWeight: 700,
                          textDecoration: reversed ? 'line-through' : undefined,
                        }}
                      >
                        {money(p.amount, p.currency)}
                      </td>
                      <td>
                        {p.hasReceipt ? (
                          <button
                            type="button"
                            className="pt-icon-btn"
                            title={`Download ${p.paymentNo}.pdf`}
                            aria-label={`Download payment confirmation ${p.paymentNo} as PDF`}
                            disabled={downloading === p.id}
                            onClick={() => saveReceipt(p)}
                          >
                            <span className="material-icons">
                              {downloading === p.id ? 'hourglass_empty' : 'download'}
                            </span>
                          </button>
                        ) : (
                          // Deliberately not a disabled button: there is nothing to enable. A
                          // pending cheque and a reversed payment have no receipt to issue.
                          <span
                            className="material-icons"
                            style={{ color: 'var(--pt-muted)', fontSize: 18 }}
                            title={
                              pending
                                ? 'The confirmation is issued once this clears'
                                : 'A reversed payment has no confirmation'
                            }
                          >
                            remove
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Below the rows it pages. Renders nothing at all when they fit on one page. */}
      <PortalListPager
        page={page}
        pageSize={PAGE_SIZE}
        matchingRows={matchingRows}
        onPage={setPage}
        busy={loading}
      />

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button type="button" className="pt-btn" onClick={() => navigate('/portal/invoices')}>
          <span className="material-icons">description</span>
          See your invoices
        </button>
        <button type="button" className="pt-btn" onClick={() => navigate('/portal/companies')}>
          <span className="material-icons">business</span>
          See your licences
        </button>
      </div>
    </>
  )
}

export default PortalReceipts
