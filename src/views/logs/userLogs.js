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

const parseObj = (s) => {
  if (!s) return {}
  try {
    return JSON.parse(s)
  } catch {
    return {}
  }
}

const fmtVal = (v) => {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'boolean') return v ? 'Yes' : 'No'
  if (typeof v === 'object') return JSON.stringify(v)
  const s = String(v)
  // tidy ISO date-times → DD/MM/YYYY HH:mm:ss
  const m = s.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}:\d{2}:\d{2})/)
  return m ? `${m[3]}/${m[2]}/${m[1]} ${m[4]}` : s
}

// Field-by-field diff of the old/new JSON snapshots the audit stores.
const diffRows = (oldV, newV) => {
  const o = parseObj(oldV)
  const n = parseObj(newV)
  const keys = Array.from(new Set([...Object.keys(o), ...Object.keys(n)]))
  return keys.map((k) => ({
    field: k,
    oldVal: o[k],
    newVal: n[k],
    changed: JSON.stringify(o[k] ?? null) !== JSON.stringify(n[k] ?? null),
  }))
}

// ---- Humanising the raw audit data for a non-technical reader --------------------
// The audit stores raw entity/property names; map the common ones to plain labels and
// hide internal plumbing fields so the listing reads like a sentence, not a DB dump.

// camelCase / PascalCase / snake_case  ->  "Spaced words"
const prettify = (s) =>
  String(s)
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/_/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^./, (c) => c.toUpperCase())
    .replace(/\bId\b/gi, 'ID')

const MODULE_LABELS = {
  ClientProvisioning: 'Client provisioning',
  ChangeRequest: 'Approval request',
  ClientDetail: 'Client',
  ClientDetails: 'Client',
  CompanyDetail: 'Company',
  ServerConfiguration: 'Server',
  SmtpConfig: 'Email settings',
  User: 'User',
}
const friendlyModule = (m) => MODULE_LABELS[m] || prettify(m)

const FIELD_LABELS = {
  CurrentStep: 'Stage',
  DbName: 'Database',
  ResolvedByEmail: 'Approved by',
  ResolvedAt: 'Approved on',
  ErrorMessage: 'Error',
  CusCode: 'Customer code',
  PackageCode: 'Package',
  UserCount: 'Users',
  AdminUsername: 'Admin username',
  AdminFullName: 'Admin name',
  AdminCellnumber: 'Admin phone',
  AdminEmail: 'Admin email',
  CompanyName: 'Company',
  CompanyEmail: 'Company email',
  CompanyPhone: 'Phone',
  ExpiryDate: 'Expires',
  ActivateDate: 'Activated',
  ExpiresAt: 'Link expires',
  CanApprove: 'Can approve',
  PhysicalAddress: 'Address',
  TownName: 'Town',
  PinNo: 'PIN',
  VatNo: 'VAT',
}
const friendlyField = (f) => FIELD_LABELS[f] || prettify(f)

// Best-effort client name for the row: the Company column, else a name carried in the
// change values (ChangeRequest rows keep the client inside their serialized payload).
const clientNameOf = (l) => {
  const direct = (l.company || '').trim()
  if (direct) return direct
  const vals = { ...parseObj(l.oldValues), ...parseObj(l.newValues) }
  for (const k of ['CompanyName', 'PsCompanyName', 'Company']) {
    if (vals[k]) return String(vals[k])
  }
  if (vals.PayloadJson) {
    const p = parseObj(vals.PayloadJson)
    for (const k of ['CompanyName', 'PsCompanyName', 'CusCode']) {
      if (p[k]) return String(p[k])
    }
  }
  return ''
}

// The resulting Status value of a change (or null) — drives the activity wording.
const statusOf = (l) => {
  const st = diffRows(l.oldValues, l.newValues).find(
    (r) => String(r.field).toLowerCase() === 'status' && (l.actionType !== 'Modified' || r.changed),
  )
  if (!st) return null
  return String(fmtVal(l.actionType === 'Deleted' ? st.oldVal : st.newVal)).toLowerCase()
}

// One short plain-English sentence describing what happened (no raw fields, no JSON).
// Full before/after detail stays in the row's popup.
const activityText = (l) => {
  const name = clientNameOf(l)
  const forName = name ? ` '${name}'` : ''
  const act = l.actionType
  const status = statusOf(l) || ''

  switch (l.moduleName) {
    case 'ClientProvisioning':
      if (act === 'Added') return `Started setting up a new client${forName}`
      if (act === 'Deleted') return `Removed client${forName}`
      if (status === 'completed') return `Client${forName} set up successfully`
      if (status === 'failed' || status === 'error') return `Client${forName} setup failed`
      return `Client${forName} setup updated`
    case 'ChangeRequest': {
      const forClient = name ? ` for '${name}'` : ''
      if (act === 'Added') return `Requested a change${forClient}`
      if (status === 'approved') return `Approved a change${forClient}`
      if (status === 'cancelled' || status === 'canceled' || status === 'rejected')
        return `Cancelled a change${forClient}`
      if (status === 'completed') return `Completed a change${forClient}`
      if (status === 'executing') return `Applying a change${forClient}`
      return `Updated a change request${forClient}`
    }
    case 'ClientDetail':
    case 'ClientDetails':
      if (act === 'Added') return `Added client${forName}`
      if (act === 'Deleted') return `Removed client${forName}`
      return `Updated client${forName}`
    case 'CompanyDetail':
      if (act === 'Added') return `Added company${forName}`
      if (act === 'Deleted') return `Removed company${forName}`
      return `Updated company${forName}`
    case 'User':
      if (act === 'Added') return 'Added a user'
      if (act === 'Deleted') return 'Removed a user'
      return 'Updated a user'
    case 'ServerConfiguration':
      if (act === 'Added') return 'Registered a server'
      if (act === 'Deleted') return 'Removed a server'
      return 'Updated server settings'
    case 'SmtpConfig':
      return 'Updated email settings'
    default: {
      const verb = act === 'Added' ? 'Created' : act === 'Deleted' ? 'Removed' : 'Updated'
      return `${verb} ${friendlyModule(l.moduleName).toLowerCase()}${forName}`
    }
  }
}

// Arranged field/old/new table for the details modal (replaces raw JSON).
const changesTable = (l) => {
  const rows = diffRows(l.oldValues, l.newValues)
  if (rows.length === 0) return <div className="text-muted">No field-level data recorded.</div>
  const isMod = l.actionType === 'Modified'
  return (
    <table className="table table-sm table-bordered mb-0" style={{ fontSize: 12 }}>
      <thead className="table-light">
        <tr>
          <th style={{ width: '34%' }}>Field</th>
          <th>Old value</th>
          <th>New value</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.field} className={isMod && r.changed ? 'table-warning' : ''}>
            <td className="fw-semibold" title={r.field}>
              {friendlyField(r.field)}
            </td>
            <td>{fmtVal(r.oldVal)}</td>
            <td>{fmtVal(r.newVal)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const UserLogs = () => {
  const [items, setItems] = useState([])
  const [modules, setModules] = useState([])
  const [companies, setCompanies] = useState([])
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [detail, setDetail] = useState(null) // the log entry shown in the details modal
  const today = moment().format('YYYY-MM-DD')
  const [filter, setFilter] = useState({
    username: '',
    module: '',
    action: '',
    company: '',
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
      if (filter.company) params.company = filter.company
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
    axios
      .get(`${BASE_URL}/api/UserLogs/Companies`, { headers: authHeaders() })
      .then((r) => setCompanies(r.data ?? []))
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
            <div className="col-md-2">
              <label className="form-label mb-0">User (name / email)</label>
              <input
                className="form-control form-control-sm rounded-0"
                value={filter.username}
                onChange={(e) => setFilter({ ...filter, username: e.target.value })}
              />
            </div>
            <div className="col-md-2">
              <label className="form-label mb-0">Client</label>
              <input
                className="form-control form-control-sm rounded-0"
                list="log-companies"
                placeholder="All clients"
                value={filter.company}
                onChange={(e) => setFilter({ ...filter, company: e.target.value })}
              />
              <datalist id="log-companies">
                {companies.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
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
            <div className="col-md-1">
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
                <th>Activity</th>
                <th>Company</th>
                <th>IP</th>
                <th style={{ width: '1%' }}></th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-muted text-center py-3">
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
                  <td style={{ maxWidth: 520 }}>{activityText(l)}</td>
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
              <div className="log-section-title">Changes</div>
              {changesTable(detail)}
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
