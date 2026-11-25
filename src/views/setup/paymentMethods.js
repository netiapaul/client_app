import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import { getToken } from '../../utils/session'
const axios = require('axios')

/** Which ways of paying are offered, and to whom. */
const api = `${process.env.REACT_APP_URL_CONFIG}/api/PaymentMethods`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const PaymentMethods = ({ onStatus }) => {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(api, { headers: authHeaders() })
      const list = r.data ?? []
      setRows(list)

      if (onStatus) {
        const on = list.filter((m) => m.isEnabled).length
        const portal = list.filter((m) => m.isEnabled && m.showInPortal).length

        onStatus({
          ok: on > 0,
          label: on === 0 ? 'Nothing accepted' : `${on} accepted · ${portal} in portal`,
        })
      }
    } catch (e) {
      setError(readErr(e))
      if (onStatus) onStatus({ ok: false, label: 'Could not load' })
    } finally {
      setLoading(false)
    }
  }, [onStatus])

  useEffect(() => {
    load()
  }, [load])

  const set = (method, patch) =>
    setRows((list) => list.map((m) => (m.method === method ? { ...m, ...patch } : m)))

  const move = (index, by) =>
    setRows((list) => {
      const next = [...list]
      const to = index + by
      if (to < 0 || to >= next.length) return list
      ;[next[index], next[to]] = [next[to], next[index]]
      // Renumbered from the visible order.
      return next.map((m, i) => ({ ...m, sortOrder: (i + 1) * 10 }))
    })

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const r = await axios.post(api, rows, { headers: authHeaders() })

      if (r.data?.warning) toast.warn(r.data.message, { theme: 'colored', autoClose: 12000 })
      else toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 5000 })

      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const accepted = rows.filter((m) => m.isEnabled).length
  const inPortal = rows.filter((m) => m.isEnabled && m.showInPortal).length

  return (
    <div className="card rounded-0 mb-2">
      <div className="card-header py-2" style={{ fontSize: 13, fontWeight: 600 }}>
        <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
          account_balance_wallet
        </span>{' '}
        Payment methods
      </div>

      <div className="card-body">
        {loading ? (
          <div className="cb-fs-meta text-muted">Loading…</div>
        ) : (
          <>
            {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

            <p className="cb-fs-meta text-muted">
              <strong>Accepted</strong> controls whether a method can be used for a new payment at
              all. <strong>In the portal</strong> controls whether customers can choose it
              themselves. Switching one off never affects payments already recorded with it — those
              stay in the ledger exactly as they are.
            </p>

            {accepted === 0 && (
              <div className="alert alert-danger rounded-0 py-2 cb-fs-body">
                <span className="fw-bold">Nothing is accepted.</span> No payment can be recorded by
                anyone until at least one method is switched on.
              </div>
            )}

            {accepted > 0 && inPortal === 0 && (
              <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                No method is offered in the client portal, so customers cannot pay online — only
                staff can record payments.
              </div>
            )}

            <div className="cb-table-wrap">
              <table className="table table-sm cb-table mb-0">
                <thead>
                  <tr>
                    <th style={{ width: '1%' }}>Order</th>
                    <th>Method</th>
                    <th style={{ width: '1%' }} className="text-center">
                      Accepted
                    </th>
                    <th style={{ width: '1%' }} className="text-center">
                      In the portal
                    </th>
                    <th>Note shown to the payer</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((m, i) => (
                    <tr key={m.method} style={{ opacity: m.isEnabled ? 1 : 0.55 }}>
                      <td className="text-nowrap">
                        <button
                          type="button"
                          className="btn btn-sm filter-btn rounded-0 py-0 px-1"
                          disabled={i === 0}
                          title="Move up"
                          onClick={() => move(i, -1)}
                        >
                          <span className="material-icons" style={{ fontSize: 13 }}>
                            arrow_upward
                          </span>
                        </button>{' '}
                        <button
                          type="button"
                          className="btn btn-sm filter-btn rounded-0 py-0 px-1"
                          disabled={i === rows.length - 1}
                          title="Move down"
                          onClick={() => move(i, 1)}
                        >
                          <span className="material-icons" style={{ fontSize: 13 }}>
                            arrow_downward
                          </span>
                        </button>
                      </td>

                      <td className="text-nowrap">
                        <span
                          className="material-icons"
                          style={{ fontSize: 15, verticalAlign: -3 }}
                        >
                          {m.icon}
                        </span>{' '}
                        <strong>{m.displayName}</strong>
                        {/* The two facts worth knowing before switching something on. */}
                        {!m.clearsOnRecord && (
                          <span className="d-block cb-fs-meta text-muted">
                            Does not bank on record — held until it clears
                          </span>
                        )}
                        {m.notReadyReason && (
                          <span className="d-block cb-fs-meta text-danger">{m.notReadyReason}</span>
                        )}
                      </td>

                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label={`Accept ${m.displayName}`}
                          checked={m.isEnabled}
                          onChange={(e) => set(m.method, { isEnabled: e.target.checked })}
                        />
                      </td>

                      <td className="text-center">
                        <input
                          type="checkbox"
                          className="form-check-input"
                          aria-label={`Offer ${m.displayName} in the portal`}
                          // Subordinate to Accepted: a method the business does not take cannot be offered.
                          disabled={!m.isEnabled}
                          checked={m.isEnabled && m.showInPortal}
                          onChange={(e) => set(m.method, { showInPortal: e.target.checked })}
                        />
                      </td>

                      <td>
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          maxLength={500}
                          placeholder={
                            m.method === 'Bank'
                              ? 'e.g. NCBA, account 1234567890'
                              : m.method === 'Mpesa'
                              ? 'e.g. Paybill 123456, account = your client code'
                              : 'Optional'
                          }
                          value={m.instructions ?? ''}
                          disabled={!m.isEnabled}
                          onChange={(e) => set(m.method, { instructions: e.target.value })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
              <button
                type="button"
                className="btn btn-sm add-btn rounded-0"
                disabled={saving}
                onClick={save}
              >
                {saving ? 'Saving…' : 'Save methods'}
              </button>
              <span className="cb-fs-meta text-muted align-self-center">
                {accepted} accepted, {inPortal} offered to customers.
              </span>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

PaymentMethods.propTypes = {
  /** Reports the count to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default PaymentMethods
