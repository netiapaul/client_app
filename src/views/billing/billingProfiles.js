import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import { formatMoney as money } from '../../utils/money'
import DataTable from '../../components/DataTable'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/** Billing Profiles — what each company pays per month. */
const STATES = [
  { key: '', label: 'All' },
  { key: 'unpriced', label: 'Not priced' },
  { key: 'billable', label: 'Billable' },
  { key: 'paused', label: 'Paused' },
]

const BillingProfiles = () => {
  // Replaces window.confirm, which the browser prefixes with its own hostname.
  const [confirm, confirmDialog] = useConfirm()

  // The editor is a PAGE now, not a modal here — see views/billing/billingProfileEditor.
  const navigate = useNavigate()
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/BillingProfiles`

  const canManage = hasModule(MODULES.ManageBilling)

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Which client's Auto switch is mid-save.
  const [autoBusy, setAutoBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        axios.get(api, {
          params: { search: search || '', state: state || '', page, pageSize },
          headers: authHeaders(),
        }),
        axios.get(`${api}/Summary`, { headers: authHeaders() }),
      ])
      setItems(list.data?.items ?? [])
      setTotal(list.data?.total ?? 0)
      setSummary(s.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, search, state, page, pageSize])

  // Filter changes invalidate the page number, so it resets at the source rather than in an effect.
  const changeSearch = (v) => {
    setSearch(v)
    setPage(1)
  }
  const changeState = (v) => {
    setState(v)
    setPage(1)
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 12000)
      return () => clearTimeout(t)
    }
  }, [error])

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null

  const stop = async (row) => {
    if (
      !(await confirm({
        title: `Stop billing ${row.companyName}?`,
        body: 'No further invoices will be raised.',
        detail: 'The price history is kept, so billing can be started again later.',
        danger: true,
        confirmText: 'Stop billing',
      }))
    )
      return
    try {
      await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/Stop`,
        { effectiveTo: null },
        { headers: authHeaders() },
      )
      toast.success('Billing stopped.', { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  /** Switch auto-invoicing for one client. */
  const toggleAuto = async (row) => {
    const on = !row.autoIssue
    if (
      on &&
      !(await confirm({
        title: `Switch auto-invoicing on for ${row.companyName}?`,
        body:
          'From the next nightly run their invoice will be issued without review: it becomes ' +
          'payable, is emailed with the PDF and is texted to them.',
        detail: `Their current price is ${money(row.monthlyAmount, row.currency)} a month.`,
        confirmText: 'Switch it on',
      }))
    )
      return

    setAutoBusy(row.cusCode)
    setError('')
    try {
      const r = await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/AutoIssue`,
        { autoIssue: on },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAutoBusy(null)
    }
  }

  /** Mark a client as paying by standing order. */
  const toggleStandingOrder = async (row) => {
    setAutoBusy(row.cusCode)
    setError('')
    try {
      const r = await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/StandingOrder`,
        { paysByStandingOrder: !row.paysByStandingOrder },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAutoBusy(null)
    }
  }

  const stateBadge = (r) => {
    if (!r.hasPrice)
      return (
        <span className="badge bg-warning text-dark" style={{ fontSize: 9 }}>
          Not priced
        </span>
      )
    if (r.isBillable === false)
      return (
        <span className="badge bg-secondary" style={{ fontSize: 9 }}>
          Paused
        </span>
      )
    return (
      <span className="badge bg-success" style={{ fontSize: 9 }}>
        Billable
      </span>
    )
  }

  const surface = (r) =>
    r.cloudBranches === 0
      ? { label: 'Desktop', cls: 'bg-dark' }
      : r.desktopBranches === 0
      ? { label: 'Cloud', cls: 'bg-info text-dark' }
      : { label: 'Mixed', cls: 'bg-secondary' }

  return (
    <>
      {confirmDialog}

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">payments</span>
          Billing Profiles
          {summary && (
            <span className="cb-page-head__sub">
              {summary.companiesPriced} of {summary.companiesTotal} priced
            </span>
          )}
        </h1>
        {summary && (
          <div className="cb-page-head__actions">
            <span className="cb-fs-table text-muted">
              Monthly total{' '}
              <span className="fw-bold text-body">
                {money(summary.monthlyTotal, summary.currency)}
              </span>
            </span>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      {summary?.companiesUnpriced > 0 && (
        <div className="alert alert-warning rounded-0 py-1 mb-2 cb-fs-body">
          <span className="fw-bold">{summary.companiesUnpriced}</span> client(s) have no price set.
          A client with no price is never invoiced — that is how a non-subscription client is kept
          out of billing, so this number is only a problem if someone is missing from it.
        </div>
      )}

      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={items}
            rowKey={(r) => r.cusCode}
            loading={loading}
            maxHeight="58vh"
            search={{
              value: search,
              placeholder: 'Search client name or code…',
              onChange: changeSearch,
            }}
            toolbar={
              <select
                className="form-select form-select-sm rounded-0 filter-control"
                style={{ width: 130 }}
                value={state}
                aria-label="Filter by billing state"
                onChange={(e) => changeState(e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            }
            empty={{ icon: 'payments', title: 'No clients match.' }}
            page={{
              page,
              pageSize,
              total,
              onPage: setPage,
              onPageSize: (n) => {
                setPageSize(n)
                setPage(1)
              },
            }}
            columns={[
              {
                key: 'companyName',
                title: 'Client',
                icon: 'apartment',
                render: (r) => (
                  <>
                    <span className="d-block fw-bold text-truncate" style={{ maxWidth: 240 }}>
                      {r.companyName}
                    </span>
                    <span className="d-block text-muted">{r.cusCode}</span>
                  </>
                ),
              },
              {
                key: 'type',
                title: 'Type',
                icon: 'cloud',
                width: '1%',
                align: 'center',
                render: (r) => {
                  const s = surface(r)
                  return (
                    <span className={`badge ${s.cls}`} style={{ fontSize: 9 }}>
                      {s.label}
                    </span>
                  )
                },
              },
              {
                key: 'branchCount',
                title: 'Branches',
                icon: 'store',
                width: '1%',
                align: 'center',
              },
              {
                key: 'licensedUsers',
                title: 'Users',
                icon: 'group',
                width: '1%',
                align: 'center',
              },
              {
                key: 'monthlyAmount',
                title: 'Monthly',
                icon: 'payments',
                width: '130px',
                render: (r) => {
                  // In Branch mode monthlyAmount is NOT what the company pays.
                  const isBranch = r.billingMode === 'Branch'

                  return (
                    <>
                      <span className="fw-bold">
                        {isBranch
                          ? money(r.branchMonthlyAmount, r.currency)
                          : money(r.monthlyAmount, r.currency)}
                      </span>
                      {isBranch && (
                        <span className="d-block cb-fs-meta" style={{ color: 'var(--cb-muted)' }}>
                          per branch × {r.branchCount ?? 0} ={' '}
                          {money((r.branchMonthlyAmount ?? 0) * (r.branchCount ?? 0), r.currency)}
                        </span>
                      )}
                      {r.hasPrice && (
                        <span className="d-block text-muted">
                          from {fmtDate(r.effectiveFrom)}
                          {r.priceChanges > 1 && ` · ${r.priceChanges} price changes`}
                        </span>
                      )}
                      {/* Credit is rare, so it earns its place in the row only when present. */}
                      {r.credit > 0 && (
                        <span
                          className="d-block cb-fs-meta fw-bold"
                          title="Money already paid that no invoice has claimed. It comes off the next invoice automatically."
                          style={{ color: 'var(--cui-info, #3399ff)' }}
                        >
                          {money(r.credit, r.currency)} in credit
                        </span>
                      )}
                    </>
                  )
                },
              },
              {
                key: 'licenceExpiry',
                title: 'Licence expires',
                icon: 'event',
                width: '1%',
                nowrap: true,
                render: (r) =>
                  fmtDate(r.licenceExpiry) ?? <span className="text-muted">not set</span>,
              },
              {
                key: 'nextInvoiceDate',
                title: 'Invoice on',
                icon: 'receipt_long',
                width: '1%',
                nowrap: true,
                render: (r) =>
                  r.nextInvoiceDate ? (
                    <>
                      <span className="d-block fw-bold">{fmtDate(r.nextInvoiceDate)}</span>
                      <span
                        className={
                          r.daysUntilInvoice < 0
                            ? 'text-danger'
                            : r.daysUntilInvoice <= 7
                            ? 'text-warning-emphasis'
                            : 'text-muted'
                        }
                      >
                        {r.daysUntilInvoice < 0
                          ? `due ${Math.abs(r.daysUntilInvoice)}d ago`
                          : r.daysUntilInvoice === 0
                          ? 'today'
                          : `in ${r.daysUntilInvoice}d`}
                        {' · '}
                        {r.invoiceLeadDays}d before
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: 'status',
                title: 'Status',
                icon: 'info_outline',
                width: '1%',
                align: 'center',
                render: (r) => stateBadge(r),
              },
              {
                key: 'autoIssue',
                title: 'Auto',
                icon: 'bolt',
                width: '1%',
                align: 'center',
                hint:
                  "On: the nightly run issues this client's invoice — emailed, texted and payable. " +
                  'Off: it raises a draft for you to check.',
                // Only meaningful once priced — there is nothing to issue automatically.
                render: (r) =>
                  !r.hasPrice ? (
                    <span className="text-muted">—</span>
                  ) : canManage ? (
                    <span className="form-check form-switch d-inline-block m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!r.autoIssue}
                        disabled={autoBusy === r.cusCode}
                        aria-label={`Auto-invoicing for ${r.companyName}`}
                        title={
                          r.autoIssue
                            ? 'On — invoices are issued, emailed and texted without review'
                            : 'Off — invoices are raised as drafts for you to issue'
                        }
                        onChange={() => toggleAuto(r)}
                      />
                    </span>
                  ) : (
                    <span
                      className={`badge ${r.autoIssue ? 'bg-success' : 'bg-secondary'}`}
                      style={{ fontSize: 9 }}
                    >
                      {r.autoIssue ? 'On' : 'Off'}
                    </span>
                  ),
              },
              {
                key: 'paysByStandingOrder',
                title: 'S/O',
                icon: 'event_repeat',
                width: '1%',
                align: 'center',
                hint:
                  'Pays by bank standing order. Their reminders say the payment is expected ' +
                  'rather than overdue, and the chase waits a week before starting — the credit ' +
                  'is usually in transit, and chasing invites a second payment.',
                render: (r) =>
                  canManage ? (
                    <span className="form-check form-switch d-inline-block m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!r.paysByStandingOrder}
                        disabled={autoBusy === r.cusCode}
                        aria-label={`Standing order for ${r.companyName}`}
                        title={
                          r.paysByStandingOrder
                            ? 'On — reminders say the standing order is expected, and the chase waits a week'
                            : 'Off — chased from the due date like any other client'
                        }
                        onChange={() => toggleStandingOrder(r)}
                      />
                    </span>
                  ) : r.paysByStandingOrder ? (
                    <span className="badge bg-info text-dark" style={{ fontSize: 9 }}>
                      Yes
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
            ]}
            actionsLabel="Actions"
            actions={(r) => {
              // Icon-only, with the wording in the tooltip — the label still differs by state.
              const label = canManage
                ? r.hasPrice
                  ? 'Change the price'
                  : 'Set a price'
                : 'Price history'
              return (
                <>
                  <button
                    type="button"
                    className={`cb-act${canManage ? ' cb-act--primary' : ''}`}
                    title={`${label} for ${r.companyName}`}
                    aria-label={`${label} for ${r.companyName}`}
                    onClick={() => navigate(`/billing-profiles/${encodeURIComponent(r.cusCode)}`)}
                  >
                    <span className="material-icons">
                      {canManage ? (r.hasPrice ? 'edit' : 'add') : 'history'}
                    </span>
                  </button>
                  {canManage && r.hasPrice && r.isBillable && (
                    <button
                      type="button"
                      className="cb-act cb-act--danger"
                      title={`Stop billing ${r.companyName}`}
                      aria-label={`Stop billing ${r.companyName}`}
                      onClick={() => stop(r)}
                    >
                      <span className="material-icons">block</span>
                    </button>
                  )}
                </>
              )
            }}
          />
        </div>
      </div>

      {/* Set / change price, with the company's full price history beside it */}
    </>
  )
}

export default BillingProfiles
