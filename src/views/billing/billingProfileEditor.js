import React, { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { toast } from 'react-toastify'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import MoneyInput from '../../components/MoneyInput'
import { formatMoney as money, parseAmount } from '../../utils/money'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/** One company's whole billing arrangement, on a page of its own. */
const BillingProfileEditor = () => {
  const { cusCode } = useParams()
  const navigate = useNavigate()
  const [confirm, confirmDialog] = useConfirm()

  const api = `${process.env.REACT_APP_URL_CONFIG}/api/BillingProfiles`
  const addOnApi = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices/AddOns`
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

  const [company, setCompany] = useState(null)
  const [history, setHistory] = useState([])
  const [branches, setBranches] = useState([])
  const [addOns, setAddOns] = useState([])
  const [form, setForm] = useState(null)

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [addOnBusy, setAddOnBusy] = useState(null)
  const [applyingCredit, setApplyingCredit] = useState(false)

  // WHICH payments the credit is sitting on.
  const [creditDetail, setCreditDetail] = useState(null)
  const [creditBusy, setCreditBusy] = useState(false)

  const loadCreditDetail = async () => {
    if (creditDetail) return setCreditDetail(null) // second click closes it
    setCreditBusy(true)
    setError('')
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Payments/Credit/${encodeURIComponent(cusCode)}`,
        { headers: authHeaders() },
      )
      setCreditDetail(r.data ?? null)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setCreditBusy(false)
    }
  }
  const [error, setError] = useState('')

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null
  const isoToday = () => new Date().toISOString().slice(0, 10)

  /** Expiry minus the lead days — the same arithmetic the server does, previewed live. */
  const leadDate = (expiry, leadDays) => {
    if (!expiry) return null
    const n = Number(leadDays)
    if (!Number.isFinite(n)) return null
    const d = new Date(expiry)
    d.setDate(d.getDate() - n)
    return d
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [detail, addOnRes] = await Promise.all([
        axios.get(`${api}/${encodeURIComponent(cusCode)}`, { headers: authHeaders() }),
        axios
          .get(`${addOnApi}/${encodeURIComponent(cusCode)}`, { headers: authHeaders() })
          // Not fatal: a client may hold no add-ons, or the lookup may fail.
          .catch(() => ({ data: { items: [] } })),
      ])

      const c = detail.data?.company ?? null
      setCompany(c)
      setHistory(detail.data?.history ?? [])

      const branchRows = detail.data?.branches ?? []
      setBranches(
        branchRows.map((b) => ({
          ...b,
          // Held as a STRING so "blank" (use the standard figure) stays distinguishable from 0.
          draft:
            b.monthlyAmount === null || b.monthlyAmount === undefined
              ? ''
              : String(b.monthlyAmount),
        })),
      )

      setAddOns(
        (addOnRes.data?.items ?? []).map((a) => ({
          ...a,
          draft: a.isOverride ? String(a.price ?? '') : '',
        })),
      )

      setForm({
        monthlyAmount:
          c?.monthlyAmount === null || c?.monthlyAmount === undefined
            ? ''
            : String(c.monthlyAmount),
        branchMonthlyAmount:
          c?.branchMonthlyAmount === null || c?.branchMonthlyAmount === undefined
            ? ''
            : String(c.branchMonthlyAmount),
        // From the row, never defaulted to Company.
        billingMode: c?.billingMode === 'Branch' ? 'Branch' : 'Company',
        invoiceLeadDays: c?.invoiceLeadDays ?? 7,
        isBillable: c?.isBillable ?? true,
        effectiveFrom: isoToday(),
        notes: '',
      })
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, addOnApi, authHeaders, cusCode])

  useEffect(() => {
    load()
  }, [load])

  const perBranch = form?.billingMode === 'Branch'
  const currency = company?.currency || 'KES'

  const setBranchDraft = (branchCode, draft) =>
    setBranches((list) => list.map((b) => (b.branchCode === branchCode ? { ...b, draft } : b)))
  const setAddOnDraft = (addonId, draft) =>
    setAddOns((list) => list.map((a) => (a.addonId === addonId ? { ...a, draft } : a)))

  /** What one branch would be charged: its own box if filled, otherwise the company figure. */
  const rateFor = (b) => parseAmount(b.draft) ?? parseAmount(form?.branchMonthlyAmount) ?? 0

  /** Branches grouped by the expiry they sit on — which is exactly how they will be invoiced. */
  const branchGroups = () => {
    const map = new Map()
    branches.forEach((b) => {
      const key = b.licenceExpiry ? String(b.licenceExpiry).slice(0, 10) : 'none'
      if (!map.has(key)) map.set(key, [])
      map.get(key).push(b)
    })
    return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0]))
  }

  const companyTotal = () =>
    perBranch
      ? branches.reduce((sum, b) => sum + rateFor(b), 0)
      : parseAmount(form?.monthlyAmount) ?? 0

  /** Has the PRICE side changed? */
  const priceChanged = () => {
    if (!company || !form) return false

    const was =
      company.monthlyAmount === null || company.monthlyAmount === undefined
        ? ''
        : String(company.monthlyAmount)
    const wasBranch =
      company.branchMonthlyAmount === null || company.branchMonthlyAmount === undefined
        ? ''
        : String(company.branchMonthlyAmount)
    const wasMode = company.billingMode === 'Branch' ? 'Branch' : 'Company'

    return (
      parseAmount(form.monthlyAmount) !== parseAmount(was) ||
      parseAmount(form.branchMonthlyAmount) !== parseAmount(wasBranch) ||
      form.billingMode !== wasMode ||
      Number(form.invoiceLeadDays) !== Number(company.invoiceLeadDays ?? 7) ||
      form.isBillable !== (company.isBillable ?? true) ||
      changedBranches().length > 0 ||
      (form.notes ?? '') !== ''
    )
  }

  const changedBranches = () =>
    branches.filter((b) => {
      const was =
        b.monthlyAmount === null || b.monthlyAmount === undefined ? '' : String(b.monthlyAmount)
      return (b.draft ?? '') !== was
    })

  const changedAddOns = () =>
    addOns.filter((a) => {
      const was = a.isOverride ? String(a.price ?? '') : ''
      return (a.draft ?? '') !== was
    })

  const saveLabel = () => {
    const p = priceChanged()
    const n = changedAddOns().length
    if (p && n > 0) return `Save price and ${n} add-on price(s)`
    if (p) return 'Save price'
    if (n > 0) return `Save ${n} add-on price(s)`
    return 'Close'
  }

  const save = async () => {
    const doPrice = priceChanged()
    const dirtyAddOns = changedAddOns()

    if (!doPrice && dirtyAddOns.length === 0) return navigate('/billing-profiles')

    if (doPrice) {
      // VALIDATE THE FIGURE THE CHOSEN MODE ACTUALLY BILLS ON, and only that one.
      if (perBranch) {
        const rate = parseAmount(form.branchMonthlyAmount)
        if (rate === null || rate <= 0)
          return setError(
            'Billing per branch needs a standard per-branch amount greater than zero. It is ' +
              'deliberately not worked out from the company figure — that was agreed as one ' +
              'whole-company charge.',
          )
      } else {
        const amount = parseAmount(form.monthlyAmount)
        if (amount === null || amount < 0)
          return setError('Enter a monthly amount of zero or more.')
      }
    }

    setSaving(true)
    setError('')
    try {
      const done = []

      if (doPrice) {
        // Only the branches with a figure in the box.
        const branchAmounts = {}
        branches.forEach((b) => {
          if (b.draft !== '' && b.draft != null) branchAmounts[b.branchCode] = Number(b.draft)
        })

        const r = await axios.put(
          `${api}/${encodeURIComponent(cusCode)}`,
          {
            // ?? 0 because MonthlyAmount is a non-nullable decimal on the API.
            monthlyAmount: parseAmount(form.monthlyAmount) ?? 0,
            currency,
            invoiceLeadDays: Number.isFinite(Number(form.invoiceLeadDays))
              ? Number(form.invoiceLeadDays)
              : 7,
            isBillable: form.isBillable,
            billingMode: form.billingMode,
            branchMonthlyAmount: perBranch ? parseAmount(form.branchMonthlyAmount) : null,
            // Always sent on a price save, so clearing a branch's box clears its override.
            branchAmounts: perBranch ? branchAmounts : {},
            effectiveFrom: form.effectiveFrom || null,
            notes: form.notes || null,
          },
          { headers: authHeaders() },
        )
        done.push(r.data?.message ?? 'Price saved.')
      }

      if (dirtyAddOns.length > 0) {
        const payload = addOns.map((a) => ({
          addonId: a.addonId,
          price: a.draft === '' || a.draft == null ? null : Number(a.draft),
        }))
        const r = await axios.post(`${addOnApi}/${encodeURIComponent(cusCode)}`, payload, {
          headers: authHeaders(),
        })
        done.push(r.data?.message ?? `${dirtyAddOns.length} add-on price(s) saved.`)
      }

      toast.success(done.join(' '), { theme: 'colored', autoClose: 7000 })
      navigate('/billing-profiles')
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  /** Spend this client's credit against whatever they owe, now. */
  const applyCredit = async () => {
    setApplyingCredit(true)
    setError('')
    try {
      const r = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Payments/Credit/${encodeURIComponent(
          cusCode,
        )}/Apply`,
        null,
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Done.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setApplyingCredit(false)
    }
  }

  /** Stop or resume billing one add-on — saved on the spot, since it is one decision. */
  const setAddOnRenewal = async (row, renew) => {
    if (!renew) {
      const until = row.grantExpiry
        ? `They keep it until ${fmtDate(row.grantExpiry)}, then it stops.`
        : 'This grant has no expiry, so it continues and is simply not billed.'

      if (
        !(await confirm({
          title: `Stop billing ${row.addonName}?`,
          body: `${company?.companyName ?? cusCode} will not be charged for it again. ${until}`,
          detail:
            'Nothing is switched off early and nothing is cancelled — you can start billing it ' +
            'again at any time.',
          confirmText: 'Stop renewing',
        }))
      )
        return
    }

    setAddOnBusy(row.addonId)
    setError('')
    try {
      const r = await axios.post(
        `${addOnApi}/${encodeURIComponent(cusCode)}/${encodeURIComponent(row.addonId)}` +
          `/Renewal?renew=${renew}`,
        null,
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAddOnBusy(null)
    }
  }

  if (loading) return <div className="cb-fs-meta text-muted p-3">Loading…</div>

  if (!company)
    return (
      <div className="cb-card">
        <div className="cb-card__body">
          <div className="alert alert-danger rounded-0 py-2 cb-fs-body mb-2">
            {error || 'That client could not be found.'}
          </div>
          <Link to="/billing-profiles" className="btn btn-sm filter-btn rounded-0">
            Back to Billing profiles
          </Link>
        </div>
      </div>
    )

  return (
    <>
      {confirmDialog}

      <div className="app-breadcrumb">
        <button
          type="button"
          className="app-breadcrumb-back"
          title="Back to Billing profiles"
          onClick={() => navigate('/billing-profiles')}
        >
          <span className="material-icons">arrow_back</span>
        </button>
        <ol className="breadcrumb">
          <li className="breadcrumb-item">
            <Link to="/billing-profiles">Billing Profiles</Link>
          </li>
          <li className="breadcrumb-item active">{company.companyName}</li>
        </ol>
      </div>

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">payments</span>
          {company.companyName}
          <span className="cb-page-head__sub">{company.cusCode}</span>
        </h1>
        <div className="cb-page-head__actions">
          <span className="cb-fs-meta text-muted me-2">
            {company.branchCount} branch(es) ·{' '}
            {company.licenceExpiry
              ? `licence expires ${fmtDate(company.licenceExpiry)}`
              : 'no licence expiry on file'}
          </span>
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0"
            disabled={saving}
            onClick={() => navigate('/billing-profiles')}
          >
            {canManage ? 'Cancel' : 'Close'}
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={saving}
              title={
                !priceChanged() && changedAddOns().length === 0
                  ? 'Nothing has been changed'
                  : undefined
              }
              onClick={save}
            >
              {saving ? 'Saving…' : saveLabel()}
            </button>
          )}
        </div>
      </div>

      {error && <div className="alert alert-danger rounded-0 py-2 cb-fs-body">{error}</div>}

      {!canManage && (
        <div className="alert alert-secondary rounded-0 py-2 cb-fs-body">
          You can see this arrangement but not change it.
        </div>
      )}

      {/* CREDIT ON THE ACCOUNT. */}
      {company.credit > 0 && (
        <div className="alert alert-info rounded-0 py-2 cb-fs-body d-flex flex-wrap gap-2 align-items-center">
          <span className="material-icons" style={{ fontSize: 18 }}>
            savings
          </span>
          <span>
            This client is holding <strong>{money(company.credit, currency)}</strong> in credit —
            money already paid that no invoice has claimed. It comes off their next invoice
            automatically when it is issued; nobody needs to apply it.
          </span>
          <button
            type="button"
            className="btn btn-sm filter-btn rounded-0 ms-auto text-nowrap"
            disabled={creditBusy}
            onClick={loadCreditDetail}
          >
            {creditBusy ? 'Loading…' : creditDetail ? 'Hide' : 'Where from?'}
          </button>
          {canManage && (
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0 text-nowrap"
              disabled={applyingCredit}
              title="Apply it now against anything already outstanding. Normally there is nothing to do — credit is applied when an invoice is issued."
              onClick={applyCredit}
            >
              {applyingCredit ? 'Working…' : 'Apply now'}
            </button>
          )}

          {creditDetail && (
            <div className="w-100 mt-2">
              <table className="table table-sm cb-table mb-0">
                <thead>
                  <tr>
                    <th>Payment</th>
                    <th>Received</th>
                    <th>Method</th>
                    <th className="text-end">Paid</th>
                    <th className="text-end">Still unspent</th>
                  </tr>
                </thead>
                <tbody>
                  {/* Oldest first, as the server returns them. */}
                  {(creditDetail.payments ?? []).map((p) => (
                    <tr key={p.id}>
                      <td>
                        {p.paymentNo}
                        {p.isSimulated && (
                          <span className="badge bg-warning text-dark ms-1" style={{ fontSize: 9 }}>
                            TEST
                          </span>
                        )}
                        {p.providerReference && (
                          <span className="d-block cb-fs-meta text-muted">
                            {p.providerReference}
                          </span>
                        )}
                      </td>
                      <td className="cb-fs-meta">{fmtDate(p.receivedAt)}</td>
                      <td className="cb-fs-meta">{p.method}</td>
                      <td className="text-end text-nowrap">{money(p.amount, p.currency)}</td>
                      <td className="text-end text-nowrap fw-bold">
                        {money(p.credit, p.currency)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Credit and an outstanding balance should not co-exist. */}
              {creditDetail.outstanding > 0 && (
                <div className="callout-note mt-2">
                  {money(creditDetail.outstanding, creditDetail.currency)} is outstanding at the
                  same time as this credit. That normally cannot happen — use{' '}
                  <strong>Apply now</strong> to put it right.
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ---- THE ARRANGEMENT ------------------------------------------------------------ */}
      <div className="cb-card mb-3">
        <div className="cb-card__body">
          <div className="divider mb-3">How this company is billed</div>

          <div className="row g-3">
            <div className="col-md-3">
              <label className="form-label" htmlFor="bp-mode">
                Billed as
              </label>
              <select
                id="bp-mode"
                className="form-select form-select-sm rounded-0"
                disabled={!canManage}
                value={form.billingMode}
                onChange={(e) => setForm({ ...form, billingMode: e.target.value })}
              >
                <option value="Company">One company</option>
                <option value="Branch">Per branch</option>
              </select>
              <div className="form-text cb-fs-meta">
                {perBranch
                  ? 'One invoice per expiry date. Branches sharing a date are billed together.'
                  : 'One invoice for the whole company, against its earliest branch expiry.'}
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label" htmlFor="bp-amount">
                Monthly amount{perBranch ? ' (whole company)' : ''}
              </label>
              <MoneyInput
                id="bp-amount"
                currency={currency}
                value={form.monthlyAmount}
                onChange={(v) => setForm({ ...form, monthlyAmount: v })}
              />
              {perBranch && (
                <div className="form-text cb-fs-meta">
                  Not used while billed per branch. Kept so switching back does not lose it.
                </div>
              )}
            </div>

            {perBranch && (
              <div className="col-md-3">
                <label className="form-label" htmlFor="bp-branch-amount">
                  Standard per-branch amount
                </label>
                <MoneyInput
                  id="bp-branch-amount"
                  currency={currency}
                  value={form.branchMonthlyAmount}
                  onChange={(v) => setForm({ ...form, branchMonthlyAmount: v })}
                />
                <div className="form-text cb-fs-meta">
                  What a branch pays unless it is given its own figure below.
                </div>
              </div>
            )}

            <div className="col-md-3">
              <label className="form-label" htmlFor="bp-lead">
                Invoice before expiry
              </label>
              <div className="input-group input-group-sm">
                <input
                  id="bp-lead"
                  type="number"
                  min="0"
                  max="60"
                  className="form-control form-control-sm rounded-0"
                  disabled={!canManage}
                  value={form.invoiceLeadDays}
                  onChange={(e) => setForm({ ...form, invoiceLeadDays: e.target.value })}
                />
                <span className="input-group-text rounded-0 cb-fs-meta">days</span>
              </div>
              <div className="form-text cb-fs-meta">
                {company.licenceExpiry
                  ? `Invoice on ${
                      fmtDate(leadDate(company.licenceExpiry, form.invoiceLeadDays)) ?? '—'
                    }.`
                  : 'No licence expiry recorded yet.'}
              </div>
            </div>

            <div className="col-md-3">
              <label className="form-label" htmlFor="bp-from">
                Price effective from
              </label>
              <input
                id="bp-from"
                type="date"
                className="form-control form-control-sm rounded-0"
                disabled={!canManage}
                value={form.effectiveFrom}
                onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
              />
            </div>

            <div className="col-md-6">
              <label className="form-label" htmlFor="bp-note">
                Note (optional)
              </label>
              <input
                id="bp-note"
                type="text"
                className="form-control form-control-sm rounded-0"
                placeholder="e.g. agreed with the client on renewal"
                disabled={!canManage}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>

            <div className="col-md-3 d-flex align-items-end">
              <div className="form-check">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="bp-billable"
                  disabled={!canManage}
                  checked={form.isBillable}
                  onChange={(e) => setForm({ ...form, isBillable: e.target.checked })}
                />
                <label className="form-check-label cb-fs-body" htmlFor="bp-billable">
                  Invoice this client monthly
                </label>
              </div>
            </div>

            <div className="col-12">
              <div className="callout-note">
                Saving does not overwrite the current price — it closes it the day before the date
                above and starts a new one, so past invoices keep their basis.
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ---- PER-BRANCH AMOUNTS --------------------------------------------------------- */}
      {perBranch && (
        <div className="cb-card mb-3">
          <div className="cb-card__body">
            <div className="divider mb-2">What each branch pays</div>

            <p className="cb-fs-meta text-muted">
              Leave a box <strong>blank</strong> to charge the standard figure, or enter{' '}
              <strong>0</strong> to agree that a branch is not charged — the two are different and
              both are kept. Branches are grouped below by the date their licence expires, because{' '}
              <strong>branches sharing a date are billed on one invoice</strong>.
            </p>

            {branches.length === 0 ? (
              <div className="cb-empty">This client has no branches on file.</div>
            ) : (
              <div className="cb-table-wrap">
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Branch</th>
                      <th>Licence expires</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Monthly amount
                      </th>
                      <th style={{ width: '1%' }} className="text-end">
                        Charged
                      </th>
                    </tr>
                  </thead>
                  {branchGroups().map(([key, rows], gi) => (
                    <tbody key={key}>
                      <tr>
                        <td colSpan={4} style={{ background: 'var(--cb-head-bg)' }}>
                          <span className="cb-fs-meta fw-bold">
                            Invoice {gi + 1} —{' '}
                            {key === 'none'
                              ? 'no expiry on file (not billable)'
                              : `expires ${fmtDate(key)}`}
                          </span>
                          <span className="cb-fs-meta text-muted ms-2">
                            {rows.length} branch(es) ·{' '}
                            {money(
                              rows.reduce((s, b) => s + rateFor(b), 0),
                              currency,
                            )}{' '}
                            a month
                          </span>
                        </td>
                      </tr>
                      {rows.map((b) => {
                        const own = b.draft !== '' && b.draft != null
                        return (
                          <tr key={b.branchCode}>
                            <td>
                              <strong>{b.branchName || `Branch ${b.branchCode}`}</strong>
                              <span className="d-block cb-fs-meta text-muted">{b.branchCode}</span>
                            </td>
                            <td className="cb-fs-meta">
                              {b.licenceExpiry ? (
                                fmtDate(b.licenceExpiry)
                              ) : (
                                <span className="text-muted">none</span>
                              )}
                            </td>
                            <td className="text-end">
                              {/* Grouped as it is typed, like every other amount box. */}
                              <MoneyInput
                                currency={null}
                                className="form-control form-control-sm rounded-0 text-end"
                                style={{ width: 130 }}
                                placeholder="Standard"
                                disabled={!canManage}
                                value={b.draft ?? ''}
                                onChange={(v) => setBranchDraft(b.branchCode, v)}
                                aria-label={`Monthly amount for branch ${b.branchCode}`}
                              />
                            </td>
                            <td className="text-end text-nowrap cb-fs-meta">
                              <strong>{money(rateFor(b), currency)}</strong>
                              <span className="d-block text-muted">
                                {own ? 'own figure' : 'standard'}
                              </span>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  ))}
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-end fw-bold">
                        Whole company, per month
                      </td>
                      <td className="text-end fw-bold text-nowrap">
                        {money(companyTotal(), currency)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---- ADD-ONS -------------------------------------------------------------------- */}
      <div className="cb-card mb-3">
        <div className="cb-card__body">
          <div className="divider mb-2">Add-ons this client holds</div>

          <p className="cb-fs-meta text-muted">
            Leave a box <strong>blank</strong> for the default price, or enter <strong>0</strong> to
            agree no charge — the two are different and both are kept. These are billed on the SAME
            proforma as the subscription.
            {perBranch && (
              <>
                {' '}
                Add-ons are a <strong>company-level</strong> charge even while the licence is billed
                per branch — charged once however many branches hold them, and carried on the
                earliest expiry group&apos;s invoice.
              </>
            )}
          </p>

          {addOns.filter((a) => a.branches > 0).length === 0 ? (
            <div className="cb-empty">This client holds no add-ons.</div>
          ) : (
            <div className="cb-table-wrap">
              <table className="table table-sm cb-table mb-0">
                <thead>
                  <tr>
                    <th>Add-on</th>
                    <th style={{ width: '1%' }} className="text-end">
                      Branches
                    </th>
                    <th style={{ width: '1%' }} className="text-end">
                      Default
                    </th>
                    <th style={{ width: '1%' }} className="text-end">
                      This client pays
                    </th>
                    <th style={{ width: '1%' }} className="text-end">
                      Charged
                    </th>
                    <th style={{ width: '1%' }}>Renewal</th>
                  </tr>
                </thead>
                <tbody>
                  {addOns
                    .filter((a) => a.branches > 0)
                    .map((a) => {
                      const draft = a.draft
                      const own = draft !== '' && draft != null
                      const fallback = a.cataloguePrice
                      const effective = own ? Number(draft) : fallback
                      const billed = effective > 0 && !a.isPerpetual && !a.doNotRenew

                      // The reason an add-on is not billed used to live in its own column.
                      const why = a.isPerpetual
                        ? 'Never billed — the grant does not expire, so there is nothing to renew.'
                        : a.doNotRenew
                        ? `Stopping${a.grantExpiry ? ` after ${fmtDate(a.grantExpiry)}` : ''}.`
                        : billed
                        ? null
                        : own
                        ? 'Not billed — agreed at no charge.'
                        : 'Not billed — no price set anywhere.'

                      return (
                        <tr key={a.addonId}>
                          <td>
                            <strong>{a.addonName}</strong>
                            <span className="d-block cb-fs-meta text-muted">{a.addonId}</span>
                            {why && <span className="d-block cb-fs-meta text-muted">{why}</span>}
                          </td>
                          <td className="text-end cb-fs-meta">{a.branches}</td>
                          <td className="text-end text-nowrap cb-fs-meta">
                            {fallback > 0 ? (
                              money(fallback, currency)
                            ) : (
                              <span className="text-muted">none</span>
                            )}
                          </td>
                          <td className="text-end">
                            <MoneyInput
                              currency={null}
                              className="form-control form-control-sm rounded-0 text-end"
                              style={{ width: 120 }}
                              placeholder="Default"
                              disabled={!canManage || a.isPerpetual}
                              value={draft ?? ''}
                              onChange={(v) => setAddOnDraft(a.addonId, v)}
                              aria-label={`Price for ${a.addonName}`}
                            />
                          </td>
                          <td className="text-end text-nowrap cb-fs-meta">
                            {billed ? (
                              <>
                                <strong>{money(effective, currency)}</strong>
                                <span className="d-block text-muted">
                                  {own ? 'agreed' : 'default'}
                                </span>
                              </>
                            ) : (
                              <span className="text-muted">—</span>
                            )}
                          </td>
                          <td className="text-nowrap">
                            {a.isPerpetual ? (
                              <span className="text-muted">—</span>
                            ) : a.doNotRenew ? (
                              <button
                                type="button"
                                className="btn btn-sm filter-btn rounded-0 text-nowrap"
                                disabled={!canManage || addOnBusy === a.addonId}
                                onClick={() => setAddOnRenewal(a, true)}
                              >
                                Bill it again
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="btn btn-sm cancel-btn rounded-0 text-nowrap"
                                disabled={!canManage || addOnBusy === a.addonId}
                                title="The client keeps it until the date already paid for, then it is not renewed."
                                onClick={() => setAddOnRenewal(a, false)}
                              >
                                Stop renewing
                              </button>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ---- PRICE HISTORY -------------------------------------------------------------- */}
      <div className="cb-card">
        <div className="cb-card__body">
          <div className="divider mb-2">Price history</div>

          {history.length === 0 ? (
            <div className="cb-empty">No price has been set yet.</div>
          ) : (
            <div className="cb-table-wrap">
              <table className="table table-sm cb-table mb-0">
                <thead>
                  <tr>
                    <th>From</th>
                    <th>To</th>
                    <th>Billed as</th>
                    <th className="text-end">Amount</th>
                    <th>Note</th>
                    <th>Set by</th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((p) => {
                    const wasBranch = p.billingMode === 'Branch'
                    return (
                      <tr key={p.id}>
                        <td className="text-nowrap">
                          {fmtDate(p.effectiveFrom)}
                          {p.isCurrent && (
                            <span className="badge bg-success ms-1" style={{ fontSize: 9 }}>
                              CURRENT
                            </span>
                          )}
                        </td>
                        <td className="text-nowrap">
                          {p.effectiveTo ? (
                            fmtDate(p.effectiveTo)
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                        <td className="cb-fs-meta">
                          {wasBranch ? 'Per branch' : 'One company'}
                          {wasBranch && p.branchOverrides > 0 && (
                            <span className="d-block text-muted">
                              {p.branchOverrides} branch(es) on their own figure
                            </span>
                          )}
                        </td>
                        {/* The figure that APPLIED. */}
                        <td className="text-end text-nowrap">
                          {wasBranch
                            ? `${money(p.branchMonthlyAmount, p.currency)} /branch`
                            : money(p.monthlyAmount, p.currency)}
                          {!p.isBillable && (
                            <span className="d-block text-muted cb-fs-meta">paused</span>
                          )}
                        </td>
                        <td className="cb-fs-meta">
                          {p.notes || <span className="text-muted">—</span>}
                        </td>
                        <td className="cb-fs-meta text-muted">{p.createdBy}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  )
}

export default BillingProfileEditor
