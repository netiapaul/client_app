import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
const axios = require('axios')

/**
 * The main system push queue.
 *
 * The only place that answers "has the main system been told?". A push lives neither on the
 * invoice nor on the payment nor in a log anybody reads, so without this screen a document that
 * never reached the books is invisible.
 */
const api = `${process.env.REACT_APP_URL_CONFIG}/api/MainSystem`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

/** Status -> how it reads and what colour it carries. */
const STATUS = {
  Pending: {
    label: 'Waiting',
    cls: 'bg-info',
    help: 'Queued, or failed and waiting to be retried. The job will pick it up.',
  },
  Sent: { label: 'Sent', cls: 'bg-success', help: 'The main system accepted it.' },
  Failed: {
    label: 'Refused',
    cls: 'bg-danger',
    // The distinction that decides what to do about it.
    help: 'The main system understood it and said no. Not retried automatically — fix the cause, then Retry.',
  },
  Abandoned: {
    label: 'Gave up',
    cls: 'bg-warning text-dark',
    help: 'Their server never answered, after a day of retries. Retry once it is back.',
  },
}

const when = (d) => (d ? new Date(d).toLocaleString() : '—')

const MainSystemOutbox = () => {
  const [page, setPage] = useState(null)
  const [loading, setLoading] = useState(false)
  const [draining, setDraining] = useState(false)
  const [retrying, setRetrying] = useState(0)
  const [filter, setFilter] = useState('')
  const [detail, setDetail] = useState(null)
  const [error, setError] = useState('')

  const canManage = hasModule(MODULES.ManageBilling)

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(`${api}/Outbox`, {
        headers: authHeaders(),
        params: filter ? { status: filter } : {},
      })
      setPage(r.data ?? null)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [filter])

  useEffect(() => {
    load()
  }, [load])

  const drain = async () => {
    setDraining(true)
    setError('')
    try {
      const r = await axios.post(`${api}/Outbox/Drain`, null, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Done.', { theme: 'colored', autoClose: 8000 })

      // Each note names a document that was skipped or whose tax invoice came back with it.
      ;(r.data?.notes ?? []).forEach((n) => toast.info(n, { theme: 'colored', autoClose: 12000 }))

      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setDraining(false)
    }
  }

  const retry = async (id) => {
    setRetrying(id)
    setError('')
    try {
      const r = await axios.post(`${api}/Outbox/${id}/Retry`, null, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Queued.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setRetrying(0)
    }
  }

  const openDetail = async (id) => {
    setError('')
    try {
      const r = await axios.get(`${api}/Outbox/${id}`, { headers: authHeaders() })
      setDetail(r.data ?? null)
    } catch (e) {
      setError(readErr(e))
    }
  }

  const tile = (key, value, cls) => (
    <button
      type="button"
      key={key}
      className={`email-stat ${filter === key ? 'email-stat--active' : ''}`}
      onClick={() => setFilter(filter === key ? '' : key)}
      title={STATUS[key]?.help}
    >
      <span className="email-stat__value">{value ?? 0}</span>
      <span className="email-stat__label">
        <span className={`badge ${cls} rounded-0`} style={{ fontSize: 9 }}>
          {STATUS[key]?.label ?? key}
        </span>
      </span>
    </button>
  )

  return (
    <>
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">hub</span>
          Main System Queue
        </h1>
      </div>

      <p className="cb-fs-meta text-muted">
        Issued proformas and confirmed payments waiting to reach the main system. Anything other
        than <strong>Sent</strong> means a document has not reached the books.
      </p>

      {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

      <div className="email-stats mb-2">
        {tile('Pending', page?.pending, 'bg-info')}
        {tile('Sent', page?.sent, 'bg-success')}
        {tile('Failed', page?.failed, 'bg-danger')}
        {tile('Abandoned', page?.abandoned, 'bg-warning text-dark')}
      </div>

      {page?.needsAttention > 0 && (
        <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
          <strong>{page.needsAttention}</strong> push(es) have not reached the main system. If the
          integration is switched off or half-configured they are simply waiting, and will go once
          it is set up.
        </div>
      )}

      <div className="d-flex flex-wrap gap-1 mb-2">
        <button
          type="button"
          className="btn btn-sm filter-btn rounded-0"
          disabled={loading}
          onClick={load}
        >
          {loading ? 'Loading…' : 'Refresh'}
        </button>

        {canManage && (
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0"
            disabled={draining}
            title="Sends everything that is due now, instead of waiting for the next cycle."
            onClick={drain}
          >
            {draining ? 'Sending…' : 'Send now'}
          </button>
        )}

        {filter && (
          <button
            type="button"
            className="btn btn-sm filter-btn rounded-0"
            onClick={() => setFilter('')}
          >
            Clear filter
          </button>
        )}
      </div>

      <div className="table-responsive">
        <table className="table table-sm table-hover cb-fs-body align-middle">
          <thead>
            <tr>
              <th>Document</th>
              <th>Kind</th>
              <th>Status</th>
              <th className="text-end">Tries</th>
              <th>Queued</th>
              <th>Sent</th>
              <th>Their ref</th>
              <th>Problem</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {(page?.rows ?? []).length === 0 && !loading && (
              <tr>
                <td colSpan={9} className="text-center text-muted cb-fs-meta py-3">
                  Nothing queued. Every issued proforma and confirmed payment has reached the main
                  system.
                </td>
              </tr>
            )}

            {(page?.rows ?? []).map((r) => {
              const s = STATUS[r.status] ?? { label: r.status, cls: 'bg-secondary' }
              return (
                <tr key={r.id}>
                  <td className="fw-bold">{r.reference || `#${r.entityId}`}</td>
                  <td>{r.kind === 'Proforma' ? 'Proforma' : 'Payment'}</td>
                  <td>
                    <span className={`badge ${s.cls} rounded-0`} style={{ fontSize: 10 }}>
                      {s.label}
                    </span>
                  </td>
                  <td className="text-end">{r.attempts}</td>
                  <td className="cb-fs-meta">{when(r.createdAt)}</td>
                  <td className="cb-fs-meta">{when(r.sentAt)}</td>
                  <td className="cb-fs-meta">{r.mainSystemRef || '—'}</td>
                  <td
                    className="cb-fs-meta text-muted"
                    style={{ maxWidth: 320 }}
                    title={r.lastError || ''}
                  >
                    {r.lastError
                      ? r.lastError.length > 90
                        ? `${r.lastError.slice(0, 90)}…`
                        : r.lastError
                      : '—'}
                  </td>
                  <td className="text-end text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm filter-btn rounded-0 me-1"
                      onClick={() => openDetail(r.id)}
                    >
                      Details
                    </button>
                    {canManage && r.canRetry && (
                      <button
                        type="button"
                        className="btn btn-sm add-btn rounded-0"
                        disabled={retrying === r.id}
                        title="Puts it back in the queue. The idempotency key is kept, so the main system still recognises it as the same document."
                        onClick={() => retry(r.id)}
                      >
                        {retrying === r.id ? '…' : 'Retry'}
                      </button>
                    )}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* What we sent and what they said, verbatim. */}
      {detail && (
        <div className="card rounded-0 mt-2">
          <div
            className="card-header py-2 d-flex justify-content-between align-items-center"
            style={{ fontSize: 13, fontWeight: 600 }}
          >
            <span>
              {detail.reference || `#${detail.entityId}`} — {detail.kind}
            </span>
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              onClick={() => setDetail(null)}
            >
              Close
            </button>
          </div>
          <div className="card-body">
            <div className="cb-fs-meta text-muted mb-2">
              Request id <code>{detail.requestId}</code> — resent unchanged on every retry, so the
              main system can recognise a repeat rather than raising a second document.
            </div>

            {detail.lastError && (
              <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{detail.lastError}</div>
            )}

            <label className="cb-fs-meta text-muted d-block">What we sent</label>
            <pre
              className="bg-light p-2 rounded-0 cb-fs-meta"
              style={{ maxHeight: 260, overflow: 'auto' }}
            >
              {detail.payload || '—'}
            </pre>

            <label className="cb-fs-meta text-muted d-block mt-2">What they answered</label>
            <pre
              className="bg-light p-2 rounded-0 cb-fs-meta"
              style={{ maxHeight: 200, overflow: 'auto' }}
            >
              {detail.responseBody || '—'}
            </pre>
          </div>
        </div>
      )}
    </>
  )
}

export default MainSystemOutbox
