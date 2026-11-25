import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import { formatMoney as money } from '../../utils/money'
import { parseAmount } from '../../utils/money'
import DataTable from '../../components/DataTable'
import useConfirm from '../../components/useConfirm'
import ClientPicker from '../../components/ClientPicker'
import PaymentFlowPanel from '../../components/PaymentFlowPanel'
import usePaymentCheckout from '../../hooks/usePaymentCheckout'
import { Link } from 'react-router-dom'
const axios = require('axios')

/** Payments — the ledger, and the queue of money nobody has placed yet. */
/** NEEDS ATTENTION used to mean "confirmed but not fully placed". */
const VIEWS = [
  { key: '', label: 'All', icon: 'receipt_long' },
  { key: 'unmatched', label: 'Unmatched', icon: 'error_outline' },
  { key: 'credit', label: 'In credit', icon: 'savings' },
  { key: 'pending', label: 'Awaiting clearance', icon: 'hourglass_empty' },
  { key: 'allocated', label: 'Settled', icon: 'task_alt' },
  { key: 'reversed', label: 'Reversed', icon: 'undo' },
]

const STATUS_BADGE = {
  Confirmed: 'bg-success',
  Pending: 'bg-warning text-dark',
  Failed: 'bg-dark',
  Reversed: 'bg-secondary',
}

const Payments = () => {
  // Replaces window.confirm / window.prompt — the browser prefixes those with its own hostname.
  const [confirm, confirmDialog] = useConfirm()
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Payments`
  const canRecord = hasModule(MODULES.RecordPayments)

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  // Memoised because it is handed to usePaymentCheckout.
  const readErr = useCallback(
    (e) => e?.response?.data?.message || e?.message || 'Something went wrong.',
    [],
  )

  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [view, setView] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Simulation. `sim` null means the server has not answered yet.
  const [sim, setSim] = useState(null)
  const [simOpen, setSimOpen] = useState(false)
  const [simForm, setSimForm] = useState({
    cusCode: '',
    method: 'Mpesa',
    amount: '',
    unmatched: false,
  })
  const [simBusy, setSimBusy] = useState(false)
  const [simResults, setSimResults] = useState(null)

  // The other clients one payment also settles.
  const [alsoCovers, setAlsoCovers] = useState([])

  // Clients for the picker, with what each owes — loaded once.
  const [clients, setClients] = useState([])

  // Everyone except the payer, for the "also covers" list.
  const otherClients = useMemo(
    () => clients.filter((c) => c.cusCode !== simForm.cusCode),
    [clients, simForm.cusCode],
  )

  // What a grouped payment would collect if the amount is left blank.
  const groupOutstanding = useMemo(() => {
    const picked = new Set([simForm.cusCode, ...alsoCovers])
    return clients
      .filter((c) => picked.has(c.cusCode))
      .reduce((sum, c) => sum + (c.outstanding ?? 0), 0)
  }, [clients, simForm.cusCode, alsoCovers])

  const [detail, setDetail] = useState(null)

  // The slip/scan behind a payment.
  const [docBusy, setDocBusy] = useState(false)

  const uploadDocument = async (row, file, input) => {
    if (!file) return
    setDocBusy(true)
    setError('')
    try {
      const body = new FormData()
      body.append('file', file)

      // Content-Type is left OFF on purpose.
      const r = await axios.post(`${api}/${row.id}/Document`, body, {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
      })
      toast.success(r.data?.message ?? 'Attached.', { theme: 'colored', autoClose: 6000 })

      // The open panel is patched from the RESPONSE rather than re-fetched.
      setDetail((d) =>
        d && d.id === row.id
          ? {
              ...d,
              hasDocument: true,
              documentName: r.data?.name ?? file.name,
              documentUploadedAt: r.data?.uploadedAt ?? new Date().toISOString(),
            }
          : d,
      )
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setDocBusy(false)
      // Cleared so choosing the SAME file again still fires onChange after a failure.
      if (input) input.value = ''
    }
  }

  const downloadDocument = async (row) => {
    setError('')
    try {
      const r = await axios.get(`${api}/${row.id}/Document`, {
        headers: { Authorization: `Bearer ${getToken()}` },
        responseType: 'blob',
      })
      const url = window.URL.createObjectURL(r.data)
      const a = document.createElement('a')
      a.href = url
      a.download = row.documentName || `${row.paymentNo}-document`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(readErr(e))
    }
  }

  const removeDocument = async (row) => {
    if (
      !(await confirm({
        title: 'Remove this document?',
        body: `${row.documentName} will be deleted from ${row.paymentNo}.`,
        detail:
          'The payment itself is untouched — the money happened whether or not we hold the paper.',
        danger: true,
        confirmText: 'Remove it',
      }))
    )
      return

    setDocBusy(true)
    setError('')
    try {
      const r = await axios.delete(`${api}/${row.id}/Document`, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Removed.', { theme: 'colored', autoClose: 6000 })

      setDetail((d) =>
        d && d.id === row.id
          ? {
              ...d,
              hasDocument: false,
              documentName: null,
              documentUploadedAt: null,
              documentUploadedBy: null,
            }
          : d,
      )
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setDocBusy(false)
    }
  }

  // The step-by-step checkout.
  const checkoutGet = useCallback(
    async (path) => {
      const r = await axios.get(`${api}/Checkout/${path}`, { headers: authHeaders() })
      return r.data
    },
    [api, authHeaders],
  )

  const checkoutPost = useCallback(
    async (path, body) => {
      const r = await axios.post(`${api}/Checkout/${path}`, body ?? null, {
        headers: authHeaders(),
      })
      return r.data
    },
    [api, authHeaders],
  )

  const flow = usePaymentCheckout({
    get: checkoutGet,
    post: checkoutPost,
    readError: readErr,
  })

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        axios.get(api, {
          params: { search: search || '', view: view || '', page, pageSize },
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
  }, [api, authHeaders, readErr, search, view, page, pageSize])

  const loadSim = useCallback(async () => {
    try {
      const r = await axios.get(`${api}/Simulation/Status`, { headers: authHeaders() })
      setSim(r.data)
    } catch {
      // A simulator that cannot be reached simply means no panel.
      setSim({ enabled: false })
    }
  }, [api, authHeaders])

  useEffect(() => {
    const t = setTimeout(() => load(), 250)
    return () => clearTimeout(t)
  }, [load])

  const loadClients = useCallback(async () => {
    try {
      const r = await axios.get(`${api}/Clients`, { headers: authHeaders() })
      setClients(r.data ?? [])
    } catch {
      // The picker simply stays empty; the ledger below is still usable.
    }
  }, [api, authHeaders])

  useEffect(() => {
    loadSim()
    loadClients()
  }, [loadSim, loadClients])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 12000)
      return () => clearTimeout(t)
    }
  }, [error])

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

  const after = async () => {
    await Promise.all([load(), loadSim()])
  }

  const act = async (label, fn) => {
    setError('')
    try {
      const r = await fn()
      toast.success(r?.data?.message ?? `${label} done.`, { theme: 'colored', autoClose: 7000 })
      await after()
      return true
    } catch (e) {
      setError(readErr(e))
      return false
    }
  }

  const clearCheque = async (row) => {
    if (
      !(await confirm({
        title: `Mark ${row.paymentNo} as cleared?`,
        body: `It will be applied to ${
          row.cusCode || 'the client'
        }'s outstanding invoices, and any invoice it settles in full will move their licence forward.`,
        confirmText: 'Mark it cleared',
      }))
    )
      return

    act('Cleared', () => axios.post(`${api}/${row.id}/Clear`, null, { headers: authHeaders() }))
  }

  const reverse = async (row) => {
    const reason = await confirm({
      title: `Reverse ${row.paymentNo}?`,
      body: 'Its allocations are undone and the invoices it settled go back to outstanding.',
      detail: 'A licence expiry it granted is NOT taken back.',
      danger: true,
      confirmText: 'Reverse it',
      input: {
        label: 'Reason',
        placeholder: 'e.g. cheque bounced, paid twice',
        help: 'Kept on the record — required, so the reversal can be explained later.',
      },
    })

    // Null covers both cancelling and leaving it blank. window.prompt returned "" for the second.
    if (!reason) return

    act('Reversed', () =>
      axios.post(`${api}/${row.id}/Reverse`, { reason }, { headers: authHeaders() }),
    )
  }

  const allocate = (row) =>
    act('Allocated', () =>
      axios.post(`${api}/${row.id}/Allocate`, null, { headers: authHeaders() }),
    )

  const match = async (row) => {
    const cusCode = await confirm({
      title: `Which client does ${row.paymentNo} belong to?`,
      body: `They typed "${row.payerReference || '(nothing)'}" as the reference.`,
      confirmText: 'Match it',
      input: {
        label: 'Customer code',
        placeholder: 'CUS0073',
        maxLength: 50,
      },
    })

    if (!cusCode) return
    act('Matched', () =>
      axios.post(`${api}/${row.id}/Match`, { cusCode: cusCode.trim() }, { headers: authHeaders() }),
    )
  }

  // ---- simulation ----

  // The quick paths share the flow's method and amount rather than carrying their own inputs.
  const simulateOne = async () => {
    setSimBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/Simulation`,
        {
          cusCode: simForm.unmatched ? null : simForm.cusCode.trim(),
          method: flow.mode?.method ?? 'Mpesa',
          amount: parseAmount(flow.amount),
          unmatched: simForm.unmatched,
        },
        { headers: authHeaders() },
      )
      setSimResults([r.data])
      toast.success(r.data?.message ?? 'Simulated.', { theme: 'colored', autoClose: 7000 })
      await after()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSimBusy(false)
    }
  }

  const simulateAll = async () => {
    if (!simForm.cusCode.trim()) return setError('Choose a client to simulate against.')
    const amount = parseAmount(flow.amount)
    if (!amount) return setError('Enter an amount for the all-methods run.')

    setSimBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/Simulation/All`,
        { cusCode: simForm.cusCode.trim(), amount },
        { headers: authHeaders() },
      )
      setSimResults(r.data?.results ?? [])
      toast.success(r.data?.message ?? 'Simulated.', { theme: 'colored', autoClose: 8000 })
      await after()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSimBusy(false)
    }
  }

  const purge = async () => {
    if (
      !(await confirm({
        title: `Remove all ${sim?.simulatedPayments ?? 0} simulated payment(s)?`,
        body: 'Their allocations go back to the invoices.',
        detail: 'Any licence expiry they granted STAYS — purging does not roll an expiry back.',
        danger: true,
        confirmText: 'Remove test money',
      }))
    )
      return
    setSimBusy(true)
    try {
      const r = await axios.post(`${api}/Simulation/Purge`, null, { headers: authHeaders() })
      setSimResults(null)
      toast.success(r.data?.message ?? 'Purged.', { theme: 'colored', autoClose: 7000 })
      await after()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSimBusy(false)
    }
  }

  return (
    <>
      {confirmDialog}

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">account_balance_wallet</span>
          Payments
          {summary && <span className="cb-page-head__sub">{total} in the ledger</span>}
        </h1>
        {canRecord && (
          <div className="cb-page-head__actions">
            {sim?.enabled && (
              <button
                type="button"
                className="btn btn-sm cancel-btn rounded-0"
                aria-expanded={simOpen}
                onClick={() => setSimOpen((o) => !o)}
              >
                <span className="material-icons" style={{ fontSize: 14, verticalAlign: -3 }}>
                  science
                </span>{' '}
                Simulate payments
              </button>
            )}
            {/* The credentials themselves live under Setup. */}
            <Link to="/setup?s=mpesa" className="btn btn-sm cancel-btn rounded-0">
              <span className="material-icons" style={{ fontSize: 14, verticalAlign: -3 }}>
                settings
              </span>{' '}
              M-PESA setup
            </Link>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      {/* Test money in the ledger means the totals on this screen are not real. */}
      {summary?.simulated > 0 && (
        <div className="alert alert-warning rounded-0 py-2 mb-2 cb-fs-body d-flex flex-wrap align-items-center gap-2">
          <span className="material-icons" style={{ fontSize: 17 }}>
            science
          </span>
          <span>
            <span className="fw-bold">
              {summary.simulated} of these {summary.total} payments are simulated.
            </span>{' '}
            The totals below include money that never arrived.
          </span>
          {canRecord && sim?.enabled && (
            <button
              type="button"
              className="btn btn-sm delete-btn rounded-0 ms-auto"
              disabled={simBusy}
              onClick={purge}
            >
              Remove test money
            </button>
          )}
        </div>
      )}

      {summary && (
        <div className="email-stats email-stats--six">
          {VIEWS.map((v) => {
            const count =
              v.key === ''
                ? summary.total
                : v.key === 'unmatched'
                ? summary.unmatched
                : v.key === 'credit'
                ? summary.inCredit
                : v.key === 'pending'
                ? summary.awaitingClearance
                : v.key === 'allocated'
                ? summary.confirmed - summary.unallocated
                : summary.reversed
            return (
              <button
                key={v.key || 'all'}
                type="button"
                className={`email-stat ${
                  v.key === 'unmatched'
                    ? 'is-failed'
                    : v.key === 'pending'
                    ? 'is-pending'
                    : v.key === 'allocated'
                    ? 'is-sent'
                    : 'is-all'
                }${view === v.key ? ' active' : ''}`}
                aria-pressed={view === v.key}
                onClick={() => {
                  setView(v.key)
                  setPage(1)
                }}
              >
                <span className="email-stat__icon">
                  <span className="material-icons">{v.icon}</span>
                </span>
                <span className="email-stat__body">
                  <span className="email-stat__value">{count}</span>
                  <span className="email-stat__label">{v.label}</span>
                  {v.key === 'unmatched' && summary.unmatchedTotal > 0 && (
                    <span className="email-stat__meta">
                      {money(summary.unmatchedTotal, summary.currency)} — no client yet
                    </span>
                  )}
                  {/* A BALANCE, not a backlog. */}
                  {v.key === 'credit' && summary.creditTotal > 0 && (
                    <span className="email-stat__meta">
                      {money(summary.creditTotal, summary.currency)} — applied on next invoice
                    </span>
                  )}
                  {v.key === '' && (
                    <span className="email-stat__meta">
                      {money(summary.receivedTotal, summary.currency)} received
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ---- simulation panel ---- */}
      {canRecord && sim?.enabled && simOpen && (
        <div className="cb-card mb-2" style={{ borderColor: '#f0c36d' }}>
          <div className="cb-card__body">
            <div className="d-flex align-items-center justify-content-between flex-wrap gap-2 mb-2">
              <h2 className="cb-fs-section mb-0">
                <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
                  science
                </span>{' '}
                Simulate payments
              </h2>
              <span className="cb-fs-meta text-muted">
                Writes to this ledger through the real engine — validation, allocation and
                settlement all run.
              </span>
            </div>

            {/* The one thing someone must know before clicking. */}
            <div
              className={`alert rounded-0 py-2 cb-fs-body ${
                sim.extendsExpiry ? 'alert-danger' : 'alert-info'
              }`}
            >
              {sim.extendsExpiry ? (
                <>
                  <span className="fw-bold">
                    Payments:Simulation:ExtendExpiry is ON — simulated money WILL move real
                    licences.
                  </span>{' '}
                  Purging the test payments does not roll an expiry back. Turn it off unless you are
                  testing that specifically.
                </>
              ) : (
                <>
                  Simulated payments allocate against invoices but will <strong>not</strong> move
                  any licence expiry. Turn on <code>Payments:Simulation:ExtendExpiry</code> to test
                  that too.
                </>
              )}
            </div>

            <div className="row g-2">
              <div className="col-md-3">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sim-cus">
                  Client
                </label>
                {/* The same picker as Create Client. */}
                <ClientPicker
                  id="sim-cus"
                  options={clients}
                  value={simForm.cusCode}
                  disabled={simForm.unmatched}
                  placeholder="Select a client with a pending invoice…"
                  searchPlaceholder="Search code or company…"
                  emptyText="No client has a pending invoice. Raise one under Billing > Invoices first."
                  getId={(c) => c.cusCode}
                  getLabel={(c) => `${c.cusCode} — ${c.companyName}`}
                  searchFields={[(c) => c.cusCode, (c) => c.companyName]}
                  columns={[
                    { title: 'Code', render: (c) => <strong>{c.cusCode}</strong> },
                    { title: 'Company', render: (c) => c.companyName },
                    {
                      title: 'Outstanding',
                      render: (c) => (
                        <span className="fw-bold">{money(c.outstanding, c.currency)}</span>
                      ),
                    },
                    {
                      title: 'Invoices',
                      render: (c) => c.openInvoices,
                    },
                    {
                      title: 'Oldest due',
                      render: (c) => fmtDate(c.oldestDue),
                    },
                  ]}
                  // Changing the payer clears the extras.
                  onChange={(id) => {
                    setSimForm({ ...simForm, cusCode: id })
                    setAlsoCovers([])
                  }}
                />
              </div>

              <div className="col-md-3 d-flex align-items-end">
                <div className="form-check mb-2">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id="sim-unmatched"
                    checked={simForm.unmatched}
                    onChange={(e) => setSimForm({ ...simForm, unmatched: e.target.checked })}
                  />
                  <label className="form-check-label cb-fs-body" htmlFor="sim-unmatched">
                    Unmatched
                    <span className="d-block cb-fs-meta text-muted">
                      Money with no usable reference, for the matching queue. Skips the flow below —
                      unmatched money arrives from a callback nobody initiated.
                    </span>
                  </label>
                </div>
              </div>

              {/* One payment covering several clients. */}
              {!simForm.unmatched && simForm.cusCode && otherClients.length > 0 && (
                <div className="col-12">
                  <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="sim-also">
                    Also covers
                    <span className="ms-1">
                      — other clients this one payment settles ({alsoCovers.length} selected)
                    </span>
                  </label>

                  <div
                    id="sim-also"
                    className="cb-table-wrap"
                    style={{ maxHeight: 150, overflowY: 'auto' }}
                  >
                    {otherClients.map((c) => (
                      <div key={c.cusCode} className="form-check mb-0 px-2 py-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id={`sim-also-${c.cusCode}`}
                          checked={alsoCovers.includes(c.cusCode)}
                          onChange={(e) =>
                            setAlsoCovers((prev) =>
                              e.target.checked
                                ? [...prev, c.cusCode]
                                : prev.filter((x) => x !== c.cusCode),
                            )
                          }
                        />
                        <label
                          className="form-check-label cb-fs-body"
                          htmlFor={`sim-also-${c.cusCode}`}
                        >
                          <strong>{c.cusCode}</strong> — {c.companyName}
                          <span className="text-muted ms-2">
                            {money(c.outstanding, c.currency)} outstanding
                          </span>
                        </label>
                      </div>
                    ))}
                  </div>

                  {alsoCovers.length > 0 && (
                    <span className="cb-fs-meta text-muted d-block mt-1">
                      One payment of {money(groupOutstanding, 'KES')} would settle{' '}
                      {alsoCovers.length + 1} clients, oldest month first. Leave the amount blank to
                      collect the whole lot.
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* ---- the step-by-step flow ---- */}
            {!simForm.unmatched && (
              <PaymentFlowPanel
                flow={flow}
                cusCode={simForm.cusCode}
                alsoCovers={alsoCovers}
                onSettled={() => {
                  load()
                  loadSim()
                  loadClients()
                  // The extras may have just been settled out of the picker's list entirely.
                  setAlsoCovers([])
                }}
              />
            )}

            <div className="d-flex flex-wrap gap-1 mt-3 pt-2 border-top">
              {/* The quick paths, kept alongside the realistic one. */}
              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                disabled={simBusy}
                onClick={simulateOne}
              >
                {simBusy ? 'Working…' : 'Quick one-shot'}
              </button>
              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                disabled={simBusy || simForm.unmatched}
                title="One payment of every method against this client, skipping the flow"
                onClick={simulateAll}
              >
                Quick all {sim.methods?.length ?? 0} methods
              </button>
              {sim.simulatedPayments > 0 && (
                <button
                  type="button"
                  className="btn btn-sm delete-btn rounded-0 ms-auto"
                  disabled={simBusy}
                  onClick={purge}
                >
                  Purge {sim.simulatedPayments} simulated
                </button>
              )}
            </div>

            {simResults && (
              <div className="cb-table-wrap mt-2" style={{ maxHeight: 220, overflowY: 'auto' }}>
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Method</th>
                      <th style={{ width: '1%' }}>Status</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Amount
                      </th>
                      <th>What happened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {simResults.map((r, i) => (
                      <tr key={i}>
                        <td className="text-nowrap">{r.method}</td>
                        <td>
                          <span
                            className={`badge ${
                              r.status === 'Refused'
                                ? 'bg-danger'
                                : STATUS_BADGE[r.status] ?? 'bg-secondary'
                            }`}
                            style={{ fontSize: 9 }}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="text-end text-nowrap">{money(r.amount, 'KES')}</td>
                        <td className="cb-fs-meta">{r.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- the ledger ---- */}
      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={items}
            rowKey={(r) => r.id}
            loading={loading}
            maxHeight="52vh"
            search={{
              value: search,
              placeholder: 'Search payment no, client code, reference, payer…',
              onChange: (v) => {
                setSearch(v)
                setPage(1)
              },
            }}
            empty={{
              icon: 'account_balance_wallet',
              title: view ? 'Nothing in this view.' : 'No payments yet.',
              hint:
                view === 'unmatched'
                  ? 'Payments that arrived without a usable reference show up here, waiting for someone to say whose they are.'
                  : view === 'credit'
                  ? 'Nobody is in credit. Overpayments appear here and come off the next invoice on their own.'
                  : 'Record one, or simulate payments to try the flow.',
            }}
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
            onRowClick={(r) => setDetail(r)}
            columns={[
              {
                key: 'paymentNo',
                // The CONFIRMATION number.
                title: 'Payment no',
                icon: 'confirmation_number',
                nowrap: true,
                render: (r) => (
                  <>
                    <span className="d-block fw-bold">{r.paymentNo}</span>
                    {r.isSimulated && (
                      <span className="badge bg-warning text-dark" style={{ fontSize: 8 }}>
                        SIMULATED
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'method',
                title: 'Method',
                icon: 'swap_horiz',
                width: '1%',
                nowrap: true,
                render: (r) => (
                  <span className="d-inline-flex align-items-center gap-1">
                    <span className="material-icons" style={{ fontSize: 14 }}>
                      {r.methodIcon}
                    </span>
                    {r.methodName}
                  </span>
                ),
              },
              {
                key: 'cusCode',
                title: 'Client',
                icon: 'apartment',
                render: (r) =>
                  r.cusCode ? (
                    <>
                      <span className="d-block text-truncate" style={{ maxWidth: 180 }}>
                        {r.companyName || r.cusCode}
                      </span>
                      <span className="d-block text-muted">{r.cusCode}</span>
                    </>
                  ) : (
                    <span className="text-danger">
                      unmatched
                      {r.payerReference && (
                        <span className="d-block text-muted">they typed “{r.payerReference}”</span>
                      )}
                    </span>
                  ),
              },
              {
                key: 'amount',
                title: 'Amount',
                icon: 'payments',
                width: '1%',
                align: 'right',
                nowrap: true,
                render: (r) => money(r.amount, r.currency),
              },
              {
                key: 'unallocated',
                title: 'Unplaced',
                icon: 'help_outline',
                width: '1%',
                align: 'right',
                nowrap: true,
                hint: 'Money not yet applied to an invoice — credit, or not yet matched.',
                render: (r) =>
                  r.unallocated > 0 ? (
                    <span className="fw-bold text-warning-emphasis">
                      {money(r.unallocated, r.currency)}
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: 'receivedAt',
                title: 'Received',
                icon: 'event',
                width: '1%',
                nowrap: true,
                render: (r) => fmtDate(r.receivedAt),
              },
              {
                key: 'status',
                title: 'Status',
                icon: 'info_outline',
                width: '1%',
                align: 'center',
                render: (r) => (
                  <span
                    className={`badge ${STATUS_BADGE[r.status] ?? 'bg-secondary'}`}
                    style={{ fontSize: 9 }}
                    title={r.status === 'Pending' ? 'Waiting to clear' : undefined}
                  >
                    {r.status}
                  </span>
                ),
              },
            ]}
            actionsLabel="Actions"
            actions={(r) => (
              <>
                {canRecord && r.status === 'Pending' && (
                  <button
                    type="button"
                    className="cb-act cb-act--success"
                    title={`Mark ${r.paymentNo} cleared and apply it`}
                    aria-label={`Clear ${r.paymentNo}`}
                    onClick={() => clearCheque(r)}
                  >
                    <span className="material-icons">task_alt</span>
                  </button>
                )}
                {canRecord && r.status === 'Confirmed' && !r.cusCode && (
                  <button
                    type="button"
                    className="cb-act cb-act--primary"
                    title="Match this payment to a client"
                    aria-label={`Match ${r.paymentNo}`}
                    onClick={() => match(r)}
                  >
                    <span className="material-icons">link</span>
                  </button>
                )}
                {canRecord && r.status === 'Confirmed' && r.cusCode && r.unallocated > 0 && (
                  <button
                    type="button"
                    className="cb-act cb-act--primary"
                    title="Apply the unplaced balance to outstanding invoices"
                    aria-label={`Allocate ${r.paymentNo}`}
                    onClick={() => allocate(r)}
                  >
                    <span className="material-icons">call_split</span>
                  </button>
                )}
                {canRecord && r.status !== 'Reversed' && (
                  <button
                    type="button"
                    className="cb-act cb-act--danger"
                    title={`Reverse ${r.paymentNo}`}
                    aria-label={`Reverse ${r.paymentNo}`}
                    onClick={() => reverse(r)}
                  >
                    <span className="material-icons">undo</span>
                  </button>
                )}
              </>
            )}
          />
        </div>
      </div>

      {/* ---- one payment in full ---- */}
      <CModal visible={!!detail} onClose={() => setDetail(null)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {detail?.paymentNo}
            {detail?.isSimulated && (
              <span className="badge bg-warning text-dark ms-2" style={{ fontSize: 9 }}>
                SIMULATED
              </span>
            )}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detail && (
            <>
              <div className="row g-2 cb-fs-body mb-3">
                {[
                  ['Method', detail.methodName],
                  ['Amount', money(detail.amount, detail.currency)],
                  ['Applied', money(detail.allocatedAmount, detail.currency)],
                  ['Unplaced', money(detail.unallocated, detail.currency)],
                  ['Client', detail.companyName || detail.cusCode || 'not matched'],
                  ['Received', fmtDate(detail.receivedAt)],
                  ['Cleared', detail.clearedAt ? fmtDate(detail.clearedAt) : 'not cleared'],
                  [
                    detail.methodName === 'Cheque' ? 'Cheque number' : 'Reference',
                    detail.providerReference || '—',
                  ],
                  ['Bank', detail.bankName || '—'],
                  ['Payer', detail.payerName || '—'],
                  ['Phone', detail.payerPhone || '—'],
                  ['Recorded by', detail.recordedBy || '—'],
                ].map(([k, v]) => (
                  <div className="col-sm-4" key={k}>
                    <div className="cb-fs-meta text-muted">{k}</div>
                    <div className="fw-bold">{v}</div>
                  </div>
                ))}
              </div>

              {detail.notes && (
                <div className="alert alert-light rounded-0 py-1 cb-fs-meta">{detail.notes}</div>
              )}

              {/* THE PHYSICAL DOCUMENT — a bank slip, a scanned cheque, a statement line. */}
              <div className="divider mb-2 mt-3">Document</div>
              {detail.hasDocument ? (
                <div className="d-flex flex-wrap gap-2 align-items-center cb-fs-body mb-3">
                  <span className="material-icons" style={{ fontSize: 18 }}>
                    attach_file
                  </span>
                  <span>
                    <strong>{detail.documentName}</strong>
                    <span className="d-block cb-fs-meta text-muted">
                      Attached {fmtDate(detail.documentUploadedAt)}
                      {detail.documentUploadedBy ? ` by ${detail.documentUploadedBy}` : ''}
                    </span>
                  </span>
                  <button
                    type="button"
                    className="btn btn-sm filter-btn rounded-0 ms-auto"
                    onClick={() => downloadDocument(detail)}
                  >
                    Open
                  </button>
                  {canRecord && (
                    <button
                      type="button"
                      className="btn btn-sm delete-btn rounded-0"
                      disabled={docBusy}
                      onClick={() => removeDocument(detail)}
                    >
                      Remove
                    </button>
                  )}
                </div>
              ) : (
                <div className="mb-3">
                  {canRecord ? (
                    <>
                      <input
                        type="file"
                        accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
                        className="form-control form-control-sm rounded-0"
                        disabled={docBusy}
                        onChange={(e) => uploadDocument(detail, e.target.files?.[0], e.target)}
                      />
                      <span className="cb-fs-meta text-muted">
                        {docBusy
                          ? 'Uploading…'
                          : 'Optional. Attach the bank slip, cheque or statement line if you have it — a PDF or a photo, up to 10 MB. It can be added later.'}
                      </span>
                    </>
                  ) : (
                    <span className="cb-fs-meta text-muted">No document attached.</span>
                  )}
                </div>
              )}

              <div className="divider mb-2">Applied to</div>
              {(detail.allocations ?? []).length === 0 ? (
                <div className="cb-empty" style={{ padding: '16px 10px' }}>
                  Not applied to any invoice yet.
                </div>
              ) : (
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Amount
                      </th>
                      <th style={{ width: '1%' }}>How</th>
                      <th style={{ width: '1%' }}>When</th>
                    </tr>
                  </thead>
                  <tbody>
                    {detail.allocations.map((a) => (
                      <tr key={a.id}>
                        <td className="fw-bold">{a.invoiceNo}</td>
                        <td className="text-end text-nowrap">{money(a.amount, detail.currency)}</td>
                        <td className="cb-fs-meta">{a.automatic ? 'automatic' : 'by hand'}</td>
                        <td className="cb-fs-meta text-nowrap">{fmtDate(a.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              <div className="d-flex justify-content-end mt-3">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  onClick={() => setDetail(null)}
                >
                  Close
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default Payments
