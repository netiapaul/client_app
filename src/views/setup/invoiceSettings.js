import React, { useState, useEffect, useCallback } from 'react'
import PropTypes from 'prop-types'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
const axios = require('axios')

/**
 * The letterhead printed on every invoice and receipt. A section of the Setup screen.
 *
 * Lifted out of a modal on the Invoices screen. Stored in the database rather than appsettings, so
 * a change takes effect on the next document without a redeploy — and deliberately with NO config
 * fallback, because two places to set the address on a customer's invoice means a screen showing
 * one value while the document carries another.
 *
 * Only the company name and "how to pay" are required. The rest is left blank on purpose until
 * somebody fills it in: an invented address on a customer's invoice is worse than none.
 */
const BLANK = {
  issuerName: '',
  issuerAddress: '',
  issuerEmail: '',
  issuerPhone: '',
  issuerTaxId: '',
  payTo: '',
}

const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices`

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})

const InvoiceSettings = ({ onStatus }) => {
  const canManage = hasModule(MODULES.ManageBilling)

  const [form, setForm] = useState(BLANK)
  const [meta, setMeta] = useState(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(`${api}/Settings`, { headers: authHeaders() })
      const s = r.data ?? {}

      setMeta(s)
      setForm({
        issuerName: s.issuerName ?? '',
        issuerAddress: s.issuerAddress ?? '',
        issuerEmail: s.issuerEmail ?? '',
        issuerPhone: s.issuerPhone ?? '',
        issuerTaxId: s.issuerTaxId ?? '',
        payTo: s.payTo ?? '',
      })

      if (onStatus) {
        // `missing` is the server's own readiness verdict, and it is what gates the invoice run —
        // so the tab reports the same thing the generator will, rather than a second opinion.
        onStatus({
          ok: !s.missing,
          label: s.missing ? 'Incomplete' : `Set — ${s.issuerName}`,
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

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const save = async () => {
    setSaving(true)
    setError('')
    try {
      const r = await axios.post(`${api}/Settings`, form, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card rounded-0 mb-2">
      <div
        className="card-header py-2 d-flex align-items-center justify-content-between"
        style={{ fontSize: 13, fontWeight: 600 }}
      >
        <span>
          <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
            receipt_long
          </span>{' '}
          Invoice details
        </span>
        {meta?.updatedAt && (
          <span className="text-muted fw-normal" style={{ fontSize: 11 }}>
            Last changed {new Date(meta.updatedAt).toLocaleString()}
            {meta.updatedBy ? ` by ${meta.updatedBy}` : ''}
          </span>
        )}
      </div>

      <div className="card-body">
        {loading ? (
          <div className="cb-fs-meta text-muted">Loading…</div>
        ) : (
          <>
            {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

            <p className="cb-fs-meta text-muted">
              This is the letterhead on every invoice and receipt — who it is from, and how to pay
              it. Stored in the database, so changing it takes effect on the next document without a
              redeploy.
            </p>

            {/* The server's own readiness verdict, which also gates the invoice run. */}
            {meta?.missing && (
              <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                <span className="material-icons" style={{ fontSize: 16, verticalAlign: -3 }}>
                  info
                </span>{' '}
                {meta.missing}
              </div>
            )}

            {!canManage && (
              <div className="alert alert-secondary rounded-0 py-2 cb-fs-body">
                You can see these settings but not change them.
              </div>
            )}

            <div className="row g-2">
              <div className="col-12 col-md-7">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="inv-name">
                  Company name <span className="text-danger">*</span>
                </label>
                <input
                  id="inv-name"
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  value={form.issuerName}
                  disabled={!canManage}
                  onChange={(e) => set('issuerName', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-5">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="inv-pin">
                  KRA PIN
                </label>
                <input
                  id="inv-pin"
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  placeholder="P051234567X"
                  value={form.issuerTaxId}
                  disabled={!canManage}
                  onChange={(e) => set('issuerTaxId', e.target.value)}
                />
              </div>

              <div className="col-12 col-md-6">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="inv-addr">
                  Address
                </label>
                <textarea
                  id="inv-addr"
                  rows={3}
                  className="form-control form-control-sm rounded-0"
                  placeholder={'P.O. Box 00000 - 00100\nNairobi, Kenya'}
                  value={form.issuerAddress}
                  disabled={!canManage}
                  onChange={(e) => set('issuerAddress', e.target.value)}
                />
                <span className="cb-fs-meta text-muted">Line breaks are kept.</span>
              </div>

              <div className="col-12 col-md-6">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="inv-email">
                  Email
                </label>
                <input
                  id="inv-email"
                  type="email"
                  className="form-control form-control-sm rounded-0"
                  placeholder="billing@corebase.co.ke"
                  value={form.issuerEmail}
                  disabled={!canManage}
                  onChange={(e) => set('issuerEmail', e.target.value)}
                />

                <label className="cb-fs-meta text-muted d-block mb-1 mt-2" htmlFor="inv-phone">
                  Phone
                </label>
                <input
                  id="inv-phone"
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  placeholder="+254 700 000 000"
                  value={form.issuerPhone}
                  disabled={!canManage}
                  onChange={(e) => set('issuerPhone', e.target.value)}
                />
              </div>

              <div className="col-12">
                <label className="cb-fs-meta text-muted d-block mb-1" htmlFor="inv-payto">
                  How to pay <span className="text-danger">*</span>
                </label>
                <textarea
                  id="inv-payto"
                  rows={3}
                  className="form-control form-control-sm rounded-0"
                  placeholder={'M-PESA Paybill 123456\nAccount: your customer code'}
                  value={form.payTo}
                  disabled={!canManage}
                  onChange={(e) => set('payTo', e.target.value)}
                />
                <span className="cb-fs-meta text-muted">
                  Shown as a panel at the foot of the invoice. This is the part a client acts on —
                  paybill, account number, bank details.
                </span>
              </div>
            </div>

            {canManage && (
              <div className="d-flex gap-2 mt-3 pt-2 border-top">
                <button
                  type="button"
                  className="btn btn-sm add-btn rounded-0"
                  disabled={saving || !form.issuerName.trim()}
                  onClick={save}
                >
                  {saving ? 'Saving…' : 'Save settings'}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

InvoiceSettings.propTypes = {
  /** Reports configured/not to the Setup tab, so the state is visible without opening it. */
  onStatus: PropTypes.func,
}

export default InvoiceSettings
