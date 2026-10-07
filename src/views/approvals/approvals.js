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

  const act = async (token, action) => {
    setBusy(token)
    try {
      await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Approvals/${token}/${action}`, {
        headers: authHeaders(),
      })
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
      <div className="table-responsive">
        <table className="table table-sm align-middle">
          <thead>
            <tr>
              <th>#</th>
              <th>Change</th>
              <th>Details</th>
              <th>Client</th>
              <th>Requested by</th>
              <th>When</th>
              <th>Expires</th>
              {canApprove && <th></th>}
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
                <td>{r.type}</td>
                <td>{r.summary}</td>
                <td>{r.targetCusCode || '-'}</td>
                <td>{r.requestedByName || r.requestedByEmail || '-'}</td>
                <td>{r.requestedAt ? moment(r.requestedAt).format('DD/MM/YYYY HH:mm') : '-'}</td>
                <td>{r.expiresAt ? moment(r.expiresAt).format('DD/MM/YYYY') : '-'}</td>
                {canApprove && (
                  <td className="text-nowrap">
                    <button
                      type="button"
                      className="btn btn-sm btn-success rounded-0 me-1"
                      disabled={busy === r.token}
                      onClick={() => act(r.token, 'approve')}
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm btn-danger rounded-0"
                      disabled={busy === r.token}
                      onClick={() => act(r.token, 'cancel')}
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
    </>
  )
}

export default Approvals
