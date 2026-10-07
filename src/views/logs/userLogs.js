import React, { useState, useEffect } from 'react'
import { getToken } from '../../utils/session'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CPagination,
  CPaginationItem,
} from '@coreui/react'
import moment from 'moment'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

const actionBadge = (a) => {
  const map = {
    Added: '#1e7e34',
    Modified: '#2f6fb3',
    Deleted: '#c0392b',
  }
  return (
    <span
      style={{
        background: map[a] || '#6c757d',
        color: '#fff',
        fontSize: 11,
        padding: '2px 8px',
        borderRadius: 3,
        fontWeight: 600,
      }}
    >
      {a}
    </span>
  )
}

const prettyJson = (s) => {
  if (!s) return ''
  try {
    return JSON.stringify(JSON.parse(s), null, 1)
  } catch {
    return s
  }
}

const UserLogs = () => {
  const [items, setItems] = useState([])
  const [modules, setModules] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState(null) // the log entry shown in the details modal
  const today = moment().format('YYYY-MM-DD')
  const [filter, setFilter] = useState({
    username: '',
    module: '',
    action: '',
    from: '',
    to: today,
  })
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [total, setTotal] = useState(0)

  // Server-side paged load (lazy loading): fetch only the requested page + the total count.
  const load = async (p = 1, size = pageSize) => {
    setBusy(true)
    setError('')
    try {
      const params = { page: p, pageSize: size }
      if (filter.username) params.username = filter.username
      if (filter.module) params.module = filter.module
      if (filter.action) params.action = filter.action
      if (filter.from) params.from = filter.from
      if (filter.to) params.to = filter.to
      const r = await axios.get(`${BASE_URL}/api/UserLogs`, { headers: authHeaders(), params })
      setItems(r.data?.items ?? [])
      setTotal(r.data?.total ?? 0)
      setPage(p)
      setPageSize(size)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    // initial load + module list
    load(1)
    axios
      .get(`${BASE_URL}/api/UserLogs/Modules`, { headers: authHeaders() })
      .then((r) => setModules(r.data ?? []))
      .catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalPages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">User Audit Logs</h6>
        <span className="text-muted" style={{ fontSize: 11 }}>
          {total} entries
        </span>
      </div>
      <hr className="my-2" />

      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}

      <div className="card rounded-0 mb-2">
        <div className="card-body py-2">
          <div className="row g-2 align-items-end" style={{ fontSize: 12 }}>
            <div className="col-md-3">
              <label className="form-label mb-0">User (name / email)</label>
              <input
                className="form-control form-control-sm rounded-0"
                value={filter.username}
                onChange={(e) => setFilter({ ...filter, username: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">Module</label>
              <select
                className="form-select form-select-sm rounded-0"
                value={filter.module}
                onChange={(e) => setFilter({ ...filter, module: e.target.value })}
              >
                <option value="">All</option>
                {modules.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">Action</label>
              <select
                className="form-select form-select-sm rounded-0"
                value={filter.action}
                onChange={(e) => setFilter({ ...filter, action: e.target.value })}
              >
                <option value="">All</option>
                <option value="Added">Added</option>
                <option value="Modified">Modified</option>
                <option value="Deleted">Deleted</option>
              </select>
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">From</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-0"
                value={filter.from}
                onChange={(e) => setFilter({ ...filter, from: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">To</label>
              <input
                type="date"
                className="form-control form-control-sm rounded-0"
                value={filter.to}
                onChange={(e) => setFilter({ ...filter, to: e.target.value })}
              />
            </div>
            <div className="col-md-1">
              <button
                className="btn btn-sm add-btn rounded-0 w-100"
                onClick={() => load(1)}
                disabled={busy}
                type="button"
              >
                {busy ? '…' : 'Filter'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="card rounded-0">
        <div className="table-responsive">
          <table className="table table-sm table-hover mb-0" style={{ fontSize: 10 }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>When</th>
                <th>User</th>
                <th>Action</th>
                <th>Module</th>
                <th>Ref</th>
                <th>Company</th>
                <th>IP</th>
                <th style={{ width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={9} className="text-muted text-center py-3">
                    No log entries for the selected filters.
                  </td>
                </tr>
              )}
              {items.map((l, idx) => (
                <tr
                  key={l.id}
                  onClick={() => setDetail(l)}
                  style={{ cursor: 'pointer' }}
                  title="Click to view details"
                >
                  <td>{(page - 1) * pageSize + idx + 1}</td>
                  <td>{moment(l.createdAt).format('DD/MM/YY HH:mm:ss')}</td>
                  <td title={l.email}>{l.userName || l.email}</td>
                  <td>{actionBadge(l.actionType)}</td>
                  <td>{l.moduleName}</td>
                  <td>{l.referenceId}</td>
                  <td>{l.company}</td>
                  <td>{l.ipAddress}</td>
                  <td>
                    <button
                      className="btn btn-sm cancel-btn rounded-0"
                      style={{ fontSize: 11, padding: '1px 8px' }}
                      onClick={() => setDetail(l)}
                      type="button"
                    >
                      Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination (server-side) */}
      <div
        className="d-flex justify-content-between align-items-center mt-2 flex-wrap gap-2"
        style={{ fontSize: 11 }}
      >
        <div className="d-flex align-items-center gap-2">
          <span className="text-muted">Rows per page</span>
          <select
            className="form-select form-select-sm rounded-0"
            style={{ width: 70 }}
            value={pageSize}
            onChange={(e) => load(1, Number(e.target.value))}
            disabled={busy}
          >
            {[25, 50, 100].map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
          <span className="text-muted">
            {total === 0 ? '0' : `${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)}`}{' '}
            of {total}
          </span>
        </div>
        <CPagination size="sm" className="mb-0">
          <CPaginationItem role="button" disabled={page <= 1 || busy} onClick={() => load(1)}>
            «
          </CPaginationItem>
          <CPaginationItem
            role="button"
            disabled={page <= 1 || busy}
            onClick={() => load(page - 1)}
          >
            ‹
          </CPaginationItem>
          <CPaginationItem disabled>{`Page ${page} of ${totalPages}`}</CPaginationItem>
          <CPaginationItem
            role="button"
            disabled={page >= totalPages || busy}
            onClick={() => load(page + 1)}
          >
            ›
          </CPaginationItem>
          <CPaginationItem
            role="button"
            disabled={page >= totalPages || busy}
            onClick={() => load(totalPages)}
          >
            »
          </CPaginationItem>
        </CPagination>
      </div>

      {/* Log details modal */}
      <CModal
        visible={!!detail}
        onClose={() => setDetail(null)}
        size="lg"
        alignment="center"
        scrollable
      >
        <CModalHeader>
          <CModalTitle style={{ fontSize: 15 }}>
            Log #{detail?.id} — {detail?.moduleName}
          </CModalTitle>
        </CModalHeader>
        <CModalBody style={{ fontSize: 12 }}>
          {detail && (
            <>
              <div className="log-meta mb-3">
                <div className="log-meta-item">
                  <div className="log-meta-label">When</div>
                  <div className="log-meta-value">
                    {moment(detail.createdAt).format('DD/MM/YYYY HH:mm:ss')}
                  </div>
                </div>
                <div className="log-meta-item">
                  <div className="log-meta-label">User</div>
                  <div className="log-meta-value" title={detail.email}>
                    {detail.userName || detail.email || '—'}
                  </div>
                </div>
                <div className="log-meta-item">
                  <div className="log-meta-label">Action</div>
                  <div className="log-meta-value">{actionBadge(detail.actionType)}</div>
                </div>
                <div className="log-meta-item">
                  <div className="log-meta-label">Module</div>
                  <div className="log-meta-value">{detail.moduleName || '—'}</div>
                </div>
                <div className="log-meta-item">
                  <div className="log-meta-label">Company</div>
                  <div className="log-meta-value">{detail.company || '—'}</div>
                </div>
                <div className="log-meta-item">
                  <div className="log-meta-label">IP</div>
                  <div className="log-meta-value">{detail.ipAddress || '—'}</div>
                </div>
                <div className="log-meta-item log-meta-wide">
                  <div className="log-meta-label">Reference</div>
                  <div className="log-meta-value">{detail.referenceId || '—'}</div>
                </div>
                <div className="log-meta-item log-meta-wide">
                  <div className="log-meta-label">Device</div>
                  <div className="log-meta-value">{detail.deviceInfo || '—'}</div>
                </div>
              </div>
              <div className="row g-3">
                <div className="col-md-6">
                  <div className="log-section-title">Old values</div>
                  <pre className="log-json">{prettyJson(detail.oldValues) || '—'}</pre>
                </div>
                <div className="col-md-6">
                  <div className="log-section-title">New values</div>
                  <pre className="log-json">{prettyJson(detail.newValues) || '—'}</pre>
                </div>
              </div>
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <button
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setDetail(null)}
            type="button"
          >
            Close
          </button>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default UserLogs
