import React, { useState, useEffect, useCallback } from 'react'
import { getToken, getCanApprove } from '../../utils/session'
import { toast } from 'react-toastify'
import moment from 'moment'

const axios = require('axios')

// Approvers' in-app view of pending change requests (create client / add branch / expiry / modules).
// Approve/Cancel call the same tokenised endpoints the email links use.
const Approvals = () => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(null)
  const canApprove = getCanApprove() // only approvers see the action buttons

  const authHeaders = () => ({ Authorization: `Bearer ${getToken()}` })

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Approvals/Pending`, {
        headers: authHeaders(),
      })
      setRows(res.data || [])
    } catch (e) {
      toast.error(e.response?.data?.message || 'Could not load pending approvals', {
        theme: 'colored',
      })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const act = async (id, action) => {
    setBusy(id)
    try {
      await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Approvals/${id}/${action}`,
        {},
        { headers: authHeaders() },
      )
      toast.success(action === 'approve' ? 'Change approved and started.' : 'Request cancelled.', {
        theme: 'colored',
      })
      await load()
    } catch (e) {
      toast.error(e.response?.data?.message || `Could not ${action} the request`, {
        theme: 'colored',
      })
    } finally {
      setBusy(null)
    }
  }

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center mb-2">
        <h6 className="m-0">
          Pending Approvals
          {!canApprove && (
            <small className="text-muted ms-2" style={{ fontSize: 11 }}>
              (view only — you don’t have approval rights)
            </small>
          )}
        </h6>
        <button className="btn btn-sm filter-btn rounded-0" onClick={load} disabled={loading}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>
      <div className="card rounded-0">
        <div className="table-responsive">
          <table className="table table-sm table-hover align-middle mb-0" style={{ fontSize: 12 }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>Change</th>
                <th>Details</th>
                <th>Client</th>
                <th>Requested by</th>
                <th>When</th>
                <th>Expires</th>
                {canApprove && <th className="text-end">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && !loading && (
                <tr>
                  <td colSpan={canApprove ? 8 : 7} className="text-center text-muted py-3">
                    No pending approvals.
                  </td>
                </tr>
              )}
              {rows.map((r, i) => (
                <tr key={r.id}>
                  <td>{i + 1}</td>
                  <td>
                    <span
                      className="badge rounded-0"
                      style={{
                        background: '#2f3b52',
                        color: '#fff',
                        fontSize: 10,
                        fontWeight: 600,
                      }}
                    >
                      {r.type}
                    </span>
                  </td>
                  <td>{r.summary}</td>
                  <td>{r.targetCusCode || '—'}</td>
                  <td>{r.requestedByName || r.requestedByEmail || '—'}</td>
                  <td className="text-nowrap">
                    {r.requestedAt ? moment(r.requestedAt).format('DD/MM/YY HH:mm') : '—'}
                  </td>
                  <td className="text-nowrap">
                    {r.expiresAt ? moment(r.expiresAt).format('DD/MM/YY') : '—'}
                  </td>
                  {canApprove && (
                    <td className="text-end text-nowrap">
                      {!r.isOwn && (
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0 me-1"
                          disabled={busy === r.id}
                          onClick={() => act(r.id, 'approve')}
                        >
                          Approve
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm delete-btn rounded-0"
                        title={r.isOwn ? 'Withdraw your request' : 'Reject this change'}
                        disabled={busy === r.id}
                        onClick={() => act(r.id, 'cancel')}
                      >
                        Cancel
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}

export default Approvals
