import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/** Branches deleted from the duplicates screen, and still recoverable. */
const ArchivedBranches = () => {
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/ArchivedBranches`
  const [confirm, confirmDialog] = useConfirm()

  const canRestore = hasModule(MODULES.RestoreArchivedBranches)
  const canPurge = hasModule(MODULES.PurgeArchivedBranches)

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
  const [total, setTotal] = useState(0)
  const [archivedTotal, setArchivedTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [search, setSearch] = useState('')
  const [includeRestored, setIncludeRestored] = useState(false)

  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState('')

  // The row being read in full.
  const [open, setOpen] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(api, {
        headers: authHeaders(),
        params: { search: search || undefined, includeRestored, page, pageSize },
      })
      setRows(r.data?.items ?? [])
      setTotal(r.data?.total ?? 0)
      setArchivedTotal(r.data?.archivedTotal ?? 0)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, search, includeRestored, page, pageSize])

  useEffect(() => {
    load()
  }, [load])

  const showDetail = async (row) => {
    setOpen({ id: row.id, loading: true })
    try {
      const r = await axios.get(`${api}/${row.id}`, { headers: authHeaders() })
      setOpen((o) => (o && o.id === row.id ? { ...r.data, loading: false } : o))
    } catch (e) {
      setError(readErr(e))
      setOpen(null)
    }
  }

  const restore = async (row) => {
    if (
      !(await confirm({
        title: `Restore ${row.branchCode}?`,
        body: row.branchExistsNow
          ? 'The branch goes back into the licensing data exactly as it was. The row that was ' +
            'kept in its place is still there, so the two will appear together on the ' +
            'duplicates screen again — which is the point if the wrong one was kept. Resolve ' +
            'them the other way round from there.'
          : 'The branch goes back into the licensing data exactly as it was and becomes live ' +
            'again.',
        detail: `${row.companyName} · ${row.cusCode} · archived ${fmtDate(row.archivedAt)}`,
        confirmText: 'Restore it',
      }))
    )
      return

    setBusy(row.id)
    setError('')
    try {
      const r = await axios.post(`${api}/${row.id}/Restore`, {}, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Branch restored.', { theme: 'colored', autoClose: 7000 })
      setOpen(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setBusy(null)
    }
  }

  /** Permanent deletion — the end of the line. */
  const purge = async (row) => {
    if (
      !(await confirm({
        title: `Permanently delete ${row.branchCode}?`,
        body:
          'This removes the archived copy for good. There is nothing behind the archive — once ' +
          'it is gone the branch cannot be recovered by anybody, and only the audit log will ' +
          'show that it existed.',
        detail: `${row.companyName} · ${row.cusCode} · ${row.branchName || 'no branch name'}`,
        confirmText: 'Delete permanently',
        danger: true,
      }))
    )
      return

    setBusy(row.id)
    setError('')
    try {
      const r = await axios.delete(`${api}/${row.id}`, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Deleted permanently.', {
        theme: 'colored',
        autoClose: 7000,
      })
      setOpen(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setBusy(null)
    }
  }

  const pages = Math.max(1, Math.ceil(total / pageSize))

  return (
    <>
      {confirmDialog}

      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between align-items-center flex-wrap gap-2">
          <h6 className="m-0">Archived Branches</h6>
          <span style={{ fontSize: 11 }}>
            <span className="text-muted">recoverable</span>{' '}
            <span className="fw-bold">{archivedTotal}</span>
            <span className="text-muted ms-2">showing</span>{' '}
            <span className="fw-bold">{total}</span>
          </span>
        </div>
      </div>
      <hr className="my-2" />

      {/* WHAT THIS SCREEN IS, said once at the top. */}
      <div className="alert alert-info rounded-0 py-2 mb-2" style={{ fontSize: 12 }}>
        Branches deleted on the <Link to="/duplicate-branches">Duplicate Branches</Link> screen are
        moved here rather than destroyed. A branch in this list can be put back exactly as it was.
        {!canRestore && !canPurge && (
          <>
            {' '}
            You can read this list but not change it — restoring and permanent deletion are separate
            rights.
          </>
        )}
      </div>

      {error && (
        <div className="alert alert-danger rounded-0 py-1 mb-2" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}

      <div className="card rounded-0 mb-2">
        <div className="card-body p-2">
          <div className="d-flex align-items-center gap-2 mb-2 flex-wrap">
            <input
              className="form-control form-control-sm rounded-0 filter-control"
              style={{ maxWidth: 280, fontSize: 11 }}
              placeholder="Search company, code, branch or serial…"
              value={search}
              onChange={(e) => {
                setPage(1)
                setSearch(e.target.value)
              }}
            />

            {/* Restored rows are KEPT, not deleted. */}
            <label className="d-flex align-items-center gap-1 m-0" style={{ fontSize: 11 }}>
              <input
                type="checkbox"
                className="form-check-input m-0"
                checked={includeRestored}
                onChange={(e) => {
                  setPage(1)
                  setIncludeRestored(e.target.checked)
                }}
              />
              Show branches already restored
            </label>
          </div>

          {loading ? (
            <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
              Loading…
            </div>
          ) : rows.length === 0 ? (
            <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
              {search
                ? 'No archived branch matches that.'
                : 'Nothing has been archived. Branches deleted from the duplicates screen appear here.'}
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table table-sm table-hover mb-0" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Client</th>
                    <th>Branch</th>
                    <th style={{ width: '1%' }}>Type</th>
                    <th>Serial</th>
                    <th>Archived</th>
                    <th style={{ width: '1%' }}>Status</th>
                    <th style={{ width: '1%' }} />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.id} className={r.restoredAt ? 'text-muted' : ''}>
                      <td className="align-middle">
                        <span className="d-block text-truncate" style={{ maxWidth: 220 }}>
                          {r.companyName || '—'}
                        </span>
                        <span className="text-muted" style={{ fontSize: 10 }}>
                          {r.cusCode}
                        </span>
                      </td>
                      <td className="align-middle">
                        <span className="fw-bold">{r.branchCode}</span>
                        <span className="d-block text-muted" style={{ fontSize: 10 }}>
                          {r.branchName || 'no branch name'}
                        </span>
                      </td>
                      <td className="align-middle text-center">
                        <span className={`badge ${r.forCloud ? 'bg-info text-dark' : 'bg-dark'}`}>
                          {r.forCloud ? 'Cloud' : 'Desktop'}
                        </span>
                      </td>
                      <td className="align-middle" style={{ fontSize: 10 }}>
                        {r.serialNo || <span className="text-muted">—</span>}
                      </td>
                      <td className="align-middle" style={{ fontSize: 10 }}>
                        {fmtDate(r.archivedAt)}
                        <span className="d-block text-muted">{r.archivedBy || 'unknown'}</span>
                      </td>
                      <td className="align-middle text-center">
                        {r.restoredAt ? (
                          <span className="badge bg-success" title={`by ${r.restoredBy ?? ''}`}>
                            Restored
                          </span>
                        ) : (
                          // One archived state, not two.
                          <span className="badge bg-secondary">Archived</span>
                        )}
                      </td>
                      <td className="align-middle text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm filter-btn rounded-0"
                          style={{ fontSize: 10 }}
                          onClick={() => showDetail(r)}
                        >
                          Details
                        </button>{' '}
                        {canRestore && r.canRestore && (
                          <button
                            type="button"
                            className="btn btn-sm add-btn rounded-0"
                            style={{ fontSize: 10 }}
                            disabled={busy === r.id}
                            onClick={() => restore(r)}
                          >
                            {busy === r.id ? '…' : 'Restore'}
                          </button>
                        )}{' '}
                        {canPurge && !r.restoredAt && (
                          <button
                            type="button"
                            className="btn btn-sm cancel-btn rounded-0"
                            style={{ fontSize: 10 }}
                            disabled={busy === r.id}
                            onClick={() => purge(r)}
                          >
                            Delete for good
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="pager mt-2 pt-2 border-top d-flex align-items-center gap-2">
              <select
                className="form-select form-select-sm pager-size"
                value={pageSize}
                onChange={(e) => {
                  setPage(1)
                  setPageSize(Number(e.target.value))
                }}
              >
                {[20, 50, 100].map((n) => (
                  <option key={n} value={n}>
                    {n} rows
                  </option>
                ))}
              </select>
              <button
                type="button"
                className="btn pager-btn"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ‹
              </button>
              <span className="pager-range">
                {page} of {pages}
              </span>
              <button
                type="button"
                className="btn pager-btn"
                disabled={page >= pages}
                onClick={() => setPage((p) => p + 1)}
              >
                ›
              </button>
            </div>
          )}
        </div>
      </div>

      {/* WHAT WAS IN THE ROW. */}
      {open && (
        <div className="card rounded-0 mb-2">
          <div className="card-body p-2">
            <div className="d-flex align-items-center gap-2 mb-2">
              <strong style={{ fontSize: 12 }}>
                {open.loading ? 'Loading…' : `${open.cusCode} · ${open.branchCode}`}
              </strong>
              <button
                type="button"
                className="btn btn-sm cancel-btn rounded-0 ms-auto"
                style={{ fontSize: 10 }}
                onClick={() => setOpen(null)}
              >
                Close
              </button>
            </div>

            {!open.loading && (
              <>
                <div className="mb-2" style={{ fontSize: 11 }}>
                  <span className="text-muted">Why it was archived: </span>
                  {open.archiveReason || '—'}
                  {open.survivorClientDetailsId != null && (
                    <span className="text-muted"> · kept #{open.survivorClientDetailsId}</span>
                  )}
                </div>

                {open.snapshotError && (
                  <div className="alert alert-warning rounded-0 py-1 mb-2" style={{ fontSize: 11 }}>
                    {open.snapshotError}
                  </div>
                )}

                {(open.fields ?? []).length > 0 && (
                  <div className="log-meta">
                    {open.fields.map((f) => (
                      <div key={f.name}>
                        <span className="d-block text-muted" style={{ fontSize: 10 }}>
                          {f.name}
                        </span>
                        <span style={{ fontSize: 11 }}>{f.value}</span>
                      </div>
                    ))}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}

const fmtDate = (d) => {
  if (!d) return '—'
  const dt = new Date(d)
  return Number.isNaN(dt.getTime()) ? '—' : dt.toLocaleDateString()
}

export default ArchivedBranches
