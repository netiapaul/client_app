import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import DataTable from '../../components/DataTable'
const axios = require('axios')

/**
 * SMS — the Africa's Talking settings and the outbound queue.
 *
 * Every text costs money, so this screen is built to make that visible rather than to hide it: the
 * sandbox is called out, the segment count sits on each row, and nothing sends until someone has
 * deliberately switched it on.
 *
 * The stored API key is never shown — the server does not return it. Leaving the field blank keeps
 * the key that is already saved.
 */
const STATUS_FILTERS = [
  { key: '', label: 'All', cls: 'is-all', icon: 'sms' },
  { key: 'Sent', label: 'Sent', cls: 'is-sent', icon: 'task_alt' },
  { key: 'Pending', label: 'Pending', cls: 'is-pending', icon: 'pending_actions' },
  { key: 'Failed', label: 'Failed', cls: 'is-failed', icon: 'error_outline' },
  { key: 'Rejected', label: 'Rejected', cls: 'is-failed', icon: 'block' },
]

const STATUS_BADGE = {
  Pending: 'bg-secondary',
  Sent: 'bg-success',
  Failed: 'bg-warning text-dark',
  Rejected: 'bg-dark',
}

const TYPES = [
  { key: '', label: 'All kinds' },
  { key: 'Invoice', label: 'Invoices' },
  { key: 'PaymentReminder', label: 'Reminders' },
  { key: 'PaymentReceipt', label: 'Receipts' },
  { key: 'Test', label: 'Tests' },
]

const Sms = () => {
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Sms`
  // The same right that governs SMTP setup: one person configures messaging, email and SMS alike.
  const canManage = hasModule(MODULES.ManageSmtp)

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const [summary, setSummary] = useState(null)
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [smsType, setSmsType] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Still loaded, but read-only now: the sandbox banner below needs it, and the credentials
  // themselves are edited under Setup.
  const [cfg, setCfg] = useState(null)

  const loadConfig = useCallback(async () => {
    if (!canManage) return
    try {
      const r = await axios.get(`${api}/Config`, { headers: authHeaders() })
      setCfg(r.data)
    } catch (e) {
      setError(readErr(e))
    }
  }, [api, authHeaders, canManage])

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        axios.get(`${api}/Queue`, {
          params: {
            search: search || '',
            status: status || '',
            smsType: smsType || '',
            page,
            pageSize,
          },
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
  }, [api, authHeaders, search, status, smsType, page, pageSize])

  useEffect(() => {
    loadConfig()
  }, [loadConfig])

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

  const fmtWhen = (v) =>
    v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : '—'

  const retry = async (row) => {
    try {
      const r = await axios.post(`${api}/Queue/${row.id}/Retry`, null, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Queued.', { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const sendPending = async () => {
    try {
      const r = await axios.post(`${api}/SendPending`, null, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Done.', { theme: 'colored', autoClose: 5000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  return (
    <>
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">sms</span>
          SMS
          {summary && <span className="cb-page-head__sub">{total} in the queue</span>}
        </h1>
        {canManage && (
          <div className="cb-page-head__actions">
            {summary?.pending > 0 && (
              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                onClick={sendPending}
              >
                Send {summary.pending} waiting
              </button>
            )}
            {/* The credentials live under Setup now — configuration is a once-in-a-while job
                and this screen is read every day. The dot still flags an unconfigured gateway
                here, because the reason nothing is sending belongs next to the queue. */}
            <Link to="/setup?s=sms" className="btn btn-sm cancel-btn rounded-0">
              SMS Settings
              {summary && !summary.configured && <span className="text-danger ms-1">●</span>}
            </Link>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      {/* The two states worth interrupting for: not set up at all, and set up but pointed at the
          sandbox, where everything reports as sent and nothing is delivered. */}
      {summary && !summary.configured && (
        <div className="alert alert-warning rounded-0 py-2 mb-2 cb-fs-body d-flex flex-wrap align-items-center gap-2">
          <span>
            SMS is not set up yet. Messages will still queue — nothing is lost — but nothing is
            delivered until the Africa&apos;s Talking username and API key are saved.
          </span>
          {canManage && (
            <Link to="/setup?s=sms" className="btn btn-sm add-btn rounded-0 ms-auto">
              Set it up
            </Link>
          )}
        </div>
      )}
      {summary?.configured && !summary.enabled && (
        <div className="alert alert-info rounded-0 py-2 mb-2 cb-fs-body">
          SMS is switched off. Messages are queueing and will go out when you switch it on.
        </div>
      )}
      {cfg?.isSandbox && summary?.enabled && (
        <div className="alert alert-warning rounded-0 py-2 mb-2 cb-fs-body">
          <strong>Sandbox.</strong> Messages are being accepted by the Africa&apos;s Talking test
          endpoint and will show as sent, but nothing reaches a real phone. Switch the API URL to
          the live one when you are ready.
        </div>
      )}

      {summary && (
        <div className="email-stats email-stats--five">
          {STATUS_FILTERS.map((f) => {
            const count =
              f.key === ''
                ? summary.pending + summary.sent + summary.failed + summary.rejected
                : f.key === 'Sent'
                ? summary.sent
                : f.key === 'Pending'
                ? summary.pending
                : f.key === 'Failed'
                ? summary.failed
                : summary.rejected
            return (
              <button
                key={f.key || 'all'}
                type="button"
                className={`email-stat ${f.cls}${status === f.key ? ' active' : ''}`}
                aria-pressed={status === f.key}
                title={`Show ${f.key ? f.label.toLowerCase() : 'all'} messages`}
                onClick={() => {
                  setStatus(f.key)
                  setPage(1)
                }}
              >
                <span className="email-stat__icon">
                  <span className="material-icons">{f.icon}</span>
                </span>
                <span className="email-stat__body">
                  <span className="email-stat__value">{count}</span>
                  <span className="email-stat__label">{f.label}</span>
                  {f.key === 'Sent' && (
                    <span className="email-stat__meta">
                      {summary.sentLast30Days} in the last 30 days
                    </span>
                  )}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ---- Queue ---- */}
      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={items}
            rowKey={(r) => r.id}
            loading={loading}
            maxHeight="52vh"
            search={{
              value: search,
              placeholder: 'Search number, name or client code…',
              onChange: (v) => {
                setSearch(v)
                setPage(1)
              },
            }}
            toolbar={
              <select
                className="form-select form-select-sm rounded-0 filter-control"
                style={{ width: 150 }}
                value={smsType}
                aria-label="Filter by message kind"
                onChange={(e) => {
                  setSmsType(e.target.value)
                  setPage(1)
                }}
              >
                {TYPES.map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.label}
                  </option>
                ))}
              </select>
            }
            empty={{
              icon: 'sms',
              title: `No messages${status || smsType || search ? ' in this view' : ' yet'}.`,
              hint: 'Invoices and reminders queue here automatically once SMS is set up.',
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
            columns={[
              {
                key: 'toNumber',
                title: 'To',
                icon: 'smartphone',
                nowrap: true,
                render: (r) => (
                  <>
                    <span className="d-block" style={{ fontFamily: 'Consolas, monospace' }}>
                      {r.toNumber}
                    </span>
                    {(r.companyName || r.toName) && (
                      <span className="d-block text-muted text-truncate" style={{ maxWidth: 160 }}>
                        {r.companyName || r.toName}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'body',
                title: 'Message',
                icon: 'chat_bubble_outline',
                render: (r) => (
                  <>
                    <span className="d-block" style={{ maxWidth: 520 }}>
                      {r.body}
                    </span>
                    {r.errorMessage && (
                      <span className="d-block text-danger">{r.errorMessage}</span>
                    )}
                  </>
                ),
              },
              { key: 'smsType', title: 'Kind', icon: 'label', width: '1%', nowrap: true },
              {
                key: 'segments',
                title: 'Seg',
                icon: 'tag',
                width: '1%',
                align: 'center',
                hint: 'Billable segments. More than one means more than one message charged.',
                render: (r) => (
                  <span className={r.segments > 1 ? 'fw-bold text-warning' : 'text-muted'}>
                    {r.segments}
                  </span>
                ),
              },
              {
                key: 'cost',
                title: 'Cost',
                icon: 'payments',
                width: '1%',
                align: 'right',
                nowrap: true,
                render: (r) => r.cost || '—',
              },
              {
                key: 'createdAt',
                title: 'Created',
                icon: 'schedule',
                width: '1%',
                nowrap: true,
                render: (r) => fmtWhen(r.createdAt),
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
                    title={r.attempts > 0 ? `${r.attempts} attempt(s)` : undefined}
                  >
                    {r.status}
                  </span>
                ),
              },
            ]}
            actions={(r) =>
              canManage && r.status !== 'Sent' && r.status !== 'Pending' ? (
                <button
                  type="button"
                  className="cb-act cb-act--primary"
                  title="Send this message again"
                  aria-label="Send this message again"
                  onClick={() => retry(r)}
                >
                  <span className="material-icons">refresh</span>
                </button>
              ) : null
            }
          />
        </div>
      </div>
    </>
  )
}

export default Sms
