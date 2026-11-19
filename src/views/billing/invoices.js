import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import { formatMoney as money } from '../../utils/money'
import { downloadFile } from '../../utils/download'
import DataTable from '../../components/DataTable'
import ClientPicker from '../../components/ClientPicker'
import useConfirm from '../../components/useConfirm'
const axios = require('axios')

/**
 * Proforma invoices — the ledger, and the run that fills it.
 *
 * PROFORMA, not tax invoices: each one requests payment for a renewal that has not been delivered
 * yet, and the tax invoice is raised against the money once it arrives. The wording is what
 * changed — the table, the routes and the INV- numbering are untouched, since those are internal
 * and renumbering a gapless sequence mid-year would split it across two formats for no gain.
 *
 * The run is DRY BY DEFAULT and shows every company it considered with the decision it made,
 * including why each was skipped. Only after reading that does the Raise button commit anything:
 * billing a hundred clients is not an action to take on trust.
 *
 * Invoices arrive as drafts. A draft owes nobody anything — issuing is the deliberate step that
 * makes it payable and emails it to the client.
 */
const STATUSES = [
  { key: '', label: 'All' },
  { key: 'Draft', label: 'Drafts' },
  { key: 'open', label: 'Outstanding' },
  { key: 'Paid', label: 'Paid' },
  { key: 'Cancelled', label: 'Cancelled' },
]

const STATUS_BADGE = {
  Draft: 'bg-secondary',
  Issued: 'bg-info text-dark',
  PartiallyPaid: 'bg-warning text-dark',
  Paid: 'bg-success',
  Cancelled: 'bg-dark',
}

const Invoices = () => {
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Invoices`
  const canManage = hasModule(MODULES.ManageBilling)

  // Replaces window.confirm, which the browser prefixes with "localhost:3000 says" and which
  // cannot show a formatted figure or mark a destructive action. See useConfirm.
  const [confirm, confirmDialog] = useConfirm()

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
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)

  // Searching and paging INSIDE the preview modals.
  //
  // Both list every client in the database — 191 and growing — and a scrollbar is not a way to
  // find one. The data is already in the browser (the run returns every candidate so the totals
  // can be computed from the ticks), so this filters and pages in memory rather than re-querying.
  //
  // Deliberately NOT applied to the selection: ticking is by cus code and "Select all" means all
  // that qualify, not all that happen to be on screen. Filtering the view must never silently
  // change what is about to be invoiced.
  const [runFilter, setRunFilter] = useState('')
  const [runPage, setRunPage] = useState(1)

  // Show only the clients the run would actually invoice. On this database that is 1 of 191, so
  // the qualifying client is otherwise a needle somewhere down an alphabetical list of skips.
  const [runDueOnly, setRunDueOnly] = useState(false)
  const [readyFilter, setReadyFilter] = useState('')
  const [readyPage, setReadyPage] = useState(1)
  const MODAL_PAGE = 25

  const [run, setRun] = useState(null) // dry-run result awaiting confirmation
  const [running, setRunning] = useState(false)
  // Which qualifying clients are ticked for this run. A Set of cus codes — the preview can be 190
  // rows and an array would turn every checkbox render into a linear scan.
  const [picked, setPicked] = useState(new Set())
  const [detail, setDetail] = useState(null)

  // Editing a DRAFT's lines in place.
  //
  // Drafts exist so figures can be agreed, corrected and re-agreed while the document exists but
  // nobody has seen it. `editLines` is null when not editing — the table renders read-only — and
  // an array while it is, held apart from `detail` so Cancel is just throwing it away.
  const [editLines, setEditLines] = useState(null)
  const [editSaving, setEditSaving] = useState(false)
  const [chases, setChases] = useState([]) // the open invoice's reminder history

  // The company details printed on every invoice. Loaded on arrival rather than when the editor is
  // opened, because `missing` drives the banner that tells someone to open it in the first place.
  const [settings, setSettings] = useState(null)

  // The daily chase of unpaid invoices: previewed before it is run, for the same reason the
  // invoicing run is — these messages reach customers and each text is billed.
  const [chase, setChase] = useState(null)
  const [chasing, setChasing] = useState(false)

  // The term the run buys. One is the nightly renewal; the others are for a client who has
  // agreed to pay a quarter, half a year or a full year up front.
  //
  // Lives next to the as-of date because the two together define the run: WHEN it is evaluated,
  // and HOW LONG each invoice covers. The server coerces anything that is not one of these to 1,
  // so a stale value here can never bill an unsellable term.
  const [months, setMonths] = useState(1)
  const TERMS = [
    { months: 1, label: '1 month' },
    { months: 3, label: '3 months' },
    { months: 6, label: '6 months' },
    { months: 12, label: '1 year' },
  ]

  // Billing a client for add-ons ALONE, with no renewal invoice involved.
  //
  // The catch-up on a row can only supplement an invoice that already exists and has been paid.
  // This is the plain case it cannot reach: charge this client for the add-ons they hold — one
  // taken up mid-term, or a client whose renewal is not due for another two months.
  // A ONE-OFF invoice: the charge a new client pays on joining.
  //
  // Lines are typed rather than looked up, because a joining deal is rarely the same twice —
  // setup, training, hardware, a discount. Starts with three blank rows, which is about what a
  // joining invoice uses; more can be added.
  // itemId is WHICH catalogue item the line came from; description and unitAmount are what
  // ends up on the invoice. Kept separate because the amount stays editable after picking — the
  // catalogue sets a default, it does not dictate the charge.
  const BLANK_LINE = { itemId: '', description: '', quantity: 1, unitAmount: '' }
  const [oneOffOpen, setOneOffOpen] = useState(false)
  const [oneOffCus, setOneOffCus] = useState('')
  const [oneOffRef, setOneOffRef] = useState('')
  const [oneOffDue, setOneOffDue] = useState('')
  const [oneOffLines, setOneOffLines] = useState([])
  const [oneOffBusy, setOneOffBusy] = useState(false)

  // Also bill the FIRST PERIOD on the joining invoice — the subscription and the add-ons due.
  //
  // Usually what a joining invoice is, and it changes the document: with it on the invoice
  // becomes the client's first renewal, so it occupies the period, moves the licence when paid
  // and renews the grants. `firstPeriod` is the server's answer about what that would add.
  const [oneOffFirst, setOneOffFirst] = useState(true)
  const [oneOffTerm, setOneOffTerm] = useState(1)
  const [firstPeriod, setFirstPeriod] = useState(null)
  const [firstBusy, setFirstBusy] = useState(false)

  // Why the CHECK failed, as opposed to why the server said no. Held apart on purpose — see the
  // catch in loadFirstPeriod.
  const [firstError, setFirstError] = useState('')

  // The chargeable-items catalogue, so lines are picked rather than typed. Loaded with the
  // modal; active items only, since a retired one must not reappear in a picker.
  //
  // NOT `items` — that is already this screen's invoice list.
  const [catalogue, setCatalogue] = useState([])

  // Every client, for the one-off picker. The add-on picker deliberately lists only clients
  // HOLDING an add-on; a one-off can go to anybody, and most often goes to somebody brand new.
  const [allClients, setAllClients] = useState([])

  const [addOnOpen, setAddOnOpen] = useState(false)
  const [addOnClients, setAddOnClients] = useState([])
  const [addOnCus, setAddOnCus] = useState('')
  const [addOnMonths, setAddOnMonths] = useState(1)
  const [addOnPlan, setAddOnPlan] = useState(null)
  const [addOnBusy, setAddOnBusy] = useState(false)

  // Pre-flight audit over every client, and the date the run is evaluated against.
  const [ready, setReady] = useState(null)
  const [checking, setChecking] = useState(false)
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10))
  const [verdictFilter, setVerdictFilter] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [list, s] = await Promise.all([
        axios.get(api, {
          params: { search: search || '', status: status || '', page, pageSize },
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
  }, [api, authHeaders, search, status, page, pageSize])

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
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

  /**
   * Filter a modal's rows by name or code, then cut the page being shown.
   *
   * Returns the slice alongside the counts the footer needs, so the caller never has to recompute
   * a total from a filtered array and get it subtly wrong.
   */
  const modalPage = (rows, filter, page) => {
    const term = filter.trim().toLowerCase()

    const matched = term
      ? rows.filter(
          (c) =>
            (c.companyName ?? '').toLowerCase().includes(term) ||
            (c.cusCode ?? '').toLowerCase().includes(term),
        )
      : rows

    const pages = Math.max(1, Math.ceil(matched.length / MODAL_PAGE))
    // Clamped rather than reset: deleting a character should not throw you back to page 1, but a
    // filter that shrinks the list past the current page has to land somewhere real.
    const current = Math.min(page, pages)
    const from = (current - 1) * MODAL_PAGE

    return {
      rows: matched.slice(from, from + MODAL_PAGE),
      matched: matched.length,
      total: rows.length,
      page: current,
      pages,
      from,
    }
  }

  /**
   * The run's candidates, QUALIFYING FIRST.
   *
   * The server returns them alphabetically, which buries the handful that will actually be
   * invoiced among the ones being skipped — and those are the rows somebody came to this screen
   * to check before writing anything.
   *
   * Sorted rather than filtered by default: the skipped clients and their reasons are the other
   * half of what the preview is for ("why is this client not being billed?"), so they stay
   * reachable below. `sort` is stable, so alphabetical order survives within each group.
   */
  const runRows = useMemo(() => {
    const all = run?.candidates ?? []
    const visible = runDueOnly ? all.filter((c) => c.due) : all

    return [...visible].sort((a, b) => (a.due === b.due ? 0 : a.due ? -1 : 1))
  }, [run, runDueOnly])

  /** The search box and pager shared by both preview modals. */
  const modalControls = (view, filter, setFilter, setPage, noun) => (
    <>
      <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
        <div className="position-relative" style={{ minWidth: 260, flex: '0 1 320px' }}>
          <span
            className="material-icons position-absolute text-muted"
            style={{ fontSize: 15, left: 8, top: '50%', transform: 'translateY(-50%)' }}
          >
            search
          </span>
          <input
            type="text"
            className="form-control form-control-sm rounded-0 ps-4"
            placeholder="Search client name or code…"
            value={filter}
            onChange={(e) => {
              setFilter(e.target.value)
              setPage(1)
            }}
          />
        </div>
        <span className="cb-fs-meta text-muted">
          {filter.trim() ? `${view.matched} of ${view.total} ${noun}` : `${view.total} ${noun}`}
        </span>
      </div>
    </>
  )

  const modalPager = (view, setPage) =>
    view.pages > 1 && (
      <div className="d-flex flex-wrap align-items-center gap-1 mt-2">
        <span className="cb-fs-meta text-muted me-auto">
          {view.from + 1}–{Math.min(view.from + MODAL_PAGE, view.matched)} of {view.matched}
        </span>
        <button
          type="button"
          className="btn btn-sm filter-btn rounded-0"
          disabled={view.page <= 1}
          onClick={() => setPage(view.page - 1)}
        >
          Previous
        </button>
        <span className="cb-fs-meta px-2">
          Page {view.page} of {view.pages}
        </span>
        <button
          type="button"
          className="btn btn-sm filter-btn rounded-0"
          disabled={view.page >= view.pages}
          onClick={() => setPage(view.page + 1)}
        >
          Next
        </button>
      </div>
    )

  const check = async () => {
    setChecking(true)
    setError('')
    setVerdictFilter('')
    try {
      const r = await axios.get(`${api}/Readiness`, {
        params: { asOf },
        headers: authHeaders(),
      })
      setReady(r.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setChecking(false)
    }
  }

  const preview = async () => {
    setRunning(true)
    setError('')
    try {
      const r = await axios.post(`${api}/Generate`, null, {
        params: { dryRun: true, asOf, months },
        headers: authHeaders(),
      })
      setRun(r.data)
      // A fresh run starts on a clean view — a filter left over from the last preview would hide
      // rows from a list somebody is about to commit.
      setRunFilter('')
      setRunPage(1)
      setRunDueOnly(false)
      // Everything that qualifies starts ticked. The common case is billing the whole batch, and
      // an empty list would make the admin re-select what the preview just told them is due.
      setPicked(new Set((r.data?.candidates ?? []).filter((c) => c.due).map((c) => c.cusCode)))
    } catch (e) {
      setError(readErr(e))
    } finally {
      setRunning(false)
    }
  }

  const togglePick = (cusCode) =>
    setPicked((prev) => {
      const next = new Set(prev)
      if (next.has(cusCode)) next.delete(cusCode)
      else next.add(cusCode)
      return next
    })

  const commit = async () => {
    const codes = [...picked]
    if (codes.length === 0) {
      setError('Tick at least one client to invoice.')
      return
    }

    const chosen = (run?.candidates ?? []).filter((c) => c.due && picked.has(c.cusCode))

    // Both documents. Add-ons are billed separately now, so summing amountDue alone would quote
    // a figure lower than the one about to be raised.
    const total = chosen.reduce((sum, c) => sum + (c.totalBilled ?? c.amountDue ?? 0), 0)
    const withAddOns = chosen.filter((c) => (c.addOns?.length ?? 0) > 0).length
    const term = TERMS.find((t) => t.months === (run?.months ?? 1))

    // Raising an invoice is not undoable in the sense that matters: cancelling one leaves a
    // cancelled invoice on the client's record. Worth one deliberate yes, with the figure in it.
    if (
      !(await confirm({
        title: `Raise invoices for ${codes.length} client(s)?`,
        body:
          `${codes.length} client(s) totalling ${money(total, 'KES')} will be invoiced for ` +
          `${term?.label ?? '1 month'}.`,
        detail:
          // ONE document each, carrying the licence and any add-ons together. A client who no
          // longer wants an add-on has to be taken off it BEFORE the run — see Add-on pricing.
          (withAddOns > 0
            ? `${withAddOns} of them also carries add-on charges on the same invoice. ` +
              'To drop an add-on for a client, stop its renewal under Add-on pricing first. '
            : '') +
          'They are created as drafts — nothing reaches a client until you issue them, except ' +
          'for clients with auto-invoicing switched on.',
        confirmText: 'Raise them',
      }))
    )
      return

    setRunning(true)
    setError('')
    try {
      // The selection travels in the BODY: a hundred cus codes will not fit in a query string.
      const r = await axios.post(
        `${api}/Generate`,
        { cusCodes: codes },
        { params: { dryRun: false, asOf, months }, headers: authHeaders() },
      )
      const raised = r.data?.raised ?? 0
      const issued = r.data?.issued ?? 0
      toast.success(
        `${raised} invoice(s) raised as drafts` +
          (issued > 0 ? `, ${issued} issued and sent to clients.` : '.'),
        { theme: 'colored', autoClose: 7000 },
      )
      setRun(null)
      setPicked(new Set())
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setRunning(false)
    }
  }

  const issueAll = async () => {
    if (
      !(await confirm({
        title: 'Issue every draft invoice?',
        body: 'Each one becomes payable and is emailed to the client.',
        detail: 'This cannot be undone.',
        danger: true,
        confirmText: 'Issue all drafts',
      }))
    )
      return
    try {
      const r = await axios.post(`${api}/IssueDrafts`, null, { headers: authHeaders() })
      toast.success(r.data?.message ?? 'Drafts issued.', { theme: 'colored', autoClose: 6000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const issueOne = async (row) => {
    if (
      !(await confirm({
        title: `Issue ${row.invoiceNo}?`,
        body: 'It becomes payable and is emailed to the client.',
        confirmText: 'Issue it',
      }))
    )
      return
    try {
      await axios.post(`${api}/${row.id}/Issue`, null, { headers: authHeaders() })
      toast.success(`${row.invoiceNo} issued.`, { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const cancelOne = async (row) => {
    const reason = await confirm({
      title: `Cancel ${row.invoiceNo}?`,
      body: 'The invoice is kept and marked cancelled — a numbered document is never deleted.',
      detail: 'The period can be billed again afterwards with Raise again.',
      danger: true,
      confirmText: 'Cancel the invoice',
      cancelText: 'Keep it',
      input: {
        label: 'Reason',
        placeholder: 'e.g. raised in error, wrong price',
        help: 'Kept on the record, so the cancellation can be explained later.',
      },
    })

    if (!reason) return
    try {
      await axios.post(`${api}/${row.id}/Cancel`, { reason }, { headers: authHeaders() })
      toast.success(`${row.invoiceNo} cancelled.`, { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  /**
   * Bill add-ons that were missed off an invoice the client has already PAID.
   *
   * Cancel-and-raise-again is the normal remedy for a wrong invoice, but it is refused once money
   * has landed — so this raises a SECOND, add-on-only invoice for the same month. Settling it
   * renews the add-on grants and deliberately does not move the licence: that month is already
   * paid for, and granting another would hand out a free month at the price of an add-on.
   *
   * Asks the server what it would bill before offering to commit, because "nothing is missing" is
   * the answer for most invoices and it should read as information, not as a failure.
   */
  const addOnCatchUp = async (row) => {
    setError('')
    let plan
    try {
      const r = await axios.get(`${api}/${row.id}/AddOnCatchUp`, { headers: authHeaders() })
      plan = r.data
    } catch (e) {
      setError(readErr(e))
      return
    }

    if (!plan?.canRaise) {
      toast.info(plan?.refusal ?? 'There is nothing to bill for that period.', {
        theme: 'colored',
        autoClose: 8000,
      })
      return
    }

    const lines = (plan.addOns ?? [])
      .map(
        (a) =>
          `${a.name}${a.branches > 1 ? ` (on ${a.branches} branches)` : ''} — ` +
          `${money(a.price, plan.currency)}`,
      )
      .join('\n')

    if (
      !(await confirm({
        title: `Bill the missed add-ons on ${row.invoiceNo}?`,
        body:
          `A separate draft invoice for ${money(plan.total, plan.currency)} covering the same ` +
          `period:\n\n${lines}`,
        detail:
          'It renews the add-ons only — the licence does not move, because that month is ' +
          'already paid for. Raised as a draft, so nothing is sent until you issue it.',
        confirmText: 'Raise the add-on invoice',
      }))
    )
      return

    try {
      const r = await axios.post(`${api}/${row.id}/AddOnCatchUp`, null, {
        headers: authHeaders(),
      })
      toast.success(r.data?.message ?? 'Add-on invoice raised.', {
        theme: 'colored',
        autoClose: 8000,
      })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  /** Open the one-off modal, fetching every client for the picker. */
  const openOneOff = async () => {
    setOneOffOpen(true)
    setOneOffCus('')
    setOneOffRef('')
    setOneOffDue('')
    setOneOffLines([{ ...BLANK_LINE }, { ...BLANK_LINE }, { ...BLANK_LINE }])
    setOneOffFirst(true)
    setOneOffTerm(1)
    setFirstPeriod(null)
    setFirstError('')

    // Fetched together: both are needed before the first line can be filled in, and two
    // sequential round trips would show an empty picker for a moment.
    try {
      const [clients, catalogueRes] = await Promise.all([
        allClients.length > 0
          ? Promise.resolve({ data: allClients })
          : axios.get(`${api}/Clients`, { headers: authHeaders() }),
        axios.get(`${api}/Items`, {
          params: { activeOnly: true },
          headers: authHeaders(),
        }),
      ])

      setAllClients(clients.data ?? [])
      setCatalogue(catalogueRes.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }

  /**
   * Pick a catalogue item onto a line.
   *
   * Fills the description and the default amount. The amount is then the admin's to change —
   * that is the whole arrangement: the catalogue stops people guessing at a figure, it does not
   * stop them agreeing a different one.
   *
   * Choosing the blank option clears the item but KEEPS whatever is typed, so switching a line
   * to a custom charge does not wipe work.
   */
  const pickItem = (i, rawId) => {
    const id = rawId === '' ? '' : Number(rawId)
    const item = catalogue.find((x) => x.id === id)

    setOneOffLines((rows) =>
      rows.map((r, n) =>
        n !== i
          ? r
          : item
          ? {
              ...r,
              itemId: id,
              description: item.name,
              unitAmount: String(item.defaultAmount ?? ''),
            }
          : { ...r, itemId: '' },
      ),
    )
  }

  /**
   * Ask the server what including the first period would add.
   *
   * Always asked, even with the box unticked, so the figures are on screen before somebody
   * decides — and so "this client has no price" is visible rather than discovered on save.
   */
  const loadFirstPeriod = useCallback(
    async (code, term) => {
      if (!code) {
        setFirstPeriod(null)
        setFirstError('')
        return
      }

      setFirstBusy(true)
      setFirstError('')
      try {
        const r = await axios.get(`${api}/OneOff/${encodeURIComponent(code)}/FirstPeriod`, {
          params: { months: term },
          headers: authHeaders(),
        })
        setFirstPeriod(r.data)
      } catch (e) {
        // KEPT, not swallowed. This used to set firstPeriod to null and let the panel fall back
        // to "this client has no price on file" — which sent somebody to check a billing profile
        // that was perfectly fine while the real problem was a 404 from a stale deployment.
        // A failed CHECK and a server that answered "no" are different things and now read
        // differently.
        setFirstPeriod(null)
        setFirstError(readErr(e))
      } finally {
        setFirstBusy(false)
      }
    },
    [api, authHeaders],
  )

  useEffect(() => {
    if (oneOffOpen) loadFirstPeriod(oneOffCus, oneOffTerm)
  }, [oneOffOpen, oneOffCus, oneOffTerm, loadFirstPeriod])

  // Ticking it is only possible when the server says it can be done.
  const firstOn = oneOffFirst && !!firstPeriod?.available

  const setLine = (i, field, value) =>
    setOneOffLines((rows) => rows.map((r, n) => (n === i ? { ...r, [field]: value } : r)))

  // Only the rows that would actually be billed. The server drops the rest too, but the total on
  // screen has to agree with the figure in the confirmation or nobody can check it.
  const oneOffFilled = oneOffLines.filter(
    (l) => l.description.trim() !== '' && Number(l.unitAmount) !== 0,
  )

  const oneOffLinesTotal = oneOffFilled.reduce(
    (s, l) => s + (Number(l.quantity) || 1) * (Number(l.unitAmount) || 0),
    0,
  )

  // What the invoice will actually ask for, including the first period when it is on.
  const oneOffTotal = oneOffLinesTotal + (firstOn ? firstPeriod.total : 0)

  const raiseOneOff = async () => {
    // With the first period on, the subscription alone is enough — a client can join with
    // nothing but their first month, and nothing to type.
    if (!oneOffCus || (oneOffFilled.length === 0 && !firstOn)) return

    const client = allClients.find((c) => c.cusCode === oneOffCus)

    // A one-off is typed from scratch, so there is no preview to check it against — the figure
    // and the client name go in the confirmation instead.
    if (
      !(await confirm({
        title: firstOn ? 'Raise this joining invoice?' : 'Raise this one-off invoice?',
        body:
          `${money(oneOffTotal, firstPeriod?.currency ?? 'KES')} for ` +
          `${client?.companyName ?? oneOffCus}` +
          (firstOn
            ? ` — ${TERMS.find((t) => t.months === oneOffTerm)?.label ?? '1 month'} of ` +
              `subscription plus ${oneOffFilled.length} joining line(s).`
            : `, across ${oneOffFilled.length} line(s).`),
        detail: firstOn
          ? // The consequential part, said plainly: this is no longer a side document.
            'Because it includes the first period it counts as their first renewal — the monthly ' +
            `run will not bill that period again, and paying it in full moves the licence to ` +
            `${fmtDate(firstPeriod.renewsTo)}. Raised as a draft; nothing reaches the client ` +
            'until you issue it.'
          : 'It is separate from their subscription and does not move the licence expiry. The ' +
            'monthly run will still bill their first month. Raised as a draft — nothing reaches ' +
            'the client until you issue it.',
        confirmText: 'Raise it',
      }))
    )
      return

    setOneOffBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/OneOff`,
        {
          cusCode: oneOffCus,
          reference: oneOffRef || null,
          dueDate: oneOffDue || null,
          includeFirstPeriod: firstOn,
          months: oneOffTerm,
          lines: oneOffFilled.map((l) => ({
            // Recorded on the line so the ledger can be totalled by item later. Null for a
            // custom charge, which stays allowed.
            billableItemId: l.itemId === '' || l.itemId == null ? null : Number(l.itemId),
            description: l.description.trim(),
            quantity: Number(l.quantity) || 1,
            unitAmount: Number(l.unitAmount) || 0,
          })),
        },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'One-off invoice raised.', {
        theme: 'colored',
        autoClose: 8000,
      })
      setOneOffOpen(false)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setOneOffBusy(false)
    }
  }

  /** Open the add-on-invoice modal, fetching the client list the picker needs. */
  const openAddOnInvoice = async () => {
    setAddOnOpen(true)
    setAddOnCus('')
    setAddOnPlan(null)
    setAddOnMonths(1)

    if (addOnClients.length > 0) return

    try {
      // The same list the Add-on pricing screen uses — every client holding an add-on, which is
      // exactly the set that can be billed for one.
      const r = await axios.get(`${api}/AddOns`, { headers: authHeaders() })
      setAddOnClients(r.data?.clients ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }

  /**
   * Ask the server what an add-on invoice for this client would bill.
   *
   * Always before offering the button. "This client has no add-on due with a price set" is the
   * usual answer and should read as information rather than as a failed action.
   */
  const previewAddOnInvoice = useCallback(
    async (code, term) => {
      if (!code) {
        setAddOnPlan(null)
        return
      }

      setAddOnBusy(true)
      try {
        const r = await axios.get(`${api}/AddOnInvoice/${encodeURIComponent(code)}`, {
          params: { months: term },
          headers: authHeaders(),
        })
        setAddOnPlan(r.data)
      } catch (e) {
        setAddOnPlan(null)
        setError(readErr(e))
      } finally {
        setAddOnBusy(false)
      }
    },
    [api, authHeaders],
  )

  useEffect(() => {
    if (addOnOpen) previewAddOnInvoice(addOnCus, addOnMonths)
  }, [addOnOpen, addOnCus, addOnMonths, previewAddOnInvoice])

  const raiseAddOnInvoice = async () => {
    if (!addOnPlan?.canRaise) return

    setAddOnBusy(true)
    try {
      const r = await axios.post(`${api}/AddOnInvoice/${encodeURIComponent(addOnCus)}`, null, {
        params: { months: addOnMonths },
        headers: authHeaders(),
      })
      toast.success(r.data?.message ?? 'Add-on invoice raised.', {
        theme: 'colored',
        autoClose: 8000,
      })
      setAddOnOpen(false)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAddOnBusy(false)
    }
  }

  /** Start editing, seeded from what is on screen. */
  const startEdit = () =>
    setEditLines(
      (detail.lines ?? [])
        // The brought-forward line is NOT the admin's to edit — it is derived from what other
        // invoices are owed, and the server re-adds it after a save. Hidden from the editor
        // rather than shown greyed out, which would invite the question.
        .filter((l) => l.kind !== 'BalanceForward')
        .map((l) => ({
          id: l.id ?? 0,
          kind: l.kind,
          referenceId: l.referenceId ?? null,
          description: l.description ?? '',
          quantity: String(l.quantity ?? 1),
          unitAmount: String(l.unitAmount ?? ''),
        })),
    )

  const setEditLine = (i, field, value) =>
    setEditLines((rows) => rows.map((r, n) => (n === i ? { ...r, [field]: value } : r)))

  const editFilled = (editLines ?? []).filter(
    (l) => (l.description ?? '').trim() !== '' && Number(l.unitAmount) !== 0,
  )

  const editTotal = editFilled.reduce(
    (sum, l) => sum + (Number(l.quantity) || 1) * (Number(l.unitAmount) || 0),
    0,
  )

  const saveEdit = async () => {
    if (editFilled.length === 0) {
      setError('An invoice needs at least one line. Cancel the invoice instead of emptying it.')
      return
    }

    setEditSaving(true)
    setError('')
    try {
      const r = await axios.put(
        `${api}/${detail.id}/Lines`,
        editFilled.map((l) => ({
          id: l.id ?? 0,
          kind: l.kind,
          referenceId: l.referenceId,
          description: l.description.trim(),
          quantity: Number(l.quantity) || 1,
          unitAmount: Number(l.unitAmount) || 0,
        })),
        { headers: authHeaders() },
      )

      toast.success(r.data?.message ?? 'Draft updated.', { theme: 'colored', autoClose: 7000 })
      setEditLines(null)

      // Both: the modal is showing stale figures and so is the row behind it. Reloaded from the
      // server rather than patched locally — the totals are recomputed there, including the
      // brought-forward balance the editor never sent.
      await openDetail({ id: detail.id })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setEditSaving(false)
    }
  }

  const loadSettings = useCallback(async () => {
    try {
      const r = await axios.get(`${api}/Settings`, { headers: authHeaders() })
      setSettings(r.data)
    } catch (e) {
      setError(readErr(e))
    }
  }, [api, authHeaders])

  useEffect(() => {
    loadSettings()
  }, [loadSettings])

  const previewChase = async () => {
    setChasing(true)
    setError('')
    try {
      const r = await axios.get(`${api}/Reminders/Preview`, {
        params: { asOf },
        headers: authHeaders(),
      })
      setChase(r.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setChasing(false)
    }
  }

  const runChase = async () => {
    setChasing(true)
    setError('')
    try {
      const r = await axios.post(`${api}/Reminders/Run`, null, {
        params: { asOf },
        headers: authHeaders(),
      })
      toast.success(r.data?.message ?? 'Reminders sent.', { theme: 'colored', autoClose: 8000 })
      setChase(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setChasing(false)
    }
  }

  /**
   * The stored PDF — the document the client actually received. Separate from the preview below,
   * which renders afresh: when checking what a client is looking at, a fresh render is the wrong
   * answer because the template may have changed since.
   */
  const downloadPdf = async (row) => {
    setError('')
    try {
      await downloadFile(`${api}/${row.id}/Pdf`, `${row.invoiceNo}.pdf`)
    } catch (e) {
      setError(e.message)
    }
  }

  /**
   * Render now and open it, without storing anything. This is how the template and the renderer get
   * checked before a document goes to a customer, so it is offered on drafts too.
   */
  const previewPdf = async (row) => {
    setError('')
    try {
      await downloadFile(`${api}/${row.id}/PdfPreview`, `${row.invoiceNo}-preview.pdf`, {
        inline: true,
      })
    } catch (e) {
      setError(e.message)
    }
  }

  const openDetail = async (row) => {
    setDetail({ loading: true })
    setChases([])
    try {
      // Fetched together: "has this client been chased, and how often" is part of reading an
      // unpaid invoice, not a separate question worth a second click.
      const [r, h] = await Promise.all([
        axios.get(`${api}/${row.id}`, { headers: authHeaders() }),
        axios.get(`${api}/${row.id}/Reminders`, { headers: authHeaders() }),
      ])
      setDetail(r.data)
      setChases(h.data ?? [])
    } catch (e) {
      setDetail(null)
      setError(readErr(e))
    }
  }

  return (
    <>
      {confirmDialog}

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">description</span>
          Proforma invoices
          {summary && <span className="cb-page-head__sub">{total} in the ledger</span>}
        </h1>
        {canManage && (
          <div className="cb-page-head__actions">
            <label className="d-flex align-items-center gap-1 cb-fs-meta text-muted mb-0">
              As of
              <input
                type="date"
                className="form-control form-control-sm rounded-0 filter-control"
                style={{ width: 140 }}
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                title="The date the run is evaluated against. A later date brings forward everything due by then."
              />
            </label>
            {/* The TERM. Sits beside the as-of date because the two together define the run:
                when it is evaluated, and how long each invoice covers. */}
            <label className="d-flex align-items-center gap-1 cb-fs-meta text-muted mb-0">
              For
              <select
                className="form-select form-select-sm rounded-0 filter-control"
                style={{ width: 110 }}
                value={months}
                onChange={(e) => setMonths(Number(e.target.value))}
                title="How long each invoice covers. The nightly run always bills one month; use a longer term when a client has agreed to pay up front."
              >
                {TERMS.map((t) => (
                  <option key={t.months} value={t.months}>
                    {t.label}
                  </option>
                ))}
              </select>
            </label>
            {/* The letterhead lives under Setup now. The dot stays here, because an incomplete
                letterhead blocks the invoice run and that belongs next to the run button. */}
            <Link
              to="/setup?s=invoice"
              className="btn btn-sm filter-btn rounded-0"
              title="The company name, address and payment instructions printed on every invoice."
            >
              Invoice details
              {settings && !settings.isReady && <span className="text-danger ms-1">●</span>}
            </Link>
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              onClick={openAddOnInvoice}
              title="Bill a client for the add-ons they hold, without raising a licence renewal."
            >
              Add-on invoice
            </button>
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              onClick={openOneOff}
              title="A joining charge for a new client — setup, training, hardware. Does not touch the licence."
            >
              One-off invoice
            </button>
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              disabled={checking}
              onClick={check}
            >
              {checking ? 'Checking…' : 'Check readiness'}
            </button>
            {summary?.overdue > 0 && (
              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                disabled={chasing}
                onClick={previewChase}
                title="Shows who would be reminded by email and SMS before anything is sent."
              >
                {chasing ? 'Working…' : `Chase ${summary.overdue} overdue`}
              </button>
            )}
            {summary?.drafts > 0 && (
              <button type="button" className="btn btn-sm add-btn rounded-0" onClick={issueAll}>
                Issue {summary.drafts} draft(s)
              </button>
            )}
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              disabled={running}
              onClick={preview}
            >
              {running ? 'Working…' : 'Run invoicing'}
            </button>
          </div>
        )}
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      {/* The go-live blocker, said plainly and where it will be seen. An invoice with no payment
          instructions is a demand the client cannot act on, however right the figures are. */}
      {settings && !settings.isReady && (
        <div className="alert alert-warning rounded-0 py-2 mb-2 cb-fs-body d-flex flex-wrap align-items-center gap-2">
          <span>
            <span className="fw-bold">Invoices are missing {settings.missing.join(', ')}.</span>{' '}
            Every invoice you send carries these, and the &ldquo;How to pay&rdquo; box is what a
            client acts on.
          </span>
          {canManage && (
            <Link to="/setup?s=invoice" className="btn btn-sm add-btn rounded-0 ms-auto">
              Fill them in
            </Link>
          )}
        </div>
      )}

      {summary && (
        <div className="email-stats">
          <div className="email-stat is-all">
            <span className="email-stat__icon">
              <span className="material-icons">drafts</span>
            </span>
            <span className="email-stat__body">
              <span className="email-stat__value">{summary.drafts}</span>
              <span className="email-stat__label">Drafts</span>
              <span className="email-stat__meta">
                {money(summary.draftTotal, summary.currency)}
              </span>
            </span>
          </div>
          <div className="email-stat is-pending">
            <span className="email-stat__icon">
              <span className="material-icons">pending_actions</span>
            </span>
            <span className="email-stat__body">
              <span className="email-stat__value">{summary.issued}</span>
              <span className="email-stat__label">Issued</span>
              <span className="email-stat__meta">
                {money(summary.outstandingTotal, summary.currency)} outstanding
              </span>
            </span>
          </div>
          <div className="email-stat is-failed">
            <span className="email-stat__icon">
              <span className="material-icons">event_busy</span>
            </span>
            <span className="email-stat__body">
              <span className="email-stat__value">{summary.overdue}</span>
              <span className="email-stat__label">Overdue</span>
            </span>
          </div>
          <div className="email-stat is-sent">
            <span className="email-stat__icon">
              <span className="material-icons">task_alt</span>
            </span>
            <span className="email-stat__body">
              <span className="email-stat__value">{summary.paid}</span>
              <span className="email-stat__label">Paid</span>
            </span>
          </div>
        </div>
      )}

      <div className="cb-card">
        <div className="cb-card__body">
          <DataTable
            rows={items}
            rowKey={(r) => r.id}
            loading={loading}
            maxHeight="55vh"
            search={{
              value: search,
              placeholder: 'Search invoice number, client name or code…',
              onChange: (v) => {
                setSearch(v)
                setPage(1)
              },
            }}
            toolbar={
              <select
                className="form-select form-select-sm rounded-0 filter-control"
                style={{ width: 140 }}
                value={status}
                aria-label="Filter by status"
                onChange={(e) => {
                  setStatus(e.target.value)
                  setPage(1)
                }}
              >
                {STATUSES.map((s) => (
                  <option key={s.key} value={s.key}>
                    {s.label}
                  </option>
                ))}
              </select>
            }
            empty={{
              icon: 'description',
              title: 'No invoices yet.',
              hint: 'Set prices under Billing Profiles, then run invoicing.',
            }}
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
                key: 'invoiceNo',
                title: 'Invoice',
                icon: 'receipt',
                nowrap: true,
                render: (r) => (
                  <>
                    <button
                      type="button"
                      className="btn p-0 border-0 bg-transparent fw-bold text-decoration-underline"
                      style={{ fontSize: 'inherit' }}
                      onClick={() => openDetail(r)}
                    >
                      {r.invoiceNo}
                    </button>
                    {/*
                      Two live invoices can share a period now — the renewal and an add-on
                      catch-up. Unlabelled, that pair reads as a double-billing.
                    */}
                    {r.kind === 'AddOn' && (
                      <span
                        className="badge bg-info text-dark ms-2"
                        title="Add-ons only. Does not move the licence — that period's subscription is already paid."
                      >
                        Add-on
                      </span>
                    )}
                  </>
                ),
              },
              {
                key: 'companyName',
                title: 'Client',
                icon: 'apartment',
                render: (r) => (
                  <>
                    <span className="d-block text-truncate" style={{ maxWidth: 190 }}>
                      {r.companyName}
                    </span>
                    <span className="d-block text-muted">{r.cusCode}</span>
                  </>
                ),
              },
              {
                key: 'periodStart',
                title: 'Period',
                icon: 'date_range',
                nowrap: true,
                render: (r) => `${fmtDate(r.periodStart)} → ${fmtDate(r.periodEnd)}`,
              },
              {
                key: 'dueDate',
                title: 'Due',
                icon: 'event',
                width: '1%',
                nowrap: true,
                render: (r) => (
                  <span className={r.isOverdue ? 'text-danger fw-bold' : ''}>
                    {fmtDate(r.dueDate)}
                  </span>
                ),
              },
              {
                key: 'amountDue',
                title: 'Amount',
                icon: 'payments',
                width: '1%',
                align: 'right',
                nowrap: true,
                render: (r) => money(r.amountDue, r.currency),
              },
              {
                key: 'outstanding',
                title: 'Outstanding',
                icon: 'account_balance_wallet',
                width: '1%',
                align: 'right',
                nowrap: true,
                render: (r) => (
                  <span className={r.outstanding > 0 ? 'fw-bold' : 'text-muted'}>
                    {money(r.outstanding, r.currency)}
                  </span>
                ),
              },
              {
                key: 'status',
                title: 'Status',
                icon: 'info_outline',
                width: '1%',
                align: 'center',
                render: (r) => (
                  <span
                    className={`badge ${STATUS_BADGE[r.status] ?? 'bg-secondary'}`}
                    style={{ fontSize: 9 }}
                  >
                    {r.status}
                  </span>
                ),
              },
            ]}
            actionsLabel="Actions"
            actions={(r) => (
              <>
                {/* Available to anyone who can view billing — reading the document a client was
                    sent is not a billing change. */}
                {r.hasPdf && (
                  <button
                    type="button"
                    className="cb-act"
                    title={`Download ${r.invoiceNo}.pdf — the document sent to the client`}
                    aria-label={`Download ${r.invoiceNo} as PDF`}
                    onClick={() => downloadPdf(r)}
                  >
                    <span className="material-icons">picture_as_pdf</span>
                  </button>
                )}
                {canManage && (
                  <>
                    <button
                      type="button"
                      className="cb-act"
                      title={
                        r.hasPdf
                          ? 'Render a fresh preview from the current template'
                          : 'Preview the PDF for this invoice'
                      }
                      aria-label={`Preview ${r.invoiceNo} as PDF`}
                      onClick={() => previewPdf(r)}
                    >
                      <span className="material-icons">visibility</span>
                    </button>
                    {r.status === 'Draft' && (
                      <button
                        type="button"
                        className="cb-act cb-act--primary"
                        title={`Issue ${r.invoiceNo} — it becomes payable and is sent to the client`}
                        aria-label={`Issue ${r.invoiceNo}`}
                        onClick={() => issueOne(r)}
                      >
                        <span className="material-icons">send</span>
                      </button>
                    )}
                    {r.status !== 'Cancelled' && r.amountPaid === 0 && (
                      <button
                        type="button"
                        className="cb-act cb-act--danger"
                        title={`Cancel ${r.invoiceNo}`}
                        aria-label={`Cancel ${r.invoiceNo}`}
                        onClick={() => cancelOne(r)}
                      >
                        <span className="material-icons">block</span>
                      </button>
                    )}
                    {/*
                      The remedy for a missed add-on once cancelling is off the table. Offered on
                      any part-paid or paid subscription invoice — whether anything is actually
                      missing is the server's answer, not a guess made here.
                    */}
                    {r.kind !== 'AddOn' && r.status !== 'Cancelled' && r.amountPaid > 0 && (
                      <button
                        type="button"
                        className="cb-act"
                        title={`Bill add-ons missed off ${r.invoiceNo} — raises a separate invoice for the same period`}
                        aria-label={`Bill missed add-ons for ${r.invoiceNo}`}
                        onClick={() => addOnCatchUp(r)}
                      >
                        <span className="material-icons">playlist_add</span>
                      </button>
                    )}
                  </>
                )}
              </>
            )}
          />
        </div>
      </div>

      {/* Pre-flight: every client, and what the run would do with each */}
      <CModal visible={!!ready} onClose={() => setReady(null)} alignment="center" size="xl">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            Billing readiness — as of {fmtDate(ready?.asOf)}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {ready && (
            <>
              {ready.ready ? (
                <div className="alert alert-success rounded-0 py-2 cb-fs-body">
                  <span className="fw-bold">Every client is accounted for.</span> Nothing is missing
                  a price or an expiry date, so the run will consider all {ready.clientsTotal} of
                  them.
                </div>
              ) : (
                <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                  <span className="fw-bold">
                    {ready.notPriced + ready.noExpiry + ready.noClientRecord} client(s) would be
                    skipped for a reason you can fix.
                  </span>{' '}
                  A client with no price is never invoiced, and the run itself cannot tell you about
                  them — this list is the only place they show up.
                </div>
              )}

              {/* Not a per-client problem, but it belongs on the screen someone reads before
                  billing anybody: it affects every document the run produces. */}
              {ready.missingIssuerDetails?.length > 0 && (
                <div className="alert alert-warning rounded-0 py-2 cb-fs-body">
                  <span className="fw-bold">
                    Every invoice would be missing {ready.missingIssuerDetails.join(', ')}.
                  </span>{' '}
                  Fix this under <em>Invoice details</em> before running — it is not about any one
                  client, it is the letterhead on all of them.
                </div>
              )}

              {/* The number worth seeing before committing: a draft can still be withdrawn, an
                  issued invoice is already in a customer's inbox. */}
              {ready.willAutoIssue > 0 && (
                <div className="alert alert-info rounded-0 py-2 cb-fs-body">
                  <span className="fw-bold">
                    {ready.willAutoIssue} of {ready.willInvoice} would be ISSUED straight away
                  </span>{' '}
                  — emailed with the PDF and texted to the client, because auto-invoicing is on for
                  them. The other {ready.willInvoice - ready.willAutoIssue} would wait as drafts.
                </div>
              )}

              {/* Click a tile to filter the list below it. */}
              <div className="d-flex flex-wrap gap-2 mb-3">
                {[
                  {
                    key: 'WillInvoice',
                    label: 'Will invoice',
                    n: ready.willInvoice,
                    cls: 'bg-success',
                  },
                  {
                    key: 'NotPriced',
                    label: 'No price set',
                    n: ready.notPriced,
                    cls: 'bg-warning text-dark',
                  },
                  {
                    key: 'NoExpiry',
                    label: 'No expiry date',
                    n: ready.noExpiry,
                    cls: 'bg-warning text-dark',
                  },
                  {
                    key: 'NotDueYet',
                    label: 'Not due yet',
                    n: ready.notDueYet,
                    cls: 'bg-secondary',
                  },
                  {
                    key: 'AlreadyInvoiced',
                    label: 'Already invoiced',
                    n: ready.alreadyInvoiced,
                    cls: 'bg-info text-dark',
                  },
                  { key: 'Paused', label: 'Paused', n: ready.paused, cls: 'bg-dark' },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    className={`btn btn-sm rounded-0 ${
                      verdictFilter === t.key ? 'add-btn' : 'filter-btn'
                    }`}
                    onClick={() => setVerdictFilter(verdictFilter === t.key ? '' : t.key)}
                  >
                    <span className={`badge ${t.cls} me-1`} style={{ fontSize: 9 }}>
                      {t.n}
                    </span>
                    {t.label}
                  </button>
                ))}
                {verdictFilter && (
                  <button
                    type="button"
                    className="btn btn-sm cancel-btn rounded-0"
                    onClick={() => setVerdictFilter('')}
                  >
                    Show all {ready.clientsTotal}
                  </button>
                )}
              </div>

              <div className="cb-fs-body mb-2">
                <span className="fw-bold">{money(ready.totalToRaise, 'KES')}</span> would be raised
                across {ready.willInvoice} invoice(s).
              </div>

              {modalControls(
                modalPage(
                  (ready.clients ?? []).filter(
                    (c) => !verdictFilter || c.verdict === verdictFilter,
                  ),
                  readyFilter,
                  readyPage,
                ),
                readyFilter,
                setReadyFilter,
                setReadyPage,
                'client(s)',
              )}

              <div className="cb-table-wrap" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                <table className="table table-sm cb-table">
                  <thead>
                    <tr>
                      <th>Client</th>
                      <th style={{ width: '1%' }}>Licence expires</th>
                      <th style={{ width: '1%' }}>Invoice on</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Amount
                      </th>
                      <th>What will happen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalPage(
                      (ready.clients ?? []).filter(
                        (c) => !verdictFilter || c.verdict === verdictFilter,
                      ),
                      readyFilter,
                      readyPage,
                    ).rows.map((c) => (
                      <tr key={c.cusCode}>
                        <td>
                          <span className="d-block text-truncate" style={{ maxWidth: 200 }}>
                            {c.companyName || c.cusCode}
                          </span>
                          <span className="d-block text-muted cb-fs-meta">{c.cusCode}</span>
                        </td>
                        <td className="cb-fs-meta text-nowrap">{fmtDate(c.licenceExpiry)}</td>
                        <td className="cb-fs-meta text-nowrap">
                          {fmtDate(c.invoiceOn)}
                          {c.daysLate > 0 && (
                            <span className="d-block text-danger">{c.daysLate}d late</span>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          {c.due ? money(c.amountDue, c.currency) : '—'}
                          {c.due && c.addOnTotal > 0 && (
                            <span className="d-block cb-fs-meta text-muted">
                              incl. {money(c.addOnTotal, c.currency)} add-ons
                            </span>
                          )}
                        </td>
                        <td className="cb-fs-meta">
                          {c.due ? (
                            <span className="text-success fw-bold">
                              Invoice will be raised
                              {c.addOns?.length > 0 &&
                                ` · ${c.addOns.map((a) => a.name).join(', ')}`}
                              {c.balanceBroughtForward > 0 &&
                                ` · includes ${money(
                                  c.balanceBroughtForward,
                                  c.currency,
                                )} brought forward`}
                            </span>
                          ) : (
                            <span
                              className={
                                ['NotPriced', 'NoExpiry', 'NoClientRecord'].includes(c.verdict)
                                  ? 'text-warning-emphasis fw-bold'
                                  : ''
                              }
                            >
                              {c.skipReason}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {modalPager(
                modalPage(
                  (ready.clients ?? []).filter(
                    (c) => !verdictFilter || c.verdict === verdictFilter,
                  ),
                  readyFilter,
                  readyPage,
                ),
                setReadyPage,
              )}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  onClick={() => setReady(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-sm filter-btn rounded-0"
                  disabled={running || ready.willInvoice === 0}
                  onClick={() => {
                    setReady(null)
                    preview()
                  }}
                >
                  Preview the run
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>

      {/* A one-off joining charge, with lines typed by hand */}
      <CModal
        visible={oneOffOpen}
        onClose={() => setOneOffOpen(false)}
        alignment="center"
        size="lg"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {firstOn ? 'Joining invoice' : 'One-off invoice'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="cb-fs-body text-muted">
            What a new client pays on joining. Type whatever was agreed — setup, training, hardware
            — and include their first period so the whole lot goes out on one document. Without the
            first period it is a side charge that moves no licence, and a client can have more than
            one of those.
          </p>

          <div className="row g-2 mb-3">
            <div className="col-md-5">
              <label className="form-label cb-fs-meta text-muted mb-1" htmlFor="oneoff-client">
                Client
              </label>
              <ClientPicker
                id="oneoff-client"
                options={allClients}
                value={oneOffCus}
                onChange={(id) => setOneOffCus(id)}
                getId={(c) => c.cusCode}
                getLabel={(c) => `${c.companyName || c.cusCode} (${c.cusCode})`}
                searchFields={[(c) => c.cusCode, (c) => c.companyName]}
                columns={[
                  { title: 'Code', render: (c) => c.cusCode },
                  { title: 'Company', render: (c) => c.companyName },
                  { title: 'Branches', render: (c) => c.branches },
                ]}
                placeholder="Choose a client…"
                emptyText="No clients found."
              />
            </div>
            <div className="col-md-4">
              <label className="form-label cb-fs-meta text-muted mb-1" htmlFor="oneoff-ref">
                Reference <span className="text-muted">(optional)</span>
              </label>
              <input
                id="oneoff-ref"
                type="text"
                className="form-control form-control-sm rounded-0"
                placeholder="Joining charges"
                value={oneOffRef}
                onChange={(e) => setOneOffRef(e.target.value)}
              />
            </div>
            <div className="col-md-3">
              <label className="form-label cb-fs-meta text-muted mb-1" htmlFor="oneoff-due">
                Payable by
              </label>
              <input
                id="oneoff-due"
                type="date"
                className="form-control form-control-sm rounded-0"
                value={oneOffDue}
                onChange={(e) => setOneOffDue(e.target.value)}
                title="Leave blank for two weeks from today — long enough for a new client to arrange payment."
              />
            </div>
          </div>

          {/* ---- the first period ----

              Shown before the typed lines because it is usually the largest figure and it is the
              part that decides what this document IS: with it, the invoice is the client's first
              renewal and moves their licence; without it, a side charge. */}
          {oneOffCus && (
            <div
              className={`alert rounded-0 py-2 mb-3 ${firstError ? 'alert-warning' : 'alert-info'}`}
            >
              {firstBusy ? (
                <span className="cb-fs-body">Checking their price…</span>
              ) : firstError ? (
                // THE CHECK ITSELF FAILED. Says so, and says nothing about the client's data —
                // the previous version blamed a missing price here and sent people to inspect a
                // billing profile that was correct.
                <span className="cb-fs-body">
                  <strong>Could not check their price.</strong> {firstError} The first period cannot
                  be added until this works, but the joining lines below can still be invoiced.
                </span>
              ) : !firstPeriod?.available ? (
                // The server answered, and the answer was no. Its own words — there is no
                // invented fallback, because every refusal path supplies a reason and a missing
                // one is a bug worth seeing rather than papering over.
                <span className="cb-fs-body">
                  <strong>The first period cannot be included.</strong> {firstPeriod?.refusal} The
                  joining lines below can still be invoiced.
                </span>
              ) : (
                <>
                  <div className="d-flex flex-wrap gap-3 align-items-center">
                    <div className="form-check mb-0">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="oneoff-first"
                        checked={oneOffFirst}
                        onChange={(e) => setOneOffFirst(e.target.checked)}
                      />
                      <label className="form-check-label cb-fs-body" htmlFor="oneoff-first">
                        Include the first period — subscription
                        {firstPeriod.addOns.length > 0 && <> and add-ons</>}
                      </label>
                    </div>
                    <label className="d-flex align-items-center gap-1 cb-fs-meta text-muted mb-0">
                      For
                      <select
                        className="form-select form-select-sm rounded-0"
                        style={{ width: 110 }}
                        value={oneOffTerm}
                        disabled={!oneOffFirst}
                        onChange={(e) => setOneOffTerm(Number(e.target.value))}
                      >
                        {TERMS.map((t) => (
                          <option key={t.months} value={t.months}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <span className="cb-fs-body ms-auto">
                      <strong>{money(firstPeriod.total, firstPeriod.currency)}</strong>
                    </span>
                  </div>

                  <div className="cb-fs-meta mt-2">
                    {oneOffTerm} × {money(firstPeriod.monthlyAmount, firstPeriod.currency)}
                    {firstPeriod.addOnAmount > 0 && (
                      <>
                        {' '}
                        + {money(firstPeriod.addOnAmount, firstPeriod.currency)} add-ons (
                        {firstPeriod.addOns.map((a) => a.name).join(', ')})
                      </>
                    )}
                    {' · covers '}
                    {fmtDate(firstPeriod.periodStart)} – {fmtDate(firstPeriod.periodEnd)}
                    {oneOffFirst ? (
                      <>
                        {' · '}
                        <span className="fw-bold">
                          renews the licence to {fmtDate(firstPeriod.renewsTo)} when paid
                        </span>
                      </>
                    ) : (
                      // Worth saying: unticking does not mean the client is not billed for it,
                      // only that it lands on a separate invoice from the monthly run.
                      <> · left off, so the monthly run will bill this period separately</>
                    )}
                  </div>
                </>
              )}
            </div>
          )}

          <div className="divider mb-2">Joining charges</div>

          <div className="cb-table-wrap">
            <table className="table table-sm cb-table mb-0">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>Item</th>
                  <th>Description on the invoice</th>
                  <th style={{ width: '10%' }}>Qty</th>
                  <th style={{ width: '16%' }}>Unit amount</th>
                  <th style={{ width: '16%' }} className="text-end">
                    Line total
                  </th>
                </tr>
              </thead>
              <tbody>
                {oneOffLines.map((l, i) => (
                  <tr key={i}>
                    <td>
                      {/* PICK, do not type. The description beside it stays editable so a line
                          can read "Training (2 days, on site)" without needing its own catalogue
                          entry — but the item is what the figure and the reporting come from. */}
                      <select
                        className="form-select form-select-sm rounded-0"
                        aria-label={`Line ${i + 1} item`}
                        value={l.itemId ?? ''}
                        onChange={(e) => pickItem(i, e.target.value)}
                      >
                        <option value="">
                          {catalogue.length === 0 ? 'No items set up yet' : 'Choose an item…'}
                        </option>
                        {catalogue.map((it) => (
                          <option key={it.id} value={it.id}>
                            {it.name} — {money(it.defaultAmount, it.currency)}
                          </option>
                        ))}
                      </select>
                      {/* Said once, on the first row, rather than as a banner nobody reads. */}
                      {i === 0 && catalogue.length === 0 && (
                        <span className="d-block cb-fs-meta text-muted">
                          Add them under Billing &gt; Billable items so nobody has to remember the
                          price. You can still type a charge below.
                        </span>
                      )}
                    </td>
                    <td>
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="Setup and configuration"
                        aria-label={`Line ${i + 1} description`}
                        value={l.description}
                        onChange={(e) => setLine(i, 'description', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        min="1"
                        step="1"
                        className="form-control form-control-sm rounded-0"
                        aria-label={`Line ${i + 1} quantity`}
                        value={l.quantity}
                        onChange={(e) => setLine(i, 'quantity', e.target.value)}
                      />
                    </td>
                    <td>
                      <input
                        type="number"
                        step="0.01"
                        className="form-control form-control-sm rounded-0"
                        placeholder="0.00"
                        aria-label={`Line ${i + 1} unit amount`}
                        value={l.unitAmount}
                        onChange={(e) => setLine(i, 'unitAmount', e.target.value)}
                      />
                    </td>
                    <td className="text-end text-nowrap align-middle">
                      {/* Blank rather than "0.00" on an untouched row: a column of zeros reads as
                          a mistake, and three of the rows start empty by design. */}
                      {l.description.trim() === '' && Number(l.unitAmount) === 0 ? (
                        <span className="text-muted">—</span>
                      ) : (
                        money((Number(l.quantity) || 1) * (Number(l.unitAmount) || 0), 'KES')
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                {/* Both parts, separately, then the figure the client will see. One combined
                    total would hide which half a surprise came from. */}
                {firstOn && (
                  <>
                    <tr>
                      <td colSpan={4} className="text-end cb-fs-meta">
                        Joining charges
                      </td>
                      <td className="text-end text-nowrap cb-fs-meta">
                        {money(oneOffLinesTotal, firstPeriod.currency)}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="text-end cb-fs-meta">
                        First period
                      </td>
                      <td className="text-end text-nowrap cb-fs-meta">
                        {money(firstPeriod.total, firstPeriod.currency)}
                      </td>
                    </tr>
                  </>
                )}
                <tr>
                  <td colSpan={4} className="text-end fw-bold">
                    Total
                  </td>
                  <td className="text-end fw-bold text-nowrap">
                    {money(oneOffTotal, firstPeriod?.currency ?? 'KES')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="d-flex gap-2 mt-3 flex-wrap">
            <button
              type="button"
              className="btn btn-sm filter-btn rounded-0"
              onClick={() => setOneOffLines((r) => [...r, { ...BLANK_LINE }])}
            >
              Add a line
            </button>
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0 ms-auto"
              disabled={oneOffBusy || !oneOffCus || (oneOffFilled.length === 0 && !firstOn)}
              title={
                !oneOffCus
                  ? 'Choose a client first'
                  : oneOffFilled.length === 0 && !firstOn
                  ? 'Add a line, or include the first period'
                  : undefined
              }
              onClick={raiseOneOff}
            >
              {oneOffBusy
                ? 'Raising…'
                : firstOn
                ? 'Raise the joining invoice'
                : 'Raise the invoice'}
            </button>
            <button
              type="button"
              className="btn btn-sm cancel-btn rounded-0"
              onClick={() => setOneOffOpen(false)}
            >
              Close
            </button>
          </div>
        </CModalBody>
      </CModal>

      {/* Bill a client for add-ons alone, with no renewal involved */}
      <CModal visible={addOnOpen} onClose={() => setAddOnOpen(false)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">Add-on invoice</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="cb-fs-body text-muted">
            Bills the add-ons a client holds, on their own document. The licence is not touched —
            settling this renews the add-on grants and nothing else.
          </p>

          <div className="row g-2 align-items-end mb-3">
            <div className="col-md-8">
              <label className="form-label cb-fs-meta text-muted mb-1" htmlFor="addon-inv-client">
                Client
              </label>
              <ClientPicker
                id="addon-inv-client"
                options={addOnClients}
                value={addOnCus}
                onChange={(id) => setAddOnCus(id)}
                getId={(c) => c.cusCode}
                getLabel={(c) => `${c.companyName || c.cusCode} (${c.cusCode})`}
                searchFields={[(c) => c.cusCode, (c) => c.companyName]}
                columns={[
                  { title: 'Code', render: (c) => c.cusCode },
                  { title: 'Company', render: (c) => c.companyName },
                  { title: 'Add-ons', render: (c) => c.addOns ?? '—' },
                ]}
                placeholder="Choose a client…"
                emptyText="No client holds an add-on."
              />
            </div>
            <div className="col-md-4">
              <label className="form-label cb-fs-meta text-muted mb-1" htmlFor="addon-inv-term">
                Cover for
              </label>
              <select
                id="addon-inv-term"
                className="form-select form-select-sm rounded-0"
                value={addOnMonths}
                onChange={(e) => setAddOnMonths(Number(e.target.value))}
              >
                {TERMS.map((t) => (
                  <option key={t.months} value={t.months}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {addOnBusy && <div className="cb-fs-body text-muted">Working it out…</div>}

          {/* A refusal is the usual answer and is shown quietly. Most clients hold add-ons that
              never expire, which are given as part of an original deal and are not billed. */}
          {!addOnBusy && addOnPlan?.refusal && (
            <div className="alert alert-secondary rounded-0 py-2 cb-fs-body mb-0">
              {addOnPlan.refusal}
            </div>
          )}

          {!addOnBusy && addOnPlan?.canRaise && (
            <>
              <div className="alert alert-info rounded-0 py-2 cb-fs-body">
                <span className="fw-bold">{money(addOnPlan.total, addOnPlan.currency)}</span> for{' '}
                {addOnPlan.addOns.length} add-on(s), covering {fmtDate(addOnPlan.periodStart)} –{' '}
                {fmtDate(addOnPlan.periodEnd)}. Raised as a draft — nothing reaches the client until
                you issue it.
              </div>

              <div className="cb-table-wrap">
                <table className="table table-sm cb-table mb-0">
                  <thead>
                    <tr>
                      <th>Add-on</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Per month
                      </th>
                      <th style={{ width: '1%' }} className="text-end">
                        Total
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {addOnPlan.addOns.map((a) => (
                      <tr key={a.addonId}>
                        <td>
                          {a.name}
                          {a.branches > 1 && (
                            <span className="cb-fs-meta text-muted">
                              {' '}
                              · on {a.branches} branches, charged once
                            </span>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          {money(a.price, addOnPlan.currency)}
                        </td>
                        <td className="text-end text-nowrap fw-bold">
                          {money(a.price * addOnPlan.months, addOnPlan.currency)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="d-flex gap-2 mt-3">
            <button
              type="button"
              className="btn btn-sm add-btn rounded-0"
              disabled={addOnBusy || !addOnPlan?.canRaise}
              onClick={raiseAddOnInvoice}
            >
              Raise the invoice
            </button>
            <button
              type="button"
              className="btn btn-sm cancel-btn rounded-0"
              onClick={() => setAddOnOpen(false)}
            >
              Close
            </button>
          </div>
        </CModalBody>
      </CModal>

      {/* Dry run: what would be raised, and why everything else was skipped */}
      <CModal visible={!!run} onClose={() => setRun(null)} alignment="center" size="xl">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">Invoicing run — preview</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {run && (
            <>
              <div className="alert alert-info rounded-0 py-2 cb-fs-body">
                <span className="fw-bold">
                  {run.raised} client(s) qualify, totalling {money(run.totalRaised, 'KES')}
                </span>
                {' for '}
                {TERMS.find((t) => t.months === (run.months ?? 1))?.label ?? '1 month'}
                {' · '}
                {run.skipped} skipped of {run.considered} client(s). Nothing has been written yet —
                tick the ones to invoice below.
              </div>

              {/* The selection bar. Shows what is actually about to happen, recomputed from the
                  ticks rather than from the run totals, so the figure on screen is the figure
                  that will be raised. */}
              {run.raised > 0 && (
                <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                  <button
                    type="button"
                    className="btn btn-sm filter-btn rounded-0"
                    onClick={() =>
                      setPicked(
                        new Set((run.candidates ?? []).filter((c) => c.due).map((c) => c.cusCode)),
                      )
                    }
                  >
                    Select all {run.raised}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm filter-btn rounded-0"
                    onClick={() => setPicked(new Set())}
                  >
                    Clear
                  </button>
                  <span className="cb-fs-body ms-auto">
                    <span className="fw-bold">{picked.size}</span> selected ·{' '}
                    <span className="fw-bold">
                      {money(
                        (run.candidates ?? [])
                          .filter((c) => c.due && picked.has(c.cusCode))
                          // totalBilled, not amountDue: the add-on invoice is part of what this
                          // run raises, and leaving it out would quote a figure lower than the
                          // one that lands on the ledger.
                          .reduce((s, c) => s + (c.totalBilled ?? c.amountDue ?? 0), 0),
                        'KES',
                      )}
                    </span>
                  </span>
                </div>
              )}

              {/* Can-invoice filter. The list is sorted qualifying-first regardless; this hides
                  the skipped rows entirely for when somebody is here to tick and raise rather
                  than to work out why a client was passed over. */}
              <div className="d-flex flex-wrap align-items-center gap-2 mb-2">
                <button
                  type="button"
                  className={`btn btn-sm rounded-0 ${runDueOnly ? 'add-btn' : 'filter-btn'}`}
                  onClick={() => {
                    setRunDueOnly(!runDueOnly)
                    setRunPage(1)
                  }}
                >
                  <span className="badge bg-success me-1" style={{ fontSize: 9 }}>
                    {run.raised}
                  </span>
                  Can invoice
                </button>
                {runDueOnly && (
                  <button
                    type="button"
                    className="btn btn-sm cancel-btn rounded-0"
                    onClick={() => {
                      setRunDueOnly(false)
                      setRunPage(1)
                    }}
                  >
                    Show all {run.considered}
                  </button>
                )}
              </div>

              {modalControls(
                modalPage(runRows, runFilter, runPage),
                runFilter,
                setRunFilter,
                setRunPage,
                'client(s) considered',
              )}

              <div className="cb-table-wrap" style={{ maxHeight: '45vh', overflowY: 'auto' }}>
                <table className="table table-sm cb-table">
                  <thead>
                    <tr>
                      <th style={{ width: '1%' }}>
                        <input
                          type="checkbox"
                          className="form-check-input m-0"
                          aria-label="Select every qualifying client"
                          title="Select every qualifying client"
                          checked={run.raised > 0 && picked.size === run.raised}
                          // Some-but-not-all shows a dash rather than a tick, so the header never
                          // claims everything is selected when it is not.
                          ref={(el) => {
                            if (el) el.indeterminate = picked.size > 0 && picked.size < run.raised
                          }}
                          disabled={run.raised === 0}
                          onChange={(e) =>
                            setPicked(
                              e.target.checked
                                ? new Set(
                                    (run.candidates ?? [])
                                      .filter((c) => c.due)
                                      .map((c) => c.cusCode),
                                  )
                                : new Set(),
                            )
                          }
                        />
                      </th>
                      <th>Client</th>
                      <th style={{ width: '1%' }}>Licence expires</th>
                      <th style={{ width: '1%' }}>Invoice on</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Amount
                      </th>
                      <th>Decision</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modalPage(runRows, runFilter, runPage).rows.map((c) => (
                      <tr
                        key={c.cusCode}
                        className={
                          !c.due ? 'text-muted' : picked.has(c.cusCode) ? '' : 'opacity-50'
                        }
                      >
                        <td>
                          {/* Only the qualifying rows are selectable. The rest are shown because
                              knowing WHY a client was skipped is the point of the preview. */}
                          {c.due && (
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              aria-label={`Invoice ${c.companyName || c.cusCode}`}
                              checked={picked.has(c.cusCode)}
                              onChange={() => togglePick(c.cusCode)}
                            />
                          )}
                        </td>
                        <td>
                          <span className="d-block text-truncate" style={{ maxWidth: 200 }}>
                            {c.companyName || c.cusCode}
                          </span>
                          <span className="d-block cb-fs-meta">{c.cusCode}</span>
                        </td>
                        <td className="cb-fs-meta text-nowrap">{fmtDate(c.licenceExpiry)}</td>
                        <td className="cb-fs-meta text-nowrap">
                          {fmtDate(c.invoiceOn)}
                          {c.daysLate > 0 && (
                            <span className="d-block text-danger">{c.daysLate}d late</span>
                          )}
                        </td>
                        <td className="text-end text-nowrap">
                          {c.due ? money(c.amountDue, c.currency) : '—'}
                          {/* Broken out because the total alone cannot be checked: an add-on
                              newly priced, or a grant whose renewal date has come round, changes
                              this figure with nothing on screen to explain it. It is on THIS
                              invoice, so "incl." and not "plus". */}
                          {c.due && c.addOnAmount > 0 && (
                            <span className="d-block cb-fs-meta text-muted">
                              incl. {money(c.addOnAmount, c.currency)} add-ons
                            </span>
                          )}
                          {/* The rate behind a longer term, so a 12-month figure can be checked
                              against the monthly one that was agreed. */}
                          {c.due && (run.months ?? 1) > 1 && (
                            <span className="d-block cb-fs-meta text-muted">
                              {run.months} × {money(c.monthlyAmount, c.currency)}
                            </span>
                          )}
                        </td>
                        <td className="cb-fs-meta">
                          {c.due ? (
                            <span
                              className={
                                picked.has(c.cusCode) ? 'text-success fw-bold' : 'text-muted'
                              }
                            >
                              {picked.has(c.cusCode)
                                ? 'Will be raised'
                                : 'Qualifies — not selected'}
                              {/* Named, not just totalled: "why is this client 2,000 more than
                                  last month" is answered by the name, not the figure. */}
                              {c.addOns?.length > 0 &&
                                ` · ${c.addOns.map((a) => a.name).join(', ')}`}
                              {c.autoIssue && picked.has(c.cusCode) && (
                                <span className="text-danger"> · auto-issues to the client</span>
                              )}
                              {c.balanceBroughtForward > 0 &&
                                ` · includes ${money(
                                  c.balanceBroughtForward,
                                  c.currency,
                                )} brought forward`}
                            </span>
                          ) : (
                            c.skipReason
                          )}
                        </td>
                      </tr>
                    ))}

                    {/* A filter that matches nothing has to say so — an empty table reads as a
                        failed run rather than a search with no hits. */}
                    {modalPage(runRows, runFilter, runPage).matched === 0 && (
                      <tr>
                        <td colSpan={6} className="text-center text-muted cb-fs-body py-3">
                          {runFilter.trim() ? (
                            <>No client matches &ldquo;{runFilter}&rdquo;.</>
                          ) : (
                            'No client can be invoiced on this date.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              {modalPager(modalPage(runRows, runFilter, runPage), setRunPage)}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  disabled={running}
                  onClick={() => setRun(null)}
                >
                  Close
                </button>
                <button
                  type="button"
                  className="btn btn-sm add-btn rounded-0"
                  disabled={running || picked.size === 0}
                  onClick={commit}
                >
                  {running
                    ? 'Raising…'
                    : picked.size === 0
                    ? 'Nothing selected'
                    : `Raise ${picked.size} invoice(s) as drafts`}
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>

      {/* The reminder sweep — previewed, then committed */}
      <CModal visible={!!chase} onClose={() => setChase(null)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">Payment reminders — preview</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {chase && (
            <>
              <p className="cb-fs-body">
                {chase.sent === 0 ? (
                  <>
                    Nothing is due a reminder today.{' '}
                    {chase.considered > 0 && (
                      <>
                        {chase.considered} overdue invoice(s) were considered — all were skipped,
                        with the reason on each row below.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    <strong>{chase.sent}</strong> invoice(s) would be chased:{' '}
                    <strong>{chase.emailsQueued}</strong> email(s) and{' '}
                    <strong>{chase.smsQueued}</strong> SMS. Texts are billed per message.
                  </>
                )}
              </p>

              <div className="cb-table-wrap" style={{ maxHeight: '48vh', overflowY: 'auto' }}>
                <table className="table table-sm cb-table">
                  <thead>
                    <tr>
                      <th>Invoice</th>
                      <th>Client</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Outstanding
                      </th>
                      <th style={{ width: '1%' }} className="text-center">
                        Overdue
                      </th>
                      <th style={{ width: '1%' }} className="text-center">
                        Round
                      </th>
                      <th>Outcome</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(chase.invoices ?? []).map((i) => (
                      <tr key={i.invoiceId}>
                        <td className="fw-bold text-nowrap">{i.invoiceNo}</td>
                        <td>
                          <span className="d-block text-truncate" style={{ maxWidth: 190 }}>
                            {i.companyName}
                          </span>
                          <span className="d-block text-muted cb-fs-meta">{i.cusCode}</span>
                        </td>
                        <td className="text-end text-nowrap">{money(i.outstanding, 'KES')}</td>
                        <td className="text-center cb-fs-meta">
                          {i.daysOverdue > 0 ? `${i.daysOverdue}d` : 'due today'}
                        </td>
                        <td className="text-center cb-fs-meta">{i.reminderNo}</td>
                        <td className="cb-fs-meta">
                          {i.sent ? (
                            <span className="text-success">
                              {i.emailsQueued} email, {i.smsQueued} SMS
                            </span>
                          ) : (
                            <span className="text-muted">{i.skipReason}</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="d-flex justify-content-end gap-1 mt-3">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  onClick={() => setChase(null)}
                >
                  Close
                </button>
                {chase.sent > 0 && (
                  <button
                    type="button"
                    className="btn btn-sm add-btn rounded-0"
                    disabled={chasing}
                    onClick={runChase}
                  >
                    {chasing ? 'Sending…' : `Send ${chase.sent} reminder(s)`}
                  </button>
                )}
              </div>
            </>
          )}
        </CModalBody>
      </CModal>

      {/* One invoice in full */}
      <CModal
        visible={!!detail}
        onClose={() => {
          setDetail(null)
          setEditLines(null)
        }}
        alignment="center"
        size="lg"
      >
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {detail?.invoiceNo ?? 'Invoice'}
            {detail?.companyName && (
              <span className="text-muted ms-2 cb-fs-meta">{detail.companyName}</span>
            )}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {detail?.loading ? (
            <div className="cb-empty">Loading…</div>
          ) : (
            detail && (
              <>
                <div className="row g-2 cb-fs-body mb-3">
                  <div className="col-sm-3">
                    <div className="cb-fs-meta text-muted">Period</div>
                    <div className="fw-bold">
                      {fmtDate(detail.periodStart)} → {fmtDate(detail.periodEnd)}
                    </div>
                  </div>
                  <div className="col-sm-3">
                    <div className="cb-fs-meta text-muted">Issued</div>
                    <div className="fw-bold">{fmtDate(detail.issueDate)}</div>
                  </div>
                  <div className="col-sm-3">
                    <div className="cb-fs-meta text-muted">Due</div>
                    <div className="fw-bold">{fmtDate(detail.dueDate)}</div>
                  </div>
                  <div className="col-sm-3">
                    <div className="cb-fs-meta text-muted">Status</div>
                    <div>
                      <span
                        className={`badge ${STATUS_BADGE[detail.status] ?? 'bg-secondary'}`}
                        style={{ fontSize: 9 }}
                      >
                        {detail.status}
                      </span>
                    </div>
                  </div>
                </div>

                <table className="table table-sm cb-table">
                  <thead>
                    <tr>
                      <th>Description</th>
                      <th style={{ width: '1%' }} className="text-end">
                        Amount
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {editLines
                      ? editLines.map((l, i) => (
                          <tr key={l.id || `new-${i}`}>
                            <td>
                              <div className="d-flex gap-1 align-items-start">
                                <input
                                  type="text"
                                  className="form-control form-control-sm rounded-0"
                                  placeholder="What is being charged"
                                  aria-label={`Line ${i + 1} description`}
                                  value={l.description}
                                  onChange={(e) => setEditLine(i, 'description', e.target.value)}
                                />
                                <input
                                  type="number"
                                  min="1"
                                  step="1"
                                  className="form-control form-control-sm rounded-0 text-end"
                                  style={{ width: 70 }}
                                  aria-label={`Line ${i + 1} quantity`}
                                  value={l.quantity}
                                  onChange={(e) => setEditLine(i, 'quantity', e.target.value)}
                                />
                                <input
                                  type="number"
                                  step="0.01"
                                  className="form-control form-control-sm rounded-0 text-end"
                                  style={{ width: 110 }}
                                  placeholder="0.00"
                                  aria-label={`Line ${i + 1} unit amount`}
                                  value={l.unitAmount}
                                  onChange={(e) => setEditLine(i, 'unitAmount', e.target.value)}
                                />
                                <button
                                  type="button"
                                  className="btn btn-sm cancel-btn rounded-0"
                                  title="Remove this line"
                                  aria-label={`Remove line ${i + 1}`}
                                  onClick={() =>
                                    setEditLines((rows) => rows.filter((_, n) => n !== i))
                                  }
                                >
                                  <span className="material-icons" style={{ fontSize: 14 }}>
                                    close
                                  </span>
                                </button>
                              </div>
                              {/* What the line IS, which the editor deliberately cannot change —
                                  relabelling a joining charge as a subscription would not change
                                  what the invoice renews, but would misreport what we sold. */}
                              {l.kind !== 'OneOff' && (
                                <span className="cb-fs-meta text-muted">{l.kind}</span>
                              )}
                            </td>
                            <td className="text-end text-nowrap align-top">
                              {money(
                                (Number(l.quantity) || 1) * (Number(l.unitAmount) || 0),
                                detail.currency,
                              )}
                            </td>
                          </tr>
                        ))
                      : (detail.lines ?? []).map((l, i) => (
                          <tr key={i}>
                            <td>{l.description}</td>
                            <td className="text-end text-nowrap">
                              {money(l.lineTotal, detail.currency)}
                            </td>
                          </tr>
                        ))}
                    <tr>
                      <td className="fw-bold">Total due</td>
                      <td className="text-end fw-bold text-nowrap">
                        {/* While editing, the figure follows the boxes — the saved total is
                            already out of date and showing it would be lying about what Save
                            will write. The brought-forward balance is added because it is part
                            of what the client owes and survives the edit. */}
                        {editLines
                          ? money(editTotal + (detail.balanceBroughtForward ?? 0), detail.currency)
                          : money(detail.amountDue, detail.currency)}
                      </td>
                    </tr>
                    {detail.balanceBroughtForward > 0 && (
                      <tr>
                        <td className="text-muted cb-fs-meta">
                          includes brought forward (not editable — it comes from their other
                          invoices)
                        </td>
                        <td className="text-end text-nowrap cb-fs-meta text-muted">
                          {money(detail.balanceBroughtForward, detail.currency)}
                        </td>
                      </tr>
                    )}
                    {detail.amountPaid > 0 && (
                      <tr>
                        <td className="text-muted">Paid</td>
                        <td className="text-end text-nowrap">
                          {money(detail.amountPaid, detail.currency)}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>

                {/* ---- editing a draft ----

                    Only a draft, and the button says why when it is not one. An issued invoice is
                    a document the client is holding; editing it would leave our copy saying
                    something different from theirs with no trace of the change. */}
                {canManage && detail.status === 'Draft' && (
                  <div className="d-flex flex-wrap gap-2 mt-2">
                    {editLines ? (
                      <>
                        <button
                          type="button"
                          className="btn btn-sm filter-btn rounded-0"
                          disabled={editSaving}
                          onClick={() =>
                            setEditLines((rows) => [
                              ...rows,
                              {
                                id: 0,
                                kind: 'OneOff',
                                referenceId: null,
                                description: '',
                                quantity: '1',
                                unitAmount: '',
                              },
                            ])
                          }
                        >
                          Add a line
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0 ms-auto"
                          disabled={editSaving || editFilled.length === 0}
                          onClick={saveEdit}
                        >
                          {editSaving ? 'Saving…' : 'Save changes'}
                        </button>
                        <button
                          type="button"
                          className="btn btn-sm cancel-btn rounded-0"
                          disabled={editSaving}
                          onClick={() => setEditLines(null)}
                        >
                          Discard
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        className="btn btn-sm filter-btn rounded-0"
                        title="Change what is being charged. Only possible while it is a draft."
                        onClick={startEdit}
                      >
                        Edit the charges
                      </button>
                    )}
                  </div>
                )}

                {detail.cancelledReason && (
                  <div className="alert alert-warning rounded-0 py-1 cb-fs-meta">
                    Cancelled {fmtDate(detail.cancelledAt)} — {detail.cancelledReason}
                  </div>
                )}
                {detail.generatedBy && (
                  <div className="cb-fs-meta text-muted">Raised by {detail.generatedBy}</div>
                )}

                {chases.length > 0 && (
                  <div className="mt-3 pt-2 border-top">
                    <div className="cb-fs-meta text-muted mb-1">
                      Reminders sent ({chases.length})
                    </div>
                    <div className="d-flex flex-wrap gap-1">
                      {chases.map((c) => (
                        <span
                          key={c.reminderNo}
                          className="cb-chip"
                          title={
                            c.emailsQueued + c.smsQueued === 0
                              ? 'No contact details, so nothing could be sent'
                              : `${c.emailsQueued} email(s), ${c.smsQueued} SMS · ` +
                                `${c.daysOverdue}d overdue at the time`
                          }
                        >
                          #{c.reminderNo} · {fmtDate(c.sentOn)}
                          {c.emailsQueued + c.smsQueued === 0 && (
                            <span className="text-danger ms-1">nobody to reach</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="d-flex justify-content-end gap-1 mt-3">
                  {detail.hasPdf ? (
                    <button
                      type="button"
                      className="btn btn-sm filter-btn rounded-0"
                      onClick={() => downloadPdf(detail)}
                    >
                      Download PDF
                    </button>
                  ) : (
                    <span className="me-auto cb-fs-meta text-muted align-self-center">
                      {detail.status === 'Draft'
                        ? 'A PDF is stored when the invoice is issued.'
                        : 'No PDF was stored for this invoice.'}
                    </span>
                  )}
                  {canManage && (
                    <button
                      type="button"
                      className="btn btn-sm filter-btn rounded-0"
                      onClick={() => previewPdf(detail)}
                    >
                      Preview PDF
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm cancel-btn rounded-0"
                    onClick={() => setDetail(null)}
                  >
                    Close
                  </button>
                </div>
              </>
            )
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default Invoices
