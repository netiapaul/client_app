import React, { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { formatMoney as money, parseAmount } from '../../utils/money'
import MoneyInput from '../../components/MoneyInput'
const axios = require('axios')

/** What each add-on costs. */
const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices/AddOns`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const AddOnPricing = () => {
  const canManage = hasModule(MODULES.ManageBilling)

  const [rows, setRows] = useState([])
  const [clients, setClients] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(api, { headers: authHeaders() })
      setRows(r.data?.items ?? [])
      setClients(r.data?.clients ?? [])
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const set = (addonId, price) =>
    setRows((list) => list.map((a) => (a.addonId === addonId ? { ...a, monthlyPrice: price } : a)))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const payload = rows.map((a) => ({
        addonId: a.addonId,
        // parseAmount, not Number: an empty or half-typed box must read as null, not NaN.
        monthlyPrice: parseAmount(a.monthlyPrice),
      }))

      const r = await axios.post(api, payload, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 8000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  // What this pricing would add to a month's billing, across every company holding a grant.
  const monthly = rows.reduce((sum, a) => sum + (Number(a.monthlyPrice) || 0) * a.clients, 0)
  const priced = rows.filter((a) => Number(a.monthlyPrice) > 0).length

  return (
    <>
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">extension</span>
          Add-on pricing
          {!loading && (
            <span className="cb-page-head__sub">
              {priced} of {rows.length} with a default
              {clients.length > 0 && <> · {clients.length} client(s) hold add-ons</>}
            </span>
          )}
        </h1>
      </div>

      {/* ONE WINDOW PER CLIENT: what is left on this screen is the global catalogue. */}
      <div className="alert alert-info rounded-0 py-2 cb-fs-body d-flex flex-wrap gap-2 align-items-center">
        <span className="material-icons" style={{ fontSize: 18 }}>
          info
        </span>
        <span>
          These are the <strong>default</strong> prices. What an individual client pays — and
          whether an add-on is still being renewed for them — is set on their billing profile, next
          to their monthly amount.
        </span>
        <Link to="/billing/profiles" className="btn btn-sm filter-btn rounded-0 ms-auto">
          Open Billing profiles
        </Link>
      </div>

      <div className="cb-card">
        <div className="cb-card__body">
          {loading ? (
            <div className="cb-fs-meta text-muted">Loading…</div>
          ) : (
            <>
              {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

              <p className="cb-fs-meta text-muted">
                The figure a client pays when <strong>nobody has agreed anything else</strong> with
                them. Charged once per company however many branches hold it. Leave one blank and it
                is <strong>not billed</strong> to anyone without their own price — blank means
                unpriced, not free. Changes apply to documents raised from now on.
              </p>

              {priced === 0 && (
                <div className="alert alert-info rounded-0 py-2 cb-fs-body">
                  No add-on has a price yet, so none of them appear on any invoice.
                </div>
              )}

              {!canManage && (
                <div className="alert alert-secondary rounded-0 py-2 cb-fs-body">
                  You can see these prices but not change them.
                </div>
              )}

              <div className="cb-table-wrap">
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Clients
                      </th>
                      <th style={{ width: '1%' }} className="text-end">
                        Price / month
                      </th>
                      <th style={{ width: '1%' }} className="text-end">
                        Would bill
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((a) => {
                      const price = Number(a.monthlyPrice) || 0
                      return (
                        <tr key={a.addonId} style={{ opacity: price > 0 ? 1 : 0.6 }}>
                          <td>
                            <strong>{a.addonName}</strong>
                            <span className="d-block cb-fs-meta text-muted">{a.addonId}</span>
                          </td>

                          <td className="text-end text-nowrap">
                            {a.clients > 0 ? a.clients : <span className="text-muted">none</span>}
                          </td>

                          <td className="text-end">
                            {/* Grouped while typing. */}
                            <MoneyInput
                              currency={null}
                              className="form-control form-control-sm rounded-0 text-end"
                              style={{ width: 120 }}
                              placeholder="Not billed"
                              disabled={!canManage}
                              value={a.monthlyPrice ?? ''}
                              onChange={(v) => set(a.addonId, v)}
                              aria-label={`Monthly price for ${a.addonName}`}
                            />
                          </td>

                          <td className="text-end text-nowrap">
                            {price > 0 && a.clients > 0 ? (
                              <strong>{money(price * a.clients, 'KES')}</strong>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>

              {canManage && (
                <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm add-btn rounded-0"
                    disabled={saving}
                    onClick={save}
                  >
                    {saving ? 'Saving…' : 'Save prices'}
                  </button>
                  <span className="cb-fs-meta text-muted align-self-center">
                    {priced} of {rows.length} priced
                    {monthly > 0 && <> · {money(monthly, 'KES')} a month across all clients</>}
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

/** One client's add-on prices. */

export default AddOnPricing
