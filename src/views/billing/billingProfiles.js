import React, { useState, useEffect, useCallback } from 'react'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import MoneyInput from '../../components/MoneyInput'
import { formatMoney as money, parseAmount } from '../../utils/money'
import DataTable from '../../components/DataTable'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/**
 * Billing Profiles — what each company pays per month.
 *
 * Driven from the client list rather than from the price table, so companies that have never been
 * priced appear too and lead the listing. Those are the ones needing attention, and a screen
 * showing only the priced ones would hide exactly the gap it exists to close.
 *
 * A price is never edited in place. Changing one closes the current period and opens a new one, so
 * an invoice raised months ago can still be explained by the price that was in force then — which
 * is why every company carries a history rather than a single amount.
 */
const STATES = [
  { key: '', label: 'All' },
  { key: 'unpriced', label: 'Not priced' },
  { key: 'billable', label: 'Billable' },
  { key: 'paused', label: 'Paused' },
]

const BillingProfiles = () => {
  // Replaces window.confirm / window.prompt — the browser prefixes those with its own
  // hostname, cannot mark a destructive action, and cannot require an answer. See useConfirm.
  const [confirm, confirmDialog] = useConfirm()
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/BillingProfiles`

  // Add-on prices live under Invoices, where the catalogue is. Reached from here because this is
  // now the one window where a client's whole billing arrangement is set.
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

  const [items, setItems] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [search, setSearch] = useState('')
  const [state, setState] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // The open editor: the company plus its history, loaded on demand.
  const [editing, setEditing] = useState(null)
  const [history, setHistory] = useState([])
  const [form, setForm] = useState(null)
  const [saving, setSaving] = useState(false)

  // This client's ADD-ONS, edited in the same window as their price.
  //
  // Finance set a client up in one sitting: the monthly figure, and what they pay for each add-on
  // they hold. Those lived on two screens, which meant leaving a half-filled price to go and find
  // the other one. The catalogue DEFAULTS still live under Add-on pricing — that is a global
  // price list, not part of any one client.
  //
  // `draft` is WHAT IS IN THE BOX, kept apart from what the server said. Blank means "use the
  // default" and 0 means "agreed at no charge", and those are only distinguishable while the edit
  // is held as a string.
  const [addOns, setAddOns] = useState([])
  const [addOnsLoading, setAddOnsLoading] = useState(false)
  const [addOnBusy, setAddOnBusy] = useState(null)

  // Which client's Auto switch is mid-save. Held by cus code rather than as a boolean so one row
  // being saved does not freeze the switch on every other row.
  const [autoBusy, setAutoBusy] = useState(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        axios.get(api, {
          params: { search: search || '', state: state || '', page, pageSize },
          headers: authHeaders(),
        }),
        axios.get(`${api}/Summary`, { headers: authHeaders() }),
      ])
      setItems(list.data?.items ?? [])
      setTotal(list.data?.total ?? 0)
      setSummary(s.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, search, state, page, pageSize])

  // Filter changes invalidate the page number, so it resets at the source rather than in an
  // effect — that avoids firing a request for a page that no longer exists.
  const changeSearch = (v) => {
    setSearch(v)
    setPage(1)
  }
  const changeState = (v) => {
    setState(v)
    setPage(1)
  }

  useEffect(() => {
    const t = setTimeout(() => load(), 250)
    return () => clearTimeout(t)
  }, [load])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 12000)
      return () => clearTimeout(t)
    }
  }, [error])

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : null

  // ISO yyyy-mm-dd for the date input, which will not accept a localised string.
  const isoToday = () => new Date().toISOString().slice(0, 10)

  /**
   * Expiry minus the lead days — the same arithmetic the server does, so the editor can preview
   * the invoice date live as the lead time is typed. The server stays the authority; this only
   * shows what it will decide.
   */
  const leadDate = (expiry, leadDays) => {
    if (!expiry) return null
    const n = Number(leadDays)
    if (!Number.isFinite(n)) return null
    const d = new Date(expiry)
    d.setDate(d.getDate() - n)
    return d
  }

  const open = async (row) => {
    setEditing(row)
    setHistory([])
    setForm({
      // A clean numeric string, which is what MoneyInput works in and what parseAmount expects.
      monthlyAmount:
        row.monthlyAmount === null || row.monthlyAmount === undefined
          ? ''
          : String(row.monthlyAmount),
      invoiceLeadDays: row.invoiceLeadDays ?? 7,
      isBillable: row.isBillable ?? true,
      effectiveFrom: isoToday(),
      notes: '',
    })
    try {
      const r = await axios.get(`${api}/${encodeURIComponent(row.cusCode)}`, {
        headers: authHeaders(),
      })
      setHistory(r.data?.history ?? [])
    } catch (e) {
      setError(readErr(e))
    }

    await loadAddOns(row.cusCode)
  }

  const loadAddOns = async (cusCode) => {
    setAddOnsLoading(true)
    setAddOns([])
    try {
      const r = await axios.get(`${addOnApi}/${encodeURIComponent(cusCode)}`, {
        headers: authHeaders(),
      })
      setAddOns(
        (r.data?.items ?? []).map((a) => ({
          ...a,
          draft: a.isOverride ? String(a.price ?? '') : '',
        })),
      )
    } catch (e) {
      // Not fatal. A client with no add-ons, or a lookup that fails, must not stop somebody
      // setting the monthly price — which is what they most often came here to do.
      setAddOns([])
    } finally {
      setAddOnsLoading(false)
    }
  }

  const setAddOnDraft = (addonId, draft) =>
    setAddOns((list) => list.map((a) => (a.addonId === addonId ? { ...a, draft } : a)))

  /**
   * Stop or resume billing one add-on for this client — how an add-on is DECLINED.
   *
   * Saved on the spot rather than with the Save button. The price boxes are a draft somebody
   * reviews; this is a single decision, and the confirmation names the date they keep because
   * "stop renewing" otherwise reads as switching the feature off today.
   */
  const setAddOnRenewal = async (row, renew) => {
    if (!renew) {
      const until = row.grantExpiry
        ? `They keep it until ${fmtDate(row.grantExpiry)}, then it stops.`
        : 'This grant has no expiry, so it continues and is simply not billed.'

      if (
        !(await confirm({
          title: `Stop billing ${row.addonName}?`,
          body: `${
            editing?.companyName ?? editing?.cusCode
          } will not be charged for it again. ${until}`,
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
        `${addOnApi}/${encodeURIComponent(editing.cusCode)}/${encodeURIComponent(row.addonId)}` +
          `/Renewal?renew=${renew}`,
        null,
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 7000 })
      await loadAddOns(editing.cusCode)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAddOnBusy(null)
    }
  }

  /**
   * Has the PRICE side actually been changed?
   *
   * This matters because saving a price does not overwrite it — it closes the current period and
   * opens a new one. So a Save pressed only to change an add-on figure would leave a spurious
   * price period in the history, dated today, identical to the one before it. Over a year of
   * add-on edits the history would stop being readable, which is the one thing it is for.
   *
   * A note on its own counts as a change: somebody who typed one meant it to be recorded.
   */
  const priceChanged = () => {
    if (!editing || !form) return false

    const was =
      editing.monthlyAmount === null || editing.monthlyAmount === undefined
        ? ''
        : String(editing.monthlyAmount)

    return (
      parseAmount(form.monthlyAmount) !== parseAmount(was) ||
      Number(form.invoiceLeadDays) !== Number(editing.invoiceLeadDays ?? 7) ||
      form.isBillable !== (editing.isBillable ?? true) ||
      (form.notes ?? '') !== ''
    )
  }

  /** Add-on boxes whose contents differ from what the server last said. */
  const changedAddOns = () =>
    addOns.filter((a) => {
      const was = a.isOverride ? String(a.price ?? '') : ''
      return (a.draft ?? '') !== was
    })

  /**
   * One Save for the whole window — price and add-ons together, which is the point of putting
   * them on one screen.
   *
   * The price goes FIRST and a failure there stops the rest: the add-on figures are only
   * meaningful against a price that saved, and leaving half the arrangement applied would be
   * worse than applying none of it.
   */
  const save = async () => {
    const doPrice = priceChanged()
    const dirtyAddOns = changedAddOns()

    if (!doPrice && dirtyAddOns.length === 0) {
      setEditing(null)
      return
    }

    if (doPrice) {
      const amount = parseAmount(form.monthlyAmount)
      if (amount === null || amount < 0) return setError('Enter a monthly amount of zero or more.')
    }

    setSaving(true)
    setError('')
    try {
      const done = []

      if (doPrice) {
        const amount = parseAmount(form.monthlyAmount)

        const r = await axios.put(
          `${api}/${encodeURIComponent(editing.cusCode)}`,
          {
            monthlyAmount: amount,
            currency: editing.currency || 'KES',
            // 0 is meaningful — "invoice on the expiry day itself" — so it must not fall through
            // a truthiness check to the default.
            invoiceLeadDays: Number.isFinite(Number(form.invoiceLeadDays))
              ? Number(form.invoiceLeadDays)
              : 7,
            isBillable: form.isBillable,
            effectiveFrom: form.effectiveFrom || null,
            notes: form.notes || null,
          },
          { headers: authHeaders() },
        )
        done.push(r.data?.message ?? 'Price saved.')
      }

      if (dirtyAddOns.length > 0) {
        // The WHOLE set, not just the changed rows: the endpoint takes a client's add-on prices
        // together, and a blank box has to be sent as null to clear an override rather than being
        // omitted and left as it was.
        const payload = addOns.map((a) => ({
          addonId: a.addonId,
          price: a.draft === '' || a.draft == null ? null : Number(a.draft),
        }))

        const r = await axios.post(`${addOnApi}/${encodeURIComponent(editing.cusCode)}`, payload, {
          headers: authHeaders(),
        })
        done.push(r.data?.message ?? `${dirtyAddOns.length} add-on price(s) saved.`)
      }

      toast.success(done.join(' '), { theme: 'colored', autoClose: 7000 })
      setEditing(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  /** What the Save button will actually write, said on the button itself. */
  const saveLabel = () => {
    const p = priceChanged()
    const n = changedAddOns().length

    if (p && n > 0) return `Save price and ${n} add-on price(s)`
    if (p) return 'Save price'
    if (n > 0) return `Save ${n} add-on price(s)`
    return 'Close'
  }

  const stop = async (row) => {
    if (
      !(await confirm({
        title: `Stop billing ${row.companyName}?`,
        body: 'No further invoices will be raised.',
        detail: 'The price history is kept, so billing can be started again later.',
        danger: true,
        confirmText: 'Stop billing',
      }))
    )
      return
    try {
      await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/Stop`,
        { effectiveTo: null },
        { headers: authHeaders() },
      )
      toast.success('Billing stopped.', { theme: 'colored', autoClose: 4000 })
      setEditing(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  /**
   * Switch auto-invoicing for one client.
   *
   * Turning it ON is confirmed; turning it OFF is not. On means this client's invoices will reach
   * them without anyone looking first — worth a deliberate yes. Off only adds a review step, so
   * making someone confirm it would be a dialog that always gets dismissed.
   */
  const toggleAuto = async (row) => {
    const on = !row.autoIssue
    if (
      on &&
      !(await confirm({
        title: `Switch auto-invoicing on for ${row.companyName}?`,
        body:
          'From the next nightly run their invoice will be issued without review: it becomes ' +
          'payable, is emailed with the PDF and is texted to them.',
        detail: `Their current price is ${money(row.monthlyAmount, row.currency)} a month.`,
        confirmText: 'Switch it on',
      }))
    )
      return

    setAutoBusy(row.cusCode)
    setError('')
    try {
      const r = await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/AutoIssue`,
        { autoIssue: on },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAutoBusy(null)
    }
  }

  /**
   * Mark a client as paying by standing order.
   *
   * Changes how they are TOLD, not what they are charged. Their bank pays us on a schedule, so a
   * client a day past due has not forgotten — the chase holds off for a week and their reminders
   * say the standing order is expected rather than demanding payment.
   *
   * Not confirmed either way: nothing is sent, nothing is billed, and it is trivially reversible.
   */
  const toggleStandingOrder = async (row) => {
    setAutoBusy(row.cusCode)
    setError('')
    try {
      const r = await axios.post(
        `${api}/${encodeURIComponent(row.cusCode)}/StandingOrder`,
        { paysByStandingOrder: !row.paysByStandingOrder },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Saved.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAutoBusy(null)
    }
  }

  const stateBadge = (r) => {
    if (!r.hasPrice)
      return (
        <span className="badge bg-warning text-dark" style={{ fontSize: 9 }}>
          Not priced
        </span>
      )
    if (r.isBillable === false)
      return (
        <span className="badge bg-secondary" style={{ fontSize: 9 }}>
          Paused
        </span>
      )
    return (
      <span className="badge bg-success" style={{ fontSize: 9 }}>
        Billable
      </span>
    )
  }

  const surface = (r) =>
    r.cloudBranches === 0
      ? { label: 'Desktop', cls: 'bg-dark' }
      : r.desktopBranches === 0
      ? { label: 'Cloud', cls: 'bg-info text-dark' }
      : { label: 'Mixed', cls: 'bg-secondary' }

  return (
    <>
      {confirmDialog}

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">payments</span>
          Billing Profiles
          {summary && (
            <span className="cb-page-head__sub">
              {summary.companiesPriced} of {summary.companiesTotal} priced
            </span>
          )}
        </h1>
        {summary && (
          <div className="cb-page-head__actions">
            <span className="cb-fs-table text-muted">
              Monthly total{' '}
              <span className="fw-bold text-body">
                {money(summary.monthlyTotal, summary.currency)}
              </span>
            </span>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      {summary?.companiesUnpriced > 0 && (
        <div className="alert alert-warning rounded-0 py-1 mb-2 cb-fs-body">
          <span className="fw-bold">{summary.companiesUnpriced}</span> client(s) have no price set.
          A client with no price is never invoiced — that is how a non-subscription client is kept
          out of billing, so this number is only a problem if someone is missing from it.
        </div>
      )}

      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={items}
            rowKey={(r) => r.cusCode}
            loading={loading}
            maxHeight="58vh"
            search={{
              value: search,
              placeholder: 'Search client name or code…',
              onChange: changeSearch,
            }}
            toolbar={
              <select
                className="form-select form-select-sm rounded-0 filter-control"
                style={{ width: 130 }}
                value={state}
                aria-label="Filter by billing state"
                onChange={(e) => changeState(e.target.value)}
              >
                {STATES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            }
            empty={{ icon: 'payments', title: 'No clients match.' }}
            page={{
              page,
              pageSize,
              total,
              onPage: setPage,
              onPageSize: (n) => {
                setPageSize(n)
                setPage(1)
              },
            }}
            columns={[
              {
                key: 'companyName',
                title: 'Client',
                icon: 'apartment',
                render: (r) => (
                  <>
                    <span className="d-block fw-bold text-truncate" style={{ maxWidth: 240 }}>
                      {r.companyName}
                    </span>
                    <span className="d-block text-muted">{r.cusCode}</span>
                  </>
                ),
              },
              {
                key: 'type',
                title: 'Type',
                icon: 'cloud',
                width: '1%',
                align: 'center',
                render: (r) => {
                  const s = surface(r)
                  return (
                    <span className={`badge ${s.cls}`} style={{ fontSize: 9 }}>
                      {s.label}
                    </span>
                  )
                },
              },
              {
                key: 'branchCount',
                title: 'Branches',
                icon: 'store',
                width: '1%',
                align: 'center',
              },
              {
                key: 'licensedUsers',
                title: 'Users',
                icon: 'group',
                width: '1%',
                align: 'center',
              },
              {
                key: 'monthlyAmount',
                title: 'Monthly',
                icon: 'payments',
                width: '130px',
                render: (r) => (
                  <>
                    <span className="fw-bold">{money(r.monthlyAmount, r.currency)}</span>
                    {r.hasPrice && (
                      <span className="d-block text-muted">
                        from {fmtDate(r.effectiveFrom)}
                        {r.priceChanges > 1 && ` · ${r.priceChanges} price changes`}
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'licenceExpiry',
                title: 'Licence expires',
                icon: 'event',
                width: '1%',
                nowrap: true,
                render: (r) =>
                  fmtDate(r.licenceExpiry) ?? <span className="text-muted">not set</span>,
              },
              {
                key: 'nextInvoiceDate',
                title: 'Invoice on',
                icon: 'receipt_long',
                width: '1%',
                nowrap: true,
                render: (r) =>
                  r.nextInvoiceDate ? (
                    <>
                      <span className="d-block fw-bold">{fmtDate(r.nextInvoiceDate)}</span>
                      <span
                        className={
                          r.daysUntilInvoice < 0
                            ? 'text-danger'
                            : r.daysUntilInvoice <= 7
                            ? 'text-warning-emphasis'
                            : 'text-muted'
                        }
                      >
                        {r.daysUntilInvoice < 0
                          ? `due ${Math.abs(r.daysUntilInvoice)}d ago`
                          : r.daysUntilInvoice === 0
                          ? 'today'
                          : `in ${r.daysUntilInvoice}d`}
                        {' · '}
                        {r.invoiceLeadDays}d before
                      </span>
                    </>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
              {
                key: 'status',
                title: 'Status',
                icon: 'info_outline',
                width: '1%',
                align: 'center',
                render: (r) => stateBadge(r),
              },
              {
                key: 'autoIssue',
                title: 'Auto',
                icon: 'bolt',
                width: '1%',
                align: 'center',
                hint:
                  "On: the nightly run issues this client's invoice — emailed, texted and payable. " +
                  'Off: it raises a draft for you to check.',
                // Only meaningful once priced — there is nothing to issue automatically for a
                // client nobody has set a price for.
                render: (r) =>
                  !r.hasPrice ? (
                    <span className="text-muted">—</span>
                  ) : canManage ? (
                    <span className="form-check form-switch d-inline-block m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!r.autoIssue}
                        disabled={autoBusy === r.cusCode}
                        aria-label={`Auto-invoicing for ${r.companyName}`}
                        title={
                          r.autoIssue
                            ? 'On — invoices are issued, emailed and texted without review'
                            : 'Off — invoices are raised as drafts for you to issue'
                        }
                        onChange={() => toggleAuto(r)}
                      />
                    </span>
                  ) : (
                    <span
                      className={`badge ${r.autoIssue ? 'bg-success' : 'bg-secondary'}`}
                      style={{ fontSize: 9 }}
                    >
                      {r.autoIssue ? 'On' : 'Off'}
                    </span>
                  ),
              },
              {
                key: 'paysByStandingOrder',
                title: 'S/O',
                icon: 'event_repeat',
                width: '1%',
                align: 'center',
                hint:
                  'Pays by bank standing order. Their reminders say the payment is expected ' +
                  'rather than overdue, and the chase waits a week before starting — the credit ' +
                  'is usually in transit, and chasing invites a second payment.',
                render: (r) =>
                  canManage ? (
                    <span className="form-check form-switch d-inline-block m-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        role="switch"
                        checked={!!r.paysByStandingOrder}
                        disabled={autoBusy === r.cusCode}
                        aria-label={`Standing order for ${r.companyName}`}
                        title={
                          r.paysByStandingOrder
                            ? 'On — reminders say the standing order is expected, and the chase waits a week'
                            : 'Off — chased from the due date like any other client'
                        }
                        onChange={() => toggleStandingOrder(r)}
                      />
                    </span>
                  ) : r.paysByStandingOrder ? (
                    <span className="badge bg-info text-dark" style={{ fontSize: 9 }}>
                      Yes
                    </span>
                  ) : (
                    <span className="text-muted">—</span>
                  ),
              },
            ]}
            actionsLabel="Actions"
            actions={(r) => {
              // Icon-only, with the wording in the tooltip — the label still differs by state
              // ("Set price" for an unpriced client), which a text button could not keep uniform.
              const label = canManage
                ? r.hasPrice
                  ? 'Change the price'
                  : 'Set a price'
                : 'Price history'
              return (
                <>
                  <button
                    type="button"
                    className={`cb-act${canManage ? ' cb-act--primary' : ''}`}
                    title={`${label} for ${r.companyName}`}
                    aria-label={`${label} for ${r.companyName}`}
                    onClick={() => open(r)}
                  >
                    <span className="material-icons">
                      {canManage ? (r.hasPrice ? 'edit' : 'add') : 'history'}
                    </span>
                  </button>
                  {canManage && r.hasPrice && r.isBillable && (
                    <button
                      type="button"
                      className="cb-act cb-act--danger"
                      title={`Stop billing ${r.companyName}`}
                      aria-label={`Stop billing ${r.companyName}`}
                      onClick={() => stop(r)}
                    >
                      <span className="material-icons">block</span>
                    </button>
                  )}
                </>
              )
            }}
          />
        </div>
      </div>

      {/* Set / change price, with the company's full price history beside it */}
      <CModal visible={!!editing} onClose={() => setEditing(null)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {editing?.companyName}
            <span className="text-muted ms-2 cb-fs-meta">{editing?.cusCode}</span>
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {editing && form && (
            <div className="row g-3">
              <div className="col-md-6">
                <div className="divider mb-2">
                  {canManage
                    ? editing.hasPrice
                      ? 'Change the price'
                      : 'Set a price'
                    : 'Current price'}
                </div>

                {canManage ? (
                  <>
                    <div className="mb-2">
                      <label className="form-label" htmlFor="bp-amount">
                        Monthly amount
                      </label>
                      <MoneyInput
                        id="bp-amount"
                        currency={editing.currency || 'KES'}
                        value={form.monthlyAmount}
                        onChange={(v) => setForm({ ...form, monthlyAmount: v })}
                      />
                    </div>
                    <div className="row g-2 mb-2">
                      <div className="col-6">
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
                            value={form.invoiceLeadDays}
                            onChange={(e) => setForm({ ...form, invoiceLeadDays: e.target.value })}
                          />
                          <span className="input-group-text rounded-0 cb-fs-meta">days</span>
                        </div>
                        <div className="form-text cb-fs-meta">
                          {editing.licenceExpiry
                            ? `Licence expires ${fmtDate(editing.licenceExpiry)} — invoice on ${
                                fmtDate(leadDate(editing.licenceExpiry, form.invoiceLeadDays)) ??
                                '—'
                              }.`
                            : 'No licence expiry recorded for this client yet.'}
                        </div>
                      </div>
                      <div className="col-6">
                        <label className="form-label" htmlFor="bp-from">
                          Price effective from
                        </label>
                        <input
                          id="bp-from"
                          type="date"
                          className="form-control form-control-sm rounded-0"
                          value={form.effectiveFrom}
                          onChange={(e) => setForm({ ...form, effectiveFrom: e.target.value })}
                        />
                      </div>
                    </div>
                    <div className="form-check mb-2">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="bp-billable"
                        checked={form.isBillable}
                        onChange={(e) => setForm({ ...form, isBillable: e.target.checked })}
                      />
                      <label className="form-check-label cb-fs-table" htmlFor="bp-billable">
                        Invoice this client monthly
                      </label>
                    </div>
                    <div className="mb-2">
                      <label className="form-label">Note (optional)</label>
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="e.g. agreed with the client on renewal"
                        value={form.notes}
                        onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      />
                    </div>

                    <div className="alert alert-info rounded-0 py-1 cb-fs-meta mb-0">
                      This does not overwrite the current price — it closes it the day before the
                      date above and starts a new one, so past invoices keep their basis.
                    </div>
                  </>
                ) : (
                  <div className="cb-fs-body">
                    {money(editing.monthlyAmount, editing.currency)}
                    {editing.hasPrice && (
                      <span className="text-muted"> from {fmtDate(editing.effectiveFrom)}</span>
                    )}
                  </div>
                )}
              </div>

              <div className="col-md-6">
                <div className="divider mb-2">Price history</div>
                {history.length === 0 ? (
                  <div className="cb-empty" style={{ padding: '20px 10px' }}>
                    No price has been set yet.
                  </div>
                ) : (
                  <div className="cb-table-wrap" style={{ maxHeight: 280, overflowY: 'auto' }}>
                    <table className="table table-sm cb-table mb-0">
                      <thead>
                        <tr>
                          <th>Amount</th>
                          <th>Period</th>
                          <th style={{ width: '1%' }}></th>
                        </tr>
                      </thead>
                      <tbody>
                        {history.map((h) => (
                          <tr key={h.id}>
                            <td className="fw-bold">{money(h.monthlyAmount, h.currency)}</td>
                            <td className="cb-fs-meta">
                              {fmtDate(h.effectiveFrom)} →{' '}
                              {h.effectiveTo ? fmtDate(h.effectiveTo) : 'now'}
                              {h.notes && <span className="d-block text-muted">{h.notes}</span>}
                              {h.createdBy && (
                                <span className="d-block text-muted">set by {h.createdBy}</span>
                              )}
                            </td>
                            <td>
                              {h.isCurrent && (
                                <span className="badge bg-success" style={{ fontSize: 9 }}>
                                  current
                                </span>
                              )}
                              {!h.isBillable && (
                                <span className="badge bg-secondary ms-1" style={{ fontSize: 9 }}>
                                  paused
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* ---- this client's ADD-ONS ----

                  Full width, below the price, because it is a list rather than a form and
                  because the price is still the main event. Hidden entirely when the client
                  holds nothing: a table of dashes would be noise on most clients. */}
              {addOns.some((a) => a.branches > 0) && (
                <div className="col-12">
                  <div className="divider mb-2">Add-ons this client holds</div>

                  <p className="cb-fs-meta text-muted">
                    Leave a box <strong>blank</strong> for the default price, or enter{' '}
                    <strong>0</strong> to agree no charge for this client — the two are different
                    and both are kept. These are billed on the SAME proforma as the subscription.
                  </p>

                  {addOnsLoading ? (
                    <div className="cb-fs-meta text-muted">Loading add-ons…</div>
                  ) : (
                    <div className="cb-table-wrap" style={{ maxHeight: 260, overflowY: 'auto' }}>
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
                            <th>In force</th>
                            <th style={{ width: '1%' }}>Renewal</th>
                          </tr>
                        </thead>
                        <tbody>
                          {addOns
                            .filter((a) => a.branches > 0)
                            .map((a) => {
                              const own = a.draft !== '' && a.draft != null
                              const effective = own ? Number(a.draft) : a.cataloguePrice
                              const billed = effective > 0 && !a.isPerpetual && !a.doNotRenew
                              const cur = editing.currency || 'KES'

                              return (
                                <tr key={a.addonId}>
                                  <td>
                                    <strong>{a.addonName}</strong>
                                    <span className="d-block cb-fs-meta text-muted">
                                      {a.addonId}
                                    </span>
                                  </td>
                                  <td className="text-end cb-fs-meta">{a.branches}</td>
                                  <td className="text-end text-nowrap cb-fs-meta">
                                    {a.cataloguePrice > 0 ? (
                                      money(a.cataloguePrice, cur)
                                    ) : (
                                      <span className="text-muted">none</span>
                                    )}
                                  </td>
                                  <td className="text-end">
                                    <input
                                      type="number"
                                      min="0"
                                      step="0.01"
                                      className="form-control form-control-sm rounded-0 text-end"
                                      style={{ width: 110 }}
                                      placeholder="Default"
                                      disabled={!canManage || a.isPerpetual}
                                      value={a.draft ?? ''}
                                      onChange={(e) => setAddOnDraft(a.addonId, e.target.value)}
                                      aria-label={`Price for ${a.addonName}`}
                                    />
                                  </td>
                                  <td className="cb-fs-meta">
                                    {/* Read from the DRAFT, so the row previews what saving
                                        would do. Typing 0 should read "not billed" at once
                                        rather than keep showing the default. */}
                                    {a.isPerpetual ? (
                                      <span className="text-muted">
                                        Never billed — the grant does not expire, so there is
                                        nothing to renew.
                                      </span>
                                    ) : a.doNotRenew ? (
                                      <span className="text-muted">
                                        Stopping
                                        {a.grantExpiry && <> after {fmtDate(a.grantExpiry)}</>}.
                                      </span>
                                    ) : !billed ? (
                                      <span className="text-muted">
                                        {own
                                          ? 'Not billed — agreed at no charge.'
                                          : 'Not billed — no price set anywhere.'}
                                      </span>
                                    ) : (
                                      <>
                                        <strong>{money(effective, cur)}</strong>{' '}
                                        {own ? (
                                          <span
                                            className="badge bg-info text-dark"
                                            style={{ fontSize: 9 }}
                                          >
                                            AGREED
                                          </span>
                                        ) : (
                                          <span className="text-muted">from the default</span>
                                        )}
                                        {a.grantExpiry && (
                                          <span className="d-block text-muted">
                                            renews {fmtDate(a.grantExpiry)}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </td>
                                  <td className="text-nowrap">
                                    {a.isPerpetual ? (
                                      <span className="text-muted">—</span>
                                    ) : a.doNotRenew ? (
                                      <button
                                        type="button"
                                        className="btn btn-sm filter-btn rounded-0"
                                        disabled={!canManage || addOnBusy === a.addonId}
                                        onClick={() => setAddOnRenewal(a, true)}
                                      >
                                        Bill it again
                                      </button>
                                    ) : (
                                      <button
                                        type="button"
                                        className="btn btn-sm cancel-btn rounded-0"
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
              )}

              <div className="col-12 d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  disabled={saving}
                  onClick={() => setEditing(null)}
                >
                  {canManage ? 'Cancel' : 'Close'}
                </button>
                {canManage && (
                  <button
                    type="button"
                    className="btn btn-sm add-btn rounded-0"
                    disabled={saving}
                    // The label says what pressing it WILL write. A button reading "Save price"
                    // that silently also saved add-ons — or one reading "Save" that quietly
                    // opened a price period nobody asked for — is the thing to avoid here.
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
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default BillingProfiles
