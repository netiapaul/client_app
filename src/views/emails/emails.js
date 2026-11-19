import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { getToken } from '../../utils/session'
import moment from 'moment'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG
const PAGE_SIZE = 25

// Status summary tiles that double as the list filter. 'All' clears the filter.
const STATUS_FILTERS = [
  { key: 'All', label: 'Total', cls: 'is-all', icon: 'inbox' },
  { key: 'Sent', label: 'Sent', cls: 'is-sent', icon: 'send' },
  { key: 'Pending', label: 'Pending', cls: 'is-pending', icon: 'clock' },
  { key: 'Failed', label: 'Failed', cls: 'is-failed', icon: 'alert' },
]

// Small inline (Feather-style) icons for the summary tiles — no extra dependency.
const renderStatIcon = (name) => {
  const svg = {
    width: 20,
    height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
  }
  switch (name) {
    case 'inbox':
      return (
        <svg {...svg}>
          <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
          <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
        </svg>
      )
    case 'send':
      return (
        <svg {...svg}>
          <line x1="22" y1="2" x2="11" y2="13" />
          <polygon points="22 2 15 22 11 13 2 9 22 2" />
        </svg>
      )
    case 'clock':
      return (
        <svg {...svg}>
          <circle cx="12" cy="12" r="10" />
          <polyline points="12 6 12 12 16 14" />
        </svg>
      )
    case 'alert':
      return (
        <svg {...svg}>
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      )
    default:
      return null
  }
}

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

const statusBadge = (status) => {
  const map = {
    Sent: { bg: '#1e7e34', label: 'Sent' },
    Pending: { bg: '#6c757d', label: 'Pending' },
    Failed: { bg: '#c0392b', label: 'Failed' },
  }
  const s = map[status] || { bg: '#6c757d', label: status }
  return (
    <span
      style={{
        background: s.bg,
        color: '#fff',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 3,
        fontWeight: 600,
      }}
    >
      {s.label}
    </span>
  )
}

const Emails = () => {
  const [items, setItems] = useState([])
  const [configured, setConfigured] = useState(true)
  const [summary, setSummary] = useState({ total: 0, sent: 0, pending: 0, failed: 0 })
  const [statusFilter, setStatusFilter] = useState('All')
  const [searchInput, setSearchInput] = useState('') // what the user is typing
  const [search, setSearch] = useState('') // debounced term sent to the API
  const [page, setPage] = useState(1)
  const [total, setTotal] = useState(0)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')
  const [busy, setBusy] = useState(false)

  const err = (e) => setError(readErr(e))
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 5000)
  }

  const load = useCallback(async () => {
    setError('')
    try {
      const r = await axios.get(
        `${BASE_URL}/api/Email/Queue?status=${encodeURIComponent(
          statusFilter,
        )}&search=${encodeURIComponent(search)}&page=${page}&pageSize=${PAGE_SIZE}`,
        { headers: authHeaders() },
      )
      setItems(r.data?.items ?? [])
      setConfigured(r.data?.configured ?? false)
      setSummary(r.data?.summary ?? { total: 0, sent: 0, pending: 0, failed: 0 })
      setTotal(r.data?.total ?? 0)
    } catch (e) {
      err(e)
    }
  }, [statusFilter, search, page])

  useEffect(() => {
    load()
  }, [load])

  // Debounce the search box: apply the typed term 300ms after the last keystroke and jump to page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchInput])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  // If the filtered total shrinks below the current page (e.g. after Resend Failed empties the
  // Failed view), snap back to the last valid page — which reloads at a sensible position.
  useEffect(() => {
    if (page > totalPages) setPage(totalPages)
  }, [page, totalPages])

  const applyFilter = (key) => {
    setStatusFilter(key)
    setPage(1)
  }

  const sendPending = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/SendPending`,
        {},
        { headers: authHeaders() },
      )
      flash(`Sent ${r.data?.sent ?? 0} pending email(s).`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const resend = async (id) => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/Resend/${id}`,
        {},
        { headers: authHeaders() },
      )
      flash(`Email #${id} requeued${r.data?.sent ? ` and sent` : ''}.`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const resendFailed = async () => {
    setBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${BASE_URL}/api/Email/ResendFailed`,
        {},
        { headers: authHeaders() },
      )
      flash(`Requeued ${r.data?.requeued ?? 0} failed, sent ${r.data?.sent ?? 0}.`)
      await load()
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  // Fetch the rendered HTML (auth-protected) and show it in a new window.
  const preview = async (id) => {
    setError('')
    try {
      const r = await axios.get(`${BASE_URL}/api/Email/Preview/${id}`, {
        headers: { Authorization: `Bearer ${getToken()}` },
      })
      const w = window.open('', '_blank')
      if (w) {
        w.document.open()
        w.document.write(r.data)
        w.document.close()
      }
    } catch (e) {
      err(e)
    }
  }

  const rangeStart = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1
  const rangeEnd = Math.min(page * PAGE_SIZE, total)

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">Email Tracking</h6>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={load}
            disabled={busy}
            type="button"
          >
            Refresh
          </button>
          <button
            className="btn btn-sm add-btn rounded-0"
            onClick={sendPending}
            disabled={busy || !configured}
            type="button"
          >
            Send Pending
          </button>
          <button
            className="btn btn-sm add-btn rounded-0"
            onClick={resendFailed}
            disabled={busy || !configured || summary.failed === 0}
            type="button"
          >
            Resend Failed ({summary.failed})
          </button>
          {/* The server settings live under Setup now — configuration is a once-in-a-while job
              and this screen is read every day. A link rather than a panel, so anyone who came
              here looking for it still finds it. */}
          <Link to="/setup?s=email" className="btn btn-sm cancel-btn rounded-0">
            SMTP Settings
          </Link>
        </div>
      </div>
      <hr className="my-2" />

      {!configured && (
        <div className="alert alert-warning rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          SMTP is not configured — set it up under <Link to="/setup?s=email">Setup</Link>. New
          emails are stored as <strong>Failed</strong> until it is configured; once set up, use{' '}
          <strong>Resend Failed</strong> to send them.
        </div>
      )}
      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}
      {msg && (
        <div className="alert alert-success rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          {msg}
        </div>
      )}

      {/* Status summary — each tile filters the list; the active one is highlighted. */}
      <div className="email-stats">
        {STATUS_FILTERS.map((c) => {
          const count =
            c.key === 'All'
              ? summary.total
              : c.key === 'Sent'
              ? summary.sent
              : c.key === 'Pending'
              ? summary.pending
              : summary.failed
          const active = statusFilter === c.key
          const pct =
            c.key !== 'All' && summary.total > 0 ? Math.round((count / summary.total) * 100) : null
          return (
            <div
              key={c.key}
              className={`email-stat ${c.cls}${active ? ' active' : ''}`}
              onClick={() => applyFilter(c.key)}
              onKeyDown={(ev) => {
                if (ev.key === 'Enter' || ev.key === ' ') {
                  ev.preventDefault()
                  applyFilter(c.key)
                }
              }}
              role="button"
              tabIndex={0}
              aria-pressed={active}
              title={`Show ${c.key === 'All' ? 'all' : c.label.toLowerCase()} emails`}
            >
              <span className="email-stat__icon">{renderStatIcon(c.icon)}</span>
              <span className="email-stat__body">
                <span className="email-stat__value">{count.toLocaleString()}</span>
                <span className="email-stat__label">{c.label}</span>
                <span className="email-stat__meta">
                  {pct !== null ? `${pct}% of total` : 'all emails'}
                </span>
              </span>
              {pct !== null && (
                <span className="email-stat__bar">
                  <span className="email-stat__bar-fill" style={{ width: `${pct}%` }} />
                </span>
              )}
            </div>
          )
        })}
      </div>

      {/* Search toolbar */}
      <div className="d-flex justify-content-between align-items-center mb-2 flex-wrap gap-2">
        <div style={{ position: 'relative', maxWidth: 340, width: '100%' }}>
          <span
            style={{
              position: 'absolute',
              left: 10,
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#8a94a6',
              pointerEvents: 'none',
              display: 'flex',
            }}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
          </span>
          <input
            className="form-control form-control-sm rounded-0"
            style={{ paddingLeft: 32, paddingRight: 26 }}
            placeholder="Search recipient, subject, client or type…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            aria-label="Search email queue"
          />
          {searchInput && (
            <button
              type="button"
              onClick={() => setSearchInput('')}
              title="Clear search"
              style={{
                position: 'absolute',
                right: 6,
                top: '50%',
                transform: 'translateY(-50%)',
                border: 'none',
                background: 'transparent',
                color: '#8a94a6',
                fontSize: 16,
                lineHeight: 1,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              ×
            </button>
          )}
        </div>
        {search && (
          <span className="text-muted" style={{ fontSize: 11 }}>
            {total} result{total === 1 ? '' : 's'} for “{search}”
          </span>
        )}
      </div>

      <div className="card rounded-0">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0" style={{ fontSize: 10 }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>Type</th>
                <th>To</th>
                <th>Subject</th>
                <th>Client</th>
                <th style={{ width: '1%' }}>Status</th>
                <th style={{ width: '1%', textAlign: 'center' }}>Att.</th>
                <th>Created</th>
                <th>Sent</th>
                <th>Error</th>
                <th style={{ width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={11} className="text-muted text-center py-3">
                    {search
                      ? `No emails match “${search}”${
                          statusFilter === 'All' ? '' : ` with status ${statusFilter}`
                        }.`
                      : statusFilter === 'All'
                      ? 'No emails yet.'
                      : `No ${statusFilter.toLowerCase()} emails.`}
                  </td>
                </tr>
              )}
              {items.map((e, idx) => (
                <tr
                  key={e.id}
                  onClick={() => preview(e.id)}
                  style={{ cursor: 'pointer' }}
                  title="Click to preview"
                >
                  <td>{(page - 1) * PAGE_SIZE + idx + 1}</td>
                  <td>{e.emailType}</td>
                  <td>{e.toAddress}</td>
                  <td>{e.subject}</td>
                  <td>
                    {e.relatedClientName ? (
                      <>
                        <div style={{ fontWeight: 600 }}>{e.relatedClientName}</div>
                        {e.relatedCusCode && (
                          <div className="text-muted" style={{ fontSize: 9 }}>
                            {e.relatedCusCode}
                          </div>
                        )}
                      </>
                    ) : (
                      e.relatedCusCode || '—'
                    )}
                  </td>
                  <td>{statusBadge(e.status)}</td>
                  <td style={{ textAlign: 'center' }}>{e.attempts}</td>
                  <td>{e.createdAt ? moment(e.createdAt).format('DD/MM/YY HH:mm') : ''}</td>
                  <td>{e.sentAt ? moment(e.sentAt).format('DD/MM/YY HH:mm') : ''}</td>
                  <td style={{ maxWidth: 240, color: '#c0392b' }} title={e.errorMessage || ''}>
                    {e.errorMessage
                      ? e.errorMessage.length > 60
                        ? e.errorMessage.slice(0, 60) + '…'
                        : e.errorMessage
                      : ''}
                  </td>
                  <td style={{ whiteSpace: 'nowrap' }}>
                    <button
                      className="btn btn-sm cancel-btn rounded-0 me-1"
                      style={{ fontSize: 11, padding: '1px 8px' }}
                      onClick={(ev) => {
                        ev.stopPropagation()
                        preview(e.id)
                      }}
                      type="button"
                    >
                      Preview
                    </button>
                    {e.status !== 'Sent' && (
                      <button
                        className="btn btn-sm add-btn rounded-0"
                        style={{ fontSize: 11, padding: '1px 8px' }}
                        onClick={(ev) => {
                          ev.stopPropagation()
                          resend(e.id)
                        }}
                        disabled={busy || !configured}
                        type="button"
                      >
                        Resend
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div
        className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2"
        style={{ fontSize: 12 }}
      >
        <span className="text-muted">
          {total === 0 ? 'No emails' : `Showing ${rangeStart}–${rangeEnd} of ${total}`}
          {statusFilter !== 'All' ? ` ${statusFilter.toLowerCase()}` : ''}
        </span>
        <div className="d-flex align-items-center gap-2">
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setPage(1)}
            disabled={busy || page <= 1}
            type="button"
          >
            « First
          </button>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={busy || page <= 1}
            type="button"
          >
            ‹ Prev
          </button>
          <span className="text-muted">
            Page {page} of {totalPages}
          </span>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={busy || page >= totalPages}
            type="button"
          >
            Next ›
          </button>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setPage(totalPages)}
            disabled={busy || page >= totalPages}
            type="button"
          >
            Last »
          </button>
        </div>
      </div>
    </>
  )
}

export default Emails
