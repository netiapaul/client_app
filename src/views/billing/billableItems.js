import React, { useState, useEffect, useCallback } from 'react'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { formatMoney as money } from '../../utils/money'
const axios = require('axios')

/**
 * The catalogue of chargeable items — what a one-off invoice is PICKED from.
 *
 * It exists because free text does not survive contact with a team. The same charge went out as
 * "Set up", "Setup", "Set-up and config" and "Installation" depending on who raised the invoice,
 * at whatever figure they remembered. That makes the ledger impossible to total by item and the
 * price impossible to hold anybody to.
 *
 * The amount here is a DEFAULT. It prefills the invoice line and the admin can still change it
 * there, because a joining deal is negotiated — the catalogue is to stop people guessing, not to
 * stop them agreeing something.
 *
 * Retired items stay on this screen rather than disappearing. Hiding them would make a switched-
 * off item look deleted and invite somebody to create it again under a slightly different name,
 * which is the whole problem coming back.
 */
const BillableItems = () => {
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices/Items`
  const canManage = hasModule(MODULES.ManageBilling)

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
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const r = await axios.get(api, { headers: authHeaders() })
      // `amount` is the string in the box, held apart from the saved number — the same reason the
      // add-on prices do it. A numeric field cannot tell a half-typed "1" from a real 1.
      setRows((r.data ?? []).map((i) => ({ ...i, amount: String(i.defaultAmount ?? '') })))
      setError('')
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders])

  useEffect(() => {
    load()
  }, [load])

  const set = (idx, field, value) =>
    setRows((list) => list.map((r, i) => (i === idx ? { ...r, [field]: value } : r)))

  const addRow = () =>
    setRows((list) => [
      ...list,
      {
        id: 0,
        name: '',
        amount: '',
        currency: 'KES',
        isActive: true,
        // Sorted after everything that exists, so a new row lands at the bottom of the picker
        // rather than jumping to the top of a list somebody has arranged.
        sortOrder: list.reduce((m, r) => Math.max(m, r.sortOrder ?? 0), 0) + 10,
        notes: '',
      },
    ])

  const named = rows.filter((r) => (r.name ?? '').trim() !== '')

  // Caught before saving so the message names the item rather than arriving as a database error.
  const duplicate = (() => {
    const live = named.filter((r) => r.isActive).map((r) => r.name.trim().toLowerCase())
    return live.find((n, i) => live.indexOf(n) !== i)
  })()

  const save = async () => {
    if (duplicate) {
      setError(
        `"${duplicate}" appears twice. Two live items with the same name would make the price on ` +
          'an invoice a coin toss — rename one, or switch one off.',
      )
      return
    }

    setSaving(true)
    setError('')
    try {
      const payload = named.map((r) => ({
        id: r.id ?? 0,
        name: r.name.trim(),
        defaultAmount: r.amount === '' || r.amount == null ? 0 : Number(r.amount),
        currency: r.currency || 'KES',
        isActive: !!r.isActive,
        sortOrder: Number(r.sortOrder) || 0,
        notes: r.notes || null,
      }))

      const r = await axios.post(api, payload, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const active = named.filter((r) => r.isActive).length

  return (
    <>
      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">sell</span>
          Billable items
          {!loading && (
            <span className="cb-page-head__sub">
              {active} available to pick
              {named.length > active && <> · {named.length - active} switched off</>}
            </span>
          )}
        </h1>
      </div>

      <div className="cb-card">
        <div className="cb-card__body">
          {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

          <p className="cb-fs-meta text-muted">
            What can be charged on a one-off or joining invoice. The admin picks an item and the
            amount fills in — <strong>and stays editable on the invoice</strong>, so a negotiated
            figure does not need a new item. Switch one off to take it out of the picker without
            losing what it used to cost.
          </p>

          {loading ? (
            <div className="cb-fs-meta text-muted">Loading…</div>
          ) : (
            <>
              <div className="cb-table-wrap">
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th style={{ width: '16%' }} className="text-end">
                        Default amount
                      </th>
                      <th style={{ width: '8%' }} className="text-end">
                        Order
                      </th>
                      <th>Note</th>
                      <th style={{ width: '1%' }} className="text-center">
                        In picker
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={r.id || `new-${i}`} style={{ opacity: r.isActive ? 1 : 0.55 }}>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            placeholder="e.g. Setup and configuration"
                            aria-label={`Item ${i + 1} name`}
                            disabled={!canManage}
                            value={r.name ?? ''}
                            onChange={(e) => set(i, 'name', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            min="0"
                            step="0.01"
                            className="form-control form-control-sm rounded-0 text-end"
                            placeholder="0.00"
                            aria-label={`Item ${i + 1} default amount`}
                            disabled={!canManage}
                            value={r.amount ?? ''}
                            onChange={(e) => set(i, 'amount', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="number"
                            step="1"
                            className="form-control form-control-sm rounded-0 text-end"
                            aria-label={`Item ${i + 1} order`}
                            disabled={!canManage}
                            value={r.sortOrder ?? 0}
                            onChange={(e) => set(i, 'sortOrder', e.target.value)}
                          />
                        </td>
                        <td>
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            placeholder="e.g. per day, on site"
                            aria-label={`Item ${i + 1} note`}
                            disabled={!canManage}
                            value={r.notes ?? ''}
                            onChange={(e) => set(i, 'notes', e.target.value)}
                          />
                          {r.updatedBy && (
                            <span className="cb-fs-meta text-muted">
                              last changed by {r.updatedBy}
                            </span>
                          )}
                        </td>
                        <td className="text-center">
                          {/* Switched off rather than deleted — an invoice line keeps its own copy
                              of the wording and the figure, so removing the row would lose only
                              the history of what we used to sell, and somebody always asks. */}
                          <span className="form-check form-switch d-inline-block m-0">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              role="switch"
                              checked={!!r.isActive}
                              disabled={!canManage}
                              aria-label={`${r.name || 'Item'} available to pick`}
                              onChange={(e) => set(i, 'isActive', e.target.checked)}
                            />
                          </span>
                        </td>
                      </tr>
                    ))}

                    {rows.length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-muted cb-fs-body py-3">
                          Nothing here yet. Add the charges you raise most — setup, training,
                          hardware — so nobody has to remember the price.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {canManage && (
                <div className="d-flex flex-wrap gap-2 mt-3 pt-2 border-top">
                  <button
                    type="button"
                    className="btn btn-sm filter-btn rounded-0"
                    disabled={saving}
                    onClick={addRow}
                  >
                    Add an item
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm add-btn rounded-0 ms-auto"
                    disabled={saving || named.length === 0}
                    onClick={save}
                  >
                    {saving ? 'Saving…' : 'Save the catalogue'}
                  </button>
                </div>
              )}

              {named.length > 0 && (
                <div className="cb-fs-meta text-muted mt-2">
                  {active} item(s) in the picker, totalling{' '}
                  {money(
                    named
                      .filter((r) => r.isActive)
                      .reduce((sm, r) => sm + (Number(r.amount) || 0), 0),
                    'KES',
                  )}{' '}
                  if every one were charged once. Changes apply to invoices raised from now on;
                  anything already raised keeps the figures it was given.
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  )
}

export default BillableItems
