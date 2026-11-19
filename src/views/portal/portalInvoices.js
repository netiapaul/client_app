import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { portalGet, readErr, fmtDate, apiUrl, PortalSessionEnded } from '../../utils/portalApi'
import { formatMoney as money } from '../../utils/money'
import { downloadFile } from '../../utils/download'
import { PortalListFilters, PortalListPager, rangeOf } from './PortalListControls'

/**
 * The customer's invoices.
 *
 * Drafts never appear — the server excludes them. A draft has not been issued, so the client does
 * not owe it, and showing one would invite payment for something that might still be withdrawn.
 *
 * Paying hands off to /portal/pay rather than collecting anything here. That page owns the whole
 * attempt — the method, the server-described form, the waiting, the failure vocabulary — and a
 * second entry point into it would be a second place for that to drift.
 */
/**
 * Server-side, all of them. They used to filter the array in the browser, which stops working the
 * moment the list is paged: "To pay" would have filtered page one and silently omitted the unpaid
 * invoices on page two.
 */
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'open', label: 'To pay' },
  { key: 'paid', label: 'Paid' },
  { key: 'cancelled', label: 'Cancelled' },
]

const PAGE_SIZE = 20

const STATUS = {
  Issued: { label: 'To pay', cls: 'is-expiringsoon' },
  PartiallyPaid: { label: 'Part paid', cls: 'is-expiringsoon' },
  Paid: { label: 'Paid', cls: 'is-active' },
  Cancelled: { label: 'Cancelled', cls: 'is-inactive' },
}

const PortalInvoices = () => {
  const navigate = useNavigate()

  const [invoices, setInvoices] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [open, setOpen] = useState(null)

  // The date range, and the page. `preset` is only which button looks pressed — `from`/`to` are
  // the truth, so typing a date by hand simply deselects the presets rather than fighting them.
  const [preset, setPreset] = useState('all')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [page, setPage] = useState(1)

  // From the server, over the WHOLE filtered set and the whole account respectively — see
  // PortalInvoicePageVM. Adding up the page would have made both wrong the moment paging arrived.
  const [matchingRows, setMatchingRows] = useState(0)
  const [account, setAccount] = useState(null)
  const [span, setSpan] = useState({})
  // Which invoice is being fetched. Held by id rather than as a boolean so the spinner appears on
  // the row that was clicked and the rest of the table stays usable.
  const [downloading, setDownloading] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await portalGet('/Portal/Invoices', {
        status: filter === 'all' ? undefined : filter,
        from: from || undefined,
        to: to || undefined,
        page,
        pageSize: PAGE_SIZE,
      })

      setInvoices(r?.items ?? [])
      setMatchingRows(r?.matchingRows ?? 0)
      setAccount(r?.account ?? null)
      setSpan({ earliest: r?.earliestPeriod, latest: r?.latestPeriod })
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

  /**
   * Any change to WHAT is being looked at goes back to page one.
   *
   * Without this, filtering while on page 5 asks for page 5 of a shorter result set and the table
   * comes back empty — which reads as "you have no invoices" rather than "you are past the end".
   */
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

  // Typed dates deselect the presets rather than contradicting them: a pressed "This year" above
  // a range of somebody else's choosing is a lie about what is being shown.
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
      outstanding: account?.outstanding ?? 0,
      overdue: account?.overdue ?? 0,
      owing: account?.companiesOwing ?? 0,
      currency: account?.currency ?? 'KES',
    }),
    [account],
  )

  // Is an empty table a filter result or an empty account? Anything narrowing the view says the
  // first — including being past the last page, which looks identical to a customer.
  const narrowed = filter !== 'all' || !!from || !!to || page > 1

  const show = async (row) => {
    setOpen({ loading: true })
    try {
      setOpen(await portalGet(`/Portal/Invoices/${row.id}`))
    } catch (e) {
      setOpen(null)
      setError(readErr(e))
    }
  }

  /**
   * Save the invoice as a PDF — what a customer needs to file it or give it to their accountant.
   *
   * The server stores the document it emailed and renders one on the spot if that is missing, so
   * this is offered on every invoice without the screen having to know which have one.
   */
  const savePdf = async (row) => {
    setDownloading(row.id)
    setError('')
    try {
      await downloadFile(apiUrl(`/Portal/Invoices/${row.id}/Pdf`), `${row.invoiceNo}.pdf`)
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
          <h1>Proforma invoices</h1>
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

      {/* Gated on the ACCOUNT owing something, not on this page having rows. Gating it on the
          page meant filtering to "Paid" — or to a quiet date range — hid the outstanding total
          and the Pay button on an account that still owes money. */}
      {totals.outstanding > 0 && (
        <section className="pt-card pt-card--dark pt-hero">
          <span aria-hidden="true" className="pt-hero__ring pt-hero__ring--a" />
          <span className="pt-hero__label">
            Total outstanding
            {totals.overdue > 0 && (
              <span
                style={{
                  background: 'var(--pt-red)',
                  color: '#fff',
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 9px',
                  borderRadius: 999,
                  letterSpacing: 0,
                  textTransform: 'none',
                }}
              >
                {totals.overdue} overdue
              </span>
            )}
          </span>
          <span className="pt-hero__value">{money(totals.outstanding, totals.currency)}</span>
          <div className="pt-hero__actions">
            {/* Hidden when nothing is outstanding — offering it anyway would land them on a page
                with an empty company picker and no explanation.

                Someone owing on several companies gets the one-payment offer by name; with one
                company owing, "pay everything" and "pay now" are the same button. */}
            {totals.outstanding > 0 && (
              <button
                type="button"
                className="pt-btn pt-btn--accent"
                onClick={() => navigate(totals.owing > 1 ? '/portal/pay?all=1' : '/portal/pay')}
              >
                {totals.owing > 1 ? `Pay all ${totals.owing} companies` : 'Pay now'}
                <span className="material-icons">arrow_forward</span>
              </button>
            )}
            <button type="button" className="pt-btn" onClick={() => navigate('/portal/receipts')}>
              Payment history
              <span className="material-icons">receipt_long</span>
            </button>
          </div>
        </section>
      )}

      <PortalListFilters
        label="invoices"
        idPrefix="pt-inv"
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
        {invoices.length === 0 ? (
          <div className="pt-empty">
            <span className="material-icons">description</span>
            {/* "Nothing matches" and "you have none" are different facts, and only the server
                knows which: an account with history and an active filter is the first, an empty
                account is the second. `narrowed` distinguishes them. */}
            {narrowed ? 'Nothing matches those filters.' : 'No invoices yet.'}
            <span style={{ fontSize: 'var(--pt-fs-sm)' }}>
              {narrowed
                ? 'Try a wider date range, or clear the filters.'
                : 'Your first invoice will appear here, and a copy will be emailed to you.'}
            </span>
          </div>
        ) : (
          <div className="pt-scroll">
            <table className="pt-table">
              <thead>
                <tr>
                  <th>Invoice</th>
                  <th>Company</th>
                  <th>Period</th>
                  <th style={{ width: '1%' }}>Due</th>
                  <th style={{ width: '1%', textAlign: 'right' }}>Amount</th>
                  <th style={{ width: '1%', textAlign: 'right' }}>Outstanding</th>
                  <th style={{ width: '1%', textAlign: 'center' }}>Status</th>
                  <th style={{ width: '1%' }}>
                    <span className="visually-hidden">Download</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((i) => {
                  const s = STATUS[i.status] ?? { label: i.status, cls: 'is-unknown' }
                  return (
                    <tr key={i.id} role="button" onClick={() => show(i)}>
                      <td style={{ fontWeight: 700 }}>{i.invoiceNo}</td>
                      <td>{i.companyName}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {fmtDate(i.periodStart)} → {fmtDate(i.periodEnd)}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          style={i.isOverdue ? { color: 'var(--pt-red-fg)', fontWeight: 700 } : {}}
                        >
                          {fmtDate(i.dueDate)}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {money(i.amountDue, i.currency)}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap', fontWeight: 700 }}>
                        {money(i.outstanding, i.currency)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span className={`pt-pill ${s.cls}`}>{s.label}</span>
                      </td>
                      <td>
                        {/* The row opens the invoice, so neither of these must also do that. */}
                        <span style={{ display: 'inline-flex', gap: 2 }}>
                          {i.outstanding > 0 && i.status !== 'Cancelled' && (
                            <button
                              type="button"
                              className="pt-icon-btn"
                              title={`Pay ${i.invoiceNo}`}
                              aria-label={`Pay invoice ${i.invoiceNo}`}
                              onClick={(e) => {
                                e.stopPropagation()
                                // The company, not the invoice: the pay page allocates oldest-
                                // first across everything that company owes, so sending it one
                                // invoice id would promise a precision it does not have.
                                navigate(`/portal/pay?cus=${encodeURIComponent(i.cusCode)}`)
                              }}
                            >
                              <span className="material-icons">payments</span>
                            </button>
                          )}
                          <button
                            type="button"
                            className="pt-icon-btn"
                            title={`Download ${i.invoiceNo}.pdf`}
                            aria-label={`Download invoice ${i.invoiceNo} as PDF`}
                            disabled={downloading === i.id}
                            onClick={(e) => {
                              e.stopPropagation()
                              savePdf(i)
                            }}
                          >
                            <span className="material-icons">
                              {downloading === i.id ? 'hourglass_empty' : 'download'}
                            </span>
                          </button>
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Below the rows it pages. Renders nothing at all when they fit on one page. */}
      <PortalListPager
        page={page}
        pageSize={PAGE_SIZE}
        matchingRows={matchingRows}
        onPage={setPage}
        busy={loading}
      />

      {/* One invoice in full */}
      {open && (
        <section className="pt-card">
          {open.loading ? (
            <div className="pt-empty">Loading…</div>
          ) : (
            <>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginBottom: 14,
                }}
              >
                <h2 className="pt-card__title">
                  {open.invoiceNo}
                  <span
                    style={{
                      fontWeight: 400,
                      color: 'var(--pt-muted)',
                      fontSize: 'var(--pt-fs-sm)',
                      marginLeft: 8,
                    }}
                  >
                    {open.companyName}
                  </span>
                </h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    className="pt-btn"
                    disabled={downloading === open.id}
                    onClick={() => savePdf(open)}
                  >
                    {downloading === open.id ? 'Preparing…' : 'Download PDF'}
                    <span className="material-icons">download</span>
                  </button>
                  <button type="button" className="pt-btn" onClick={() => setOpen(null)}>
                    Close
                  </button>
                </div>
              </div>

              <div className="pt-tiles" style={{ marginBottom: 14 }}>
                <div className="pt-tile">
                  <span className="pt-tile__k">Period</span>
                  <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 700 }}>
                    {fmtDate(open.periodStart)} → {fmtDate(open.periodEnd)}
                  </span>
                </div>
                <div className="pt-tile">
                  <span className="pt-tile__k">Due by</span>
                  <span style={{ fontSize: 'var(--pt-fs-body)', fontWeight: 700 }}>
                    {fmtDate(open.dueDate)}
                  </span>
                </div>
                <div className="pt-tile">
                  <span className="pt-tile__k">Outstanding</span>
                  <span className="pt-tile__v">{money(open.outstanding, open.currency)}</span>
                </div>
              </div>

              <div className="pt-scroll">
                <table className="pt-table">
                  <thead>
                    <tr>
                      <th>What this covers</th>
                      <th style={{ width: '1%', textAlign: 'right' }}>Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(open.lines ?? []).map((l, idx) => (
                      <tr key={idx}>
                        <td>{l.description}</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {money(l.lineTotal, open.currency)}
                        </td>
                      </tr>
                    ))}
                    <tr>
                      <td style={{ fontWeight: 700 }}>Total due</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                        {money(open.amountDue, open.currency)}
                      </td>
                    </tr>
                    {open.amountPaid > 0 && (
                      <tr>
                        <td style={{ color: 'var(--pt-muted)' }}>Paid so far</td>
                        <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                          {money(open.amountPaid, open.currency)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </section>
      )}
    </>
  )
}

export default PortalInvoices
