import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilChevronLeft,
  cilChevronRight,
  cilChevronDoubleLeft,
  cilChevronDoubleRight,
} from '@coreui/icons'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
const axios = require('axios')

/** Duplicate Branches — review and resolve branches that exist as more than one row. */
/** The rows a bulk run would switch off in one branch. */
const pendingRows = (b) => (b.rows ?? []).filter((r) => !r.recommendedSurvivor && !r.deactivatedAt)

/** Can this branch go in a bulk run? */
const bulkable = (b) => b.verdict === 'SafeToMerge' && pendingRows(b).length > 0

/** Identifies one duplicate group across reloads, where the row objects themselves do not. */
const keyOf = (b) => `${b.cusCode}|${b.branchCode}|${b.forCloud}`

const DuplicateBranches = () => {
  const canResolve = hasModule(MODULES.ResolveDuplicateBranches)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)

  // Step one of the cleanup — switching a suspected duplicate off and waiting.
  const [deactivating, setDeactivating] = useState(false)
  const [deactivateNote, setDeactivateNote] = useState('')
  // Hidden by default so the working area isn't pushed down; the toggle pulses briefly on arrival.
  const [showGuide, setShowGuide] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [summary, setSummary] = useState(null)
  const [clients, setClients] = useState([])
  const [verdictFilter, setVerdictFilter] = useState('')
  const [search, setSearch] = useState('')

  // Two levels of selection: the client on the left, then which of its branches is being compared.
  const [client, setClient] = useState(null)
  const [branch, setBranch] = useState(null)

  // Paging is done by the server, by client: it groups, filters and pages in SQL.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // The admin's choice for the open branch: which row survives, which ids get deleted.
  const [survivorId, setSurvivorId] = useState(null)
  const [deleteIds, setDeleteIds] = useState([])

  // BULK step one. Branch keys ("cus|branch|cloud") ticked for automatic deactivation.
  const [picked, setPicked] = useState([])
  const [bulkBusy, setBulkBusy] = useState(false)
  const [bulkConfirm, setBulkConfirm] = useState(false)

  // What the last run declined, so it can be read after the toast has gone.
  const [skipped, setSkipped] = useState(null)

  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Clients`
  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleDateString(undefined, { dateStyle: 'medium' }) : '—'

  const VERDICT = {
    SafeToMerge: { label: 'Safe to merge', cls: 'bg-success' },
    DifferentBranchName: { label: 'Different branch name', cls: 'bg-danger' },
    DifferentSerial: { label: 'Different serial', cls: 'bg-warning text-dark' },
  }

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [s, c] = await Promise.all([
        axios.get(`${api}/DuplicateBranchSummary`, { headers: authHeaders() }),
        axios.get(`${api}/DuplicateBranches`, {
          params: { verdict: verdictFilter || '', search: search || '', page, pageSize },
          headers: authHeaders(),
        }),
      ])
      setSummary(s.data)
      setClients(c.data?.items ?? [])
      setTotal(c.data?.total ?? 0)
      setTotalPages(c.data?.totalPages ?? 0)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, verdictFilter, search, page, pageSize])

  // Any change to the filters invalidates the current page number.
  const changeSearch = (v) => {
    setSearch(v)
    setPage(1)
    setPicked([])
  }
  const changeVerdict = (v) => {
    setVerdictFilter(v)
    setPage(1)
    setPicked([])
  }
  const changePageSize = (v) => {
    setPageSize(Number(v))
    setPage(1)
    setPicked([])
  }
  const changePage = (p) => {
    setPage(p)
    setPicked([])
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

  // Opening a branch pre-selects the recommendation ONLY when it is safe.
  const openBranch = useCallback((b) => {
    setBranch(b)
    if (b && b.verdict === 'SafeToMerge' && b.rows?.length) {
      const keep = b.rows.find((r) => r.recommendedSurvivor)
      setSurvivorId(keep?.id ?? null)
      setDeleteIds(b.rows.filter((r) => r.id !== keep?.id).map((r) => r.id))
    } else {
      setSurvivorId(null)
      setDeleteIds([])
    }
  }, [])

  const openClient = (c) => {
    setClient(c)
    openBranch(c.branches?.[0] ?? null)
  }

  // Re-point the selection at the freshly loaded data.
  useEffect(() => {
    if (!client) return
    const fresh = clients.find((c) => c.cusCode === client.cusCode)
    if (!fresh) {
      setClient(null)
      openBranch(null)
      return
    }
    setClient(fresh)
    const list = fresh.branches ?? []
    const same = list.find(
      (b) => b.branchCode === branch?.branchCode && b.forCloud === branch?.forCloud,
    )
    openBranch(same ?? list[0] ?? null)
    // Only when the data changes: re-running on selection changes would undo the admin's choices.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clients])

  /* ---- bulk step one: pick many branches, let the server choose each survivor ---- */

  const pickedSet = useMemo(() => new Set(picked), [picked])

  // Every branch on the page that a run could act on, flattened.
  const bulkableOnPage = useMemo(
    () => clients.flatMap((c) => (c.branches ?? []).filter(bulkable)),
    [clients],
  )

  const pickedBranches = useMemo(
    () => bulkableOnPage.filter((b) => pickedSet.has(keyOf(b))),
    [bulkableOnPage, pickedSet],
  )

  const pickedRowCount = pickedBranches.reduce((n, b) => n + pendingRows(b).length, 0)

  const toggleBranchPick = (b) =>
    setPicked((prev) => {
      const k = keyOf(b)
      return prev.includes(k) ? prev.filter((x) => x !== k) : [...prev, k]
    })

  /** The whole client at once — its safe branches only, never its flagged ones. */
  const toggleClientPick = (c) => {
    const keys = (c.branches ?? []).filter(bulkable).map(keyOf)
    if (keys.length === 0) return

    const allOn = keys.every((k) => pickedSet.has(k))
    setPicked((prev) =>
      allOn ? prev.filter((k) => !keys.includes(k)) : [...new Set([...prev, ...keys])],
    )
  }

  const clientPickState = (c) => {
    const keys = (c.branches ?? []).filter(bulkable).map(keyOf)
    if (keys.length === 0) return 'none'
    const on = keys.filter((k) => pickedSet.has(k)).length
    return on === 0 ? 'off' : on === keys.length ? 'all' : 'some'
  }

  /** STEP ONE, for everything ticked. */
  const bulkDeactivate = async () => {
    if (pickedBranches.length === 0) return

    setBulkBusy(true)
    setBulkConfirm(false)
    setError('')
    setSkipped(null)
    try {
      const r = await axios.post(
        `${api}/DeactivateDuplicateBranches`,
        {
          groups: pickedBranches.map((b) => ({
            cusCode: b.cusCode,
            branchCode: b.branchCode,
            forCloud: b.forCloud,
          })),
          note: deactivateNote || null,
        },
        { headers: authHeaders() },
      )

      toast.success(r.data?.message ?? 'Deactivated.', { theme: 'colored', autoClose: 10000 })
      setDeactivateNote('')
      setPicked([])
      if (r.data?.skipped?.length) setSkipped(r.data.skipped)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setBulkBusy(false)
    }
  }

  /** Pick the row to keep — and, by saying so, pick the rest. */
  const chooseSurvivor = (id) => {
    setSurvivorId(id)
    setDeleteIds((branch?.rows ?? []).filter((r) => r.id !== id).map((r) => r.id))
  }

  const toggleDelete = (id) => {
    if (id === survivorId) return
    setDeleteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Always read the nested collections through these.
  const branches = client?.branches ?? []
  const rows = branch?.rows ?? []

  const keptRow = rows.find((r) => r.id === survivorId)
  const doomedRows = rows.filter((r) => deleteIds.includes(r.id))

  // Selected for deletion but never switched off — what step one is for.
  const notYetDeactivated = doomedRows.filter((r) => !r.deactivatedAt).map((r) => r.id)

  // Selected but not yet deletable: never deactivated, put back on, or still inside the wait.
  const notReadyToDelete = doomedRows.filter((r) => !r.canDelete).map((r) => r.id)

  /** STEP ONE: switch the suspected duplicates off without deleting anything. */
  const deactivate = async (ids) => {
    if (!branch || ids.length === 0) return
    setDeactivating(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/DeactivateDuplicateBranch`,
        {
          cusCode: branch.cusCode,
          branchCode: branch.branchCode,
          forCloud: branch.forCloud,
          ids,
          note: deactivateNote || null,
        },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Deactivated.', { theme: 'colored', autoClose: 9000 })
      setDeactivateNote('')
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setDeactivating(false)
    }
  }

  /** The client said they use it — put it back, and close the record so the clock stops. */
  const reactivate = async (ids) => {
    if (!branch || ids.length === 0) return
    setDeactivating(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/ReactivateDuplicateBranch`,
        {
          cusCode: branch.cusCode,
          branchCode: branch.branchCode,
          forCloud: branch.forCloud,
          ids,
        },
        { headers: authHeaders() },
      )
      toast.success(r.data?.message ?? 'Put back.', { theme: 'colored', autoClose: 7000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setDeactivating(false)
    }
  }

  const resolve = async () => {
    if (!branch || !survivorId || deleteIds.length === 0) return
    setResolving(true)
    setError('')
    try {
      const r = await axios.post(
        `${api}/ResolveDuplicateBranch`,
        {
          cusCode: branch.cusCode,
          branchCode: branch.branchCode,
          forCloud: branch.forCloud,
          survivorId,
          deleteIds,
        },
        { headers: authHeaders() },
      )
      toast.success(`Removed ${r.data?.removed} row(s); kept #${r.data?.keptId}.`, {
        theme: 'colored',
        autoClose: 6000,
      })
      setConfirmOpen(false)
      await load() // the effect above moves the selection on to what is left
    } catch (e) {
      setError(readErr(e))
      setConfirmOpen(false)
    } finally {
      setResolving(false)
    }
  }

  // Columns the service reported as varying within this branch — only those get highlighted.
  const cellCls = (field) =>
    branch?.differingFields?.includes(field) ? 'bg-warning-subtle fw-bold' : ''

  const blank = <span className="text-muted">—</span>

  // A client's duplicated branches can be all cloud, all desktop, or a mix of the two.
  const surfaceOf = (c) =>
    c.cloudBranches === 0
      ? { label: 'Desktop', cls: 'bg-dark' }
      : c.cloudBranches === c.duplicateBranches
      ? { label: 'Cloud', cls: 'bg-info text-dark' }
      : { label: 'Mixed', cls: 'bg-secondary' }

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="m-0">Duplicate Branches</h6>
          <div className="d-flex align-items-center gap-3">
            {summary && (
              <span style={{ fontSize: 11 }}>
                <span className="text-muted">clients affected</span>{' '}
                <span className={`fw-bold ${summary.duplicateClients ? 'text-danger' : ''}`}>
                  {summary.duplicateClients}
                </span>
                <span className="text-muted ms-2">duplicated branches</span>{' '}
                <span className="fw-bold">{summary.duplicateGroups}</span>
                <span className="text-muted ms-2">of</span>{' '}
                <span className="fw-bold">{summary.distinctBranches}</span>
                <span className="text-muted ms-2">redundant rows</span>{' '}
                <span className="fw-bold">{summary.redundantRows}</span>
                <span className="text-muted ms-2">need review</span>{' '}
                <span className="fw-bold text-warning-emphasis">{summary.needsReviewGroups}</span>
              </span>
            )}
            <button
              type="button"
              className={`btn btn-sm filter-btn rounded-0 ${showGuide ? '' : 'guide-hint'}`}
              style={{ fontSize: 10 }}
              onClick={() => setShowGuide((v) => !v)}
            >
              {showGuide ? 'Hide guide' : 'How this works'}
            </button>
          </div>
        </div>
      </div>
      <hr className="my-2" />

      {/* Plain-language explanation. */}
      {showGuide && (
        <div className="card rounded-0 mb-2">
          <div className="card-body py-2" style={{ fontSize: 11 }}>
            <div className="row g-3">
              <div className="col-md-4">
                <div className="fw-bold mb-1">What this screen is for</div>A branch should be one
                row, identified by <strong>client + branch code</strong>. Some branches have several
                rows. Pick a client on the left, then one of its branches, choose the row to keep
                and delete the rest. The kept row inherits anything the deleted ones have and it
                lacks — town, company contact, serial, add-on stamp and any missing hardware value.
              </div>
              <div className="col-md-4">
                <div className="fw-bold mb-1">Why it happens</div>
                When a branch registers, the system has to recognise it as one it has already seen.
                Where that check relies on the PC&apos;s CPU, BIOS and disk it fails easily: after a
                server is reconfigured or reset those values can come back <strong>blank</strong>,
                slightly <strong>corrupted</strong>, or <strong>changed</strong> because the machine
                was replaced. The branch is then treated as new and saved again rather than updated.
                Every group here is a <strong>desktop</strong> one — adding a branch through this
                portal already refuses a repeat. One client can be affected on many branches at
                once, which is why they are listed per client.
              </div>
              <div className="col-md-4">
                <div className="fw-bold mb-1">Read the status first</div>
                <span className="badge bg-success">Safe to merge</span> name and serial match on
                every row — the same branch, registered repeatedly.
                <br />
                <span className="badge bg-danger mt-1">Different branch name</span> likely a branch
                code reused for a <strong>second real branch</strong>. Deleting would remove a live
                branch — give one a different code instead.
                <br />
                <span className="badge bg-warning text-dark mt-1">Different serial</span> a
                licensing change. Confirm which serial is current first.
                <br />A client&apos;s badge shows its <strong>worst</strong> branch, so it is clear
                at a glance which accounts cannot simply be merged.
              </div>
            </div>
            <hr className="my-2" />
            <div className="d-flex flex-wrap gap-3">
              <span>
                <span className="badge bg-success">suggested keep</span> the row we recommend
                keeping: the most recent converted row, which is already the one the Licences list
                displays — so keeping it changes nothing anyone currently sees.
              </span>
              <span>
                <span className="badge bg-secondary">blank hw</span> a hardware field is empty on
                that row
              </span>
              <span>
                <span className="badge bg-secondary">exact repeat</span> identical to another row in
                every field — the same registration saved twice
              </span>
              <span>
                <span className="bg-warning-subtle px-2">highlighted cell</span> this value differs
                between the rows
              </span>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger rounded-0 py-1 mb-2" style={{ fontSize: 12 }}>
          {error}
        </div>
      )}

      {summary && summary.duplicateGroups === 0 && (
        <div className="alert alert-success rounded-0 py-2" style={{ fontSize: 12 }}>
          No duplicate branches. The unique index can now be applied — run{' '}
          <code>enforce_clientdetails_branch_unique</code> to make this permanent.
        </div>
      )}

      {/* BULK STEP ONE. Appears only once something is ticked. */}
      {canResolve && pickedBranches.length > 0 && (
        <div className="card rounded-0 mb-2 border-warning">
          <div className="card-body p-2">
            <div className="d-flex align-items-center flex-wrap gap-2">
              <span style={{ fontSize: 12 }}>
                <strong>{pickedBranches.length}</strong> branch(es) selected —{' '}
                <strong>{pickedRowCount}</strong> row(s) will be switched off, keeping the
                recommended row in each.
              </span>

              <input
                type="text"
                className="form-control form-control-sm rounded-0 ms-auto"
                style={{ maxWidth: 280, fontSize: 11 }}
                placeholder="Why (optional) — recorded on every row"
                value={deactivateNote}
                onChange={(e) => setDeactivateNote(e.target.value)}
              />

              <button
                type="button"
                className="btn btn-sm add-btn rounded-0"
                disabled={bulkBusy}
                onClick={() => setBulkConfirm(true)}
              >
                {bulkBusy ? 'Working…' : `Deactivate ${pickedRowCount} row(s)`}
              </button>
              <button
                type="button"
                className="btn btn-sm cancel-btn rounded-0"
                disabled={bulkBusy}
                onClick={() => setPicked([])}
              >
                Clear
              </button>
            </div>

            <span className="d-block text-muted mt-1" style={{ fontSize: 11 }}>
              Nothing is deleted. Each branch keeps the row the review recommends and the rest are
              switched off — if the client does not report a problem, they can then be deleted. Only
              branches marked <strong>safe to merge</strong> can be selected.
            </span>
          </div>
        </div>
      )}

      {/* What the last run would not touch. */}
      {skipped?.length > 0 && (
        <div className="card rounded-0 mb-2 border-warning">
          <div className="card-body p-2">
            <div className="d-flex align-items-center gap-2 mb-1">
              <strong style={{ fontSize: 12 }}>
                {skipped.length} branch(es) were left for you to review
              </strong>
              <button
                type="button"
                className="btn btn-sm cancel-btn rounded-0 ms-auto"
                onClick={() => setSkipped(null)}
              >
                Dismiss
              </button>
            </div>
            <ul className="mb-0 ps-3" style={{ fontSize: 11 }}>
              {skipped.map((s, i) => (
                <li key={`${s.cusCode}|${s.branchCode}|${s.forCloud}|${i}`}>
                  <strong>
                    {s.companyName || s.cusCode} · branch {s.branchCode}
                  </strong>{' '}
                  — {s.reason}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <div className="row g-2">
        {/* Clients */}
        <div className="col-md-5">
          <div className="card rounded-0 h-100">
            <div className="card-body p-2">
              {/* Flex rather than a grid row: the two controls have to read as a single bar. */}
              <div className="d-flex align-items-center gap-1 mb-2">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0 filter-control flex-grow-1"
                  placeholder="Search client name or code…"
                  value={search}
                  onChange={(e) => changeSearch(e.target.value)}
                />
                <select
                  className="form-select form-select-sm rounded-0 filter-control"
                  style={{ width: 160, flex: '0 0 160px' }}
                  value={verdictFilter}
                  onChange={(e) => changeVerdict(e.target.value)}
                >
                  <option value="">All statuses</option>
                  <option value="DifferentBranchName">Different branch name</option>
                  <option value="DifferentSerial">Different serial</option>
                  <option value="SafeToMerge">Safe to merge</option>
                </select>
              </div>

              {loading ? (
                <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
                  Loading…
                </div>
              ) : (
                <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                  <table className="table table-sm table-hover mb-0" style={{ fontSize: 11 }}>
                    <thead>
                      <tr>
                        {/* Select-all across the PAGE. */}
                        {canResolve && (
                          <th style={{ width: '1%' }}>
                            <input
                              type="checkbox"
                              className="form-check-input m-0"
                              title={
                                bulkableOnPage.length === 0
                                  ? 'Nothing on this page can be deactivated automatically'
                                  : `Select all ${bulkableOnPage.length} branch(es) on this page that are safe to merge`
                              }
                              aria-label="Select every safe branch on this page"
                              disabled={bulkableOnPage.length === 0}
                              checked={
                                bulkableOnPage.length > 0 &&
                                pickedBranches.length === bulkableOnPage.length
                              }
                              ref={(el) => {
                                // Indeterminate is a PROPERTY, not an attribute.
                                if (el)
                                  el.indeterminate =
                                    pickedBranches.length > 0 &&
                                    pickedBranches.length < bulkableOnPage.length
                              }}
                              onChange={() =>
                                setPicked(
                                  pickedBranches.length === bulkableOnPage.length
                                    ? []
                                    : bulkableOnPage.map(keyOf),
                                )
                              }
                            />
                          </th>
                        )}
                        <th>Client</th>
                        <th style={{ width: '1%' }}>Type</th>
                        <th
                          style={{ width: '1%' }}
                          title="How many of this client's branches are duplicated"
                        >
                          Branches
                        </th>
                        <th style={{ width: '1%' }} title="Rows that are redundant across them">
                          Extra
                        </th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((c) => {
                        const v = VERDICT[c.worstVerdict] ?? {
                          label: c.worstVerdict,
                          cls: 'bg-secondary',
                        }
                        const s = surfaceOf(c)
                        const isOpen = client?.cusCode === c.cusCode
                        return (
                          <tr
                            key={c.cusCode}
                            role="button"
                            className={isOpen ? 'table-active fw-bold' : ''}
                            onClick={() => openClient(c)}
                          >
                            {canResolve && (
                              // stopPropagation, or ticking the box would also open the client.
                              <td
                                className="align-middle text-center"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <input
                                  type="checkbox"
                                  className="form-check-input m-0"
                                  disabled={clientPickState(c) === 'none'}
                                  title={
                                    clientPickState(c) === 'none'
                                      ? 'None of this client’s branches can be deactivated automatically'
                                      : 'Select this client’s safe branches'
                                  }
                                  aria-label={`Select safe branches for ${
                                    c.companyName || c.cusCode
                                  }`}
                                  checked={clientPickState(c) === 'all'}
                                  ref={(el) => {
                                    if (el) el.indeterminate = clientPickState(c) === 'some'
                                  }}
                                  onChange={() => toggleClientPick(c)}
                                />
                              </td>
                            )}
                            <td className="align-middle">
                              <span className="d-block text-truncate" style={{ maxWidth: 190 }}>
                                {c.companyName || blank}
                              </span>
                              <span className="text-muted" style={{ fontSize: 10 }}>
                                {c.cusCode}
                              </span>
                            </td>
                            <td className="align-middle text-center">
                              <span className={`badge ${s.cls}`} style={{ fontSize: 9 }}>
                                {s.label}
                              </span>
                            </td>
                            <td
                              className="align-middle text-center"
                              title={`${c.duplicateBranches} branch(es) of this client have more than one row`}
                            >
                              <span className="badge bg-secondary">{c.duplicateBranches}</span>
                            </td>
                            <td
                              className="align-middle text-center"
                              title={`${c.copies} rows exist across those branches; ${c.redundantRows} are redundant`}
                            >
                              {c.redundantRows}
                            </td>
                            <td className="align-middle">
                              <span className={`badge ${v.cls}`} style={{ fontSize: 9 }}>
                                {v.label}
                              </span>
                              {/* Only shown when the client is mixed. */}
                              {c.duplicateBranches > 1 && c.safeBranches !== c.duplicateBranches && (
                                <span
                                  className="d-block text-muted mt-1"
                                  style={{ fontSize: 9 }}
                                  title="Breakdown of this client's duplicated branches"
                                >
                                  {c.nameConflicts > 0 && <>{c.nameConflicts} name </>}
                                  {c.serialConflicts > 0 && <>{c.serialConflicts} serial </>}
                                  {c.safeBranches > 0 && <>{c.safeBranches} safe</>}
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })}
                      {clients.length === 0 && (
                        <tr>
                          <td colSpan={canResolve ? 6 : 5} className="text-muted text-center py-3">
                            Nothing matches.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Server-side pager, laid out like the one MaterialTable renders. */}
              {total > 0 && (
                <div className="pager mt-2 pt-2 border-top">
                  <select
                    className="form-select form-select-sm pager-size"
                    value={pageSize}
                    onChange={(e) => changePageSize(e.target.value)}
                    title="Clients per page"
                  >
                    {[5, 10, 25, 50].map((n) => (
                      <option key={n} value={n}>
                        {n} rows
                      </option>
                    ))}
                  </select>

                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page <= 1}
                    onClick={() => changePage(1)}
                    title="First page"
                  >
                    <CIcon icon={cilChevronDoubleLeft} size="sm" />
                  </button>
                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page <= 1}
                    onClick={() => changePage(Math.max(1, page - 1))}
                    title="Previous page"
                  >
                    <CIcon icon={cilChevronLeft} size="sm" />
                  </button>

                  <span className="pager-range">
                    {(page - 1) * pageSize + 1}-{Math.min(page * pageSize, total)} of {total}
                  </span>

                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page >= totalPages}
                    onClick={() => changePage(Math.min(totalPages, page + 1))}
                    title="Next page"
                  >
                    <CIcon icon={cilChevronRight} size="sm" />
                  </button>
                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page >= totalPages}
                    onClick={() => changePage(totalPages)}
                    title="Last page"
                  >
                    <CIcon icon={cilChevronDoubleRight} size="sm" />
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* The selected client: its duplicated branches, then the rows of the chosen one */}
        <div className="col-md-7">
          <div className="card rounded-0 h-100" style={{ minHeight: 340 }}>
            <div className="card-body p-2">
              {!client ? (
                <div className="text-muted text-center py-5" style={{ fontSize: 13 }}>
                  Select a client on the left to see its duplicated branches.
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-1">
                    <span className="fw-bold" style={{ fontSize: 12 }}>
                      {client.companyName || client.cusCode}
                      <span className="text-muted ms-1 fw-normal">({client.cusCode})</span>
                      <span className="text-muted ms-2 fw-normal" style={{ fontSize: 11 }}>
                        {client.duplicateBranches} duplicated branch
                        {client.duplicateBranches === 1 ? '' : 'es'} · {client.redundantRows}{' '}
                        redundant row{client.redundantRows === 1 ? '' : 's'}
                      </span>
                    </span>
                    {canResolve ? (
                      <>
                        {/* STEP ONE before the delete. */}
                        {notYetDeactivated.length > 0 && (
                          <>
                            {/* Why, in the admin's words. */}
                            <input
                              type="text"
                              className="form-control form-control-sm rounded-0 d-inline-block me-2"
                              style={{ fontSize: 11, width: 220 }}
                              maxLength={400}
                              placeholder="Why? e.g. blank BIOS, idle since March"
                              value={deactivateNote}
                              onChange={(e) => setDeactivateNote(e.target.value)}
                            />
                            <button
                              type="button"
                              className="btn btn-sm cancel-btn rounded-0 me-2"
                              style={{ fontSize: 11 }}
                              disabled={deactivating}
                              title="Switch the selected rows off and leave them. If the client is using one, they will tell you."
                              onClick={() => deactivate(notYetDeactivated)}
                            >
                              {deactivating
                                ? 'Working…'
                                : `Deactivate ${notYetDeactivated.length} selected`}
                            </button>
                          </>
                        )}
                        <button
                          type="button"
                          className="btn btn-sm delete-btn rounded-0"
                          style={{ fontSize: 11 }}
                          disabled={
                            resolving ||
                            !survivorId ||
                            deleteIds.length === 0 ||
                            notReadyToDelete.length > 0
                          }
                          // Disabled rather than hidden, with the reason in the tooltip.
                          title={
                            notReadyToDelete.length > 0
                              ? `${notReadyToDelete.length} selected row(s) are not switched off. Deactivate a suspected duplicate first, so what is removed is a row somebody chose to retire rather than one that happens to be idle.`
                              : undefined
                          }
                          onClick={() => setConfirmOpen(true)}
                        >
                          Delete {deleteIds.length} selected…
                        </button>
                      </>
                    ) : (
                      <span
                        className="badge bg-secondary"
                        title="You do not have the right to resolve duplicates"
                      >
                        view only
                      </span>
                    )}
                  </div>

                  {/* This client's duplicated branches. */}
                  <div
                    className="border mb-2"
                    style={{
                      maxHeight: branches.length > 4 ? 132 : undefined,
                      overflowY: 'auto',
                    }}
                  >
                    <table className="table table-sm table-hover mb-0" style={{ fontSize: 10 }}>
                      <thead>
                        <tr>
                          {canResolve && (
                            <th style={{ width: '1%' }}>
                              <input
                                type="checkbox"
                                className="form-check-input m-0"
                                title="Select this client’s safe branches"
                                aria-label="Select this client’s safe branches"
                                disabled={!client || clientPickState(client) === 'none'}
                                checked={!!client && clientPickState(client) === 'all'}
                                ref={(el) => {
                                  if (el)
                                    el.indeterminate =
                                      !!client && clientPickState(client) === 'some'
                                }}
                                onChange={() => client && toggleClientPick(client)}
                              />
                            </th>
                          )}
                          <th style={{ width: '1%' }}>Branch</th>
                          <th>Branch name</th>
                          <th style={{ width: '1%' }}>Type</th>
                          <th style={{ width: '1%' }} title="Rows that exist for this one branch">
                            Rows
                          </th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {branches.map((b) => {
                          const v = VERDICT[b.verdict] ?? { label: b.verdict, cls: 'bg-secondary' }
                          const isOpen =
                            branch?.branchCode === b.branchCode && branch?.forCloud === b.forCloud
                          const canBulk = bulkable(b)
                          return (
                            <tr
                              key={`${b.branchCode}|${b.forCloud}`}
                              role="button"
                              className={isOpen ? 'table-active fw-bold' : ''}
                              onClick={() => openBranch(b)}
                            >
                              {canResolve && (
                                <td
                                  className="align-middle text-center"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <input
                                    type="checkbox"
                                    className="form-check-input m-0"
                                    disabled={!canBulk}
                                    title={
                                      canBulk
                                        ? `Deactivate ${
                                            pendingRows(b).length
                                          } duplicate row(s), keeping the recommended one`
                                        : b.verdict === 'SafeToMerge'
                                        ? 'Already deactivated'
                                        : 'Flagged for review — open it and decide by hand'
                                    }
                                    aria-label={`Select branch ${b.branchCode}`}
                                    checked={pickedSet.has(keyOf(b))}
                                    onChange={() => toggleBranchPick(b)}
                                  />
                                </td>
                              )}
                              <td className="align-middle text-center">{b.branchCode}</td>
                              <td className="align-middle text-truncate" style={{ maxWidth: 160 }}>
                                {b.rows?.[0]?.branchName || blank}
                              </td>
                              <td className="align-middle text-center">
                                <span
                                  className={`badge ${
                                    b.forCloud ? 'bg-info text-dark' : 'bg-dark'
                                  }`}
                                  style={{ fontSize: 9 }}
                                >
                                  {b.forCloud ? 'Cloud' : 'Desktop'}
                                </span>
                              </td>
                              <td className="align-middle text-center">
                                <span className="badge bg-secondary">{b.copies}</span>
                              </td>
                              <td className="align-middle">
                                <span className={`badge ${v.cls}`} style={{ fontSize: 9 }}>
                                  {v.label}
                                </span>
                                {b.blankHardwareRows > 0 && (
                                  <span
                                    className="badge bg-secondary ms-1"
                                    style={{ fontSize: 9 }}
                                    title="Rows with a blank hardware field"
                                  >
                                    {b.blankHardwareRows} blank hw
                                  </span>
                                )}
                                {b.exactRepeatRows > 0 && (
                                  <span
                                    className="badge bg-secondary ms-1"
                                    style={{ fontSize: 9 }}
                                    title="Rows identical to another in every field"
                                  >
                                    {b.exactRepeatRows} exact repeat
                                  </span>
                                )}
                              </td>
                            </tr>
                          )
                        })}
                        {branches.length === 0 && (
                          <tr>
                            <td
                              colSpan={canResolve ? 6 : 5}
                              className="text-muted text-center py-2"
                            >
                              No branch detail came back for this client — reload the page.
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  {!branch ? (
                    <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
                      Select a branch above to compare its rows.
                    </div>
                  ) : (
                    <>
                      <div className="d-flex align-items-center mb-1" style={{ fontSize: 11 }}>
                        <span className="text-muted">Comparing branch</span>
                        <span className="fw-bold ms-1">
                          {branch.branchCode}
                          {rows[0]?.branchName ? ` · ${rows[0].branchName}` : ''}
                        </span>
                        <span className="text-muted ms-1">— {branch.copies} rows</span>
                      </div>

                      {branch.verdict !== 'SafeToMerge' && (
                        <div
                          className="alert alert-warning rounded-0 py-1 mb-2"
                          style={{ fontSize: 11 }}
                        >
                          {branch.verdict === 'DifferentBranchName' ? (
                            <>
                              <strong>These rows have different branch names.</strong> This is
                              usually a branch code reused for a second, real branch — deleting
                              either would remove a live branch. Nothing is pre-selected; give one
                              of them a different branch code instead of merging, unless you are
                              certain.
                            </>
                          ) : (
                            <>
                              <strong>These rows carry different serials.</strong> That is a
                              licensing event, not just a re-registration. Confirm which serial is
                              current before deleting anything.
                            </>
                          )}
                        </div>
                      )}

                      <div style={{ maxHeight: 340, overflowY: 'auto' }}>
                        <table
                          className="table table-sm table-bordered mb-0"
                          style={{ fontSize: 10 }}
                        >
                          <thead>
                            <tr>
                              <th
                                style={{ width: '1%' }}
                                title="The single row to keep. Choosing it ticks every other row in this branch — untick any you want left alone."
                              >
                                Keep
                              </th>
                              <th
                                style={{ width: '1%' }}
                                title="Rows to remove. They are moved to Archived Branches, where they can be restored."
                              >
                                Delete
                              </th>
                              <th title="ClientDetails row id">Id</th>
                              <th
                                style={{ width: '1%' }}
                                title="Step one: switch a suspected duplicate off and wait for the client to object"
                              >
                                Confirmation
                              </th>
                              <th className={cellCls('branchName')}>Branch name</th>
                              <th className={cellCls('serialNo')}>Serial</th>
                              <th className={cellCls('activateExpiryDate')}>Expiry</th>
                              <th className={cellCls('userCount')}>Users</th>
                              <th className={cellCls('pickHdd')}>Disk</th>
                              <th className={cellCls('pickCpu')}>CPU</th>
                              <th className={cellCls('pickBios')}>BIOS</th>
                              <th>Flags</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rows.map((r) => {
                              const keep = r.id === survivorId
                              const del = deleteIds.includes(r.id)
                              return (
                                <tr
                                  key={r.id}
                                  className={keep ? 'table-success' : del ? 'table-danger' : ''}
                                >
                                  <td className="text-center align-middle">
                                    <input
                                      type="radio"
                                      name="survivor"
                                      className="form-check-input"
                                      checked={keep}
                                      disabled={!canResolve}
                                      onChange={() => chooseSurvivor(r.id)}
                                    />
                                  </td>
                                  <td className="text-center align-middle">
                                    <input
                                      type="checkbox"
                                      className="form-check-input"
                                      checked={del}
                                      disabled={!canResolve || keep}
                                      onChange={() => toggleDelete(r.id)}
                                    />
                                  </td>
                                  <td className="align-middle">{r.id}</td>

                                  {/* STEP ONE AT A GLANCE. */}
                                  <td className="align-middle text-nowrap">
                                    {r.deactivatedAt ? (
                                      <>
                                        <span
                                          className={`badge ${
                                            r.canDelete ? 'bg-success' : 'bg-warning text-dark'
                                          }`}
                                        >
                                          {/* Two states now, not three. */}
                                          {r.canDelete ? 'Off — can delete' : 'Back in use'}
                                        </span>
                                        <span
                                          className="d-block text-muted"
                                          style={{ fontSize: 10 }}
                                        >
                                          off since {fmtDate(r.deactivatedAt)}
                                        </span>
                                        {r.deactivationNote && (
                                          <span
                                            className="d-block text-muted"
                                            style={{ fontSize: 10 }}
                                          >
                                            {r.deactivationNote}
                                          </span>
                                        )}
                                        {canResolve && (
                                          <button
                                            type="button"
                                            className="btn btn-sm filter-btn rounded-0 mt-1 text-nowrap"
                                            disabled={deactivating}
                                            title="The client says they use this one — put it back."
                                            onClick={() => reactivate([r.id])}
                                          >
                                            They use it
                                          </button>
                                        )}
                                      </>
                                    ) : keep ? (
                                      <span className="text-muted" style={{ fontSize: 10 }}>
                                        keeping
                                      </span>
                                    ) : (
                                      canResolve && (
                                        <button
                                          type="button"
                                          className="btn btn-sm cancel-btn rounded-0 text-nowrap"
                                          disabled={deactivating}
                                          title="Switch this row off and wait. If the client is using it they will tell you."
                                          onClick={() => deactivate([r.id])}
                                        >
                                          {deactivating ? 'Working…' : 'Deactivate'}
                                        </button>
                                      )
                                    )}
                                  </td>
                                  <td className={`align-middle ${cellCls('branchName')}`}>
                                    {r.branchName || blank}
                                  </td>
                                  <td className={`align-middle ${cellCls('serialNo')}`}>
                                    {r.serialNo || blank}
                                  </td>
                                  <td className={`align-middle ${cellCls('activateExpiryDate')}`}>
                                    {r.activateExpiryDate || blank}
                                  </td>
                                  <td className={`align-middle ${cellCls('userCount')}`}>
                                    {r.userCount || blank}
                                  </td>
                                  <td className={`align-middle ${cellCls('pickHdd')}`}>
                                    {r.pickHdd || <span className="badge bg-secondary">blank</span>}
                                  </td>
                                  <td className={`align-middle ${cellCls('pickCpu')}`}>
                                    {r.pickCpu || <span className="badge bg-secondary">blank</span>}
                                  </td>
                                  <td className={`align-middle ${cellCls('pickBios')}`}>
                                    {r.pickBios || (
                                      <span className="badge bg-secondary">blank</span>
                                    )}
                                  </td>
                                  <td className="align-middle text-nowrap">
                                    {r.recommendedSurvivor && (
                                      <span
                                        className="badge bg-success"
                                        style={{ fontSize: 9 }}
                                        title="Recommended row to keep — the most recent converted row, already the one the Licences list shows"
                                      >
                                        suggested keep
                                      </span>
                                    )}
                                    {r.isUpdated && (
                                      <span
                                        className="badge bg-info text-dark ms-1"
                                        style={{ fontSize: 9 }}
                                        title="Converted — this client has been provisioned"
                                      >
                                        converted
                                      </span>
                                    )}
                                    {r.isExactRepeat && (
                                      <span
                                        className="badge bg-secondary ms-1"
                                        style={{ fontSize: 9 }}
                                        title="Identical to another row in every field"
                                      >
                                        exact repeat
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Confirmed against an explicit list of what goes and what stays. */}
      {/* Confirming the BULK step one. */}
      <CModal
        alignment="center"
        visible={bulkConfirm}
        backdrop="static"
        size="lg"
        onClose={() => setBulkConfirm(false)}
      >
        <CModalHeader>
          <CModalTitle>Deactivate {pickedRowCount} duplicate row(s)?</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="alert alert-warning rounded-0 py-2 mb-3" style={{ fontSize: 12 }}>
            <strong>Nothing is deleted.</strong> Each branch keeps the recommended row and the rest
            are switched off. If a client reports a problem, put the row back — that tells you it
            was the live one. The rest can then be deleted, and a deleted branch is kept in{' '}
            <strong>Archived Branches</strong> where it can be restored.
          </div>

          <div className="mb-1" style={{ fontSize: 12 }}>
            <span className="text-muted">
              {pickedBranches.length} branch(es) across{' '}
              {new Set(pickedBranches.map((b) => b.cusCode)).size} client(s)
            </span>
          </div>

          <div style={{ maxHeight: 300, overflowY: 'auto' }}>
            <table className="table table-sm table-bordered mb-0" style={{ fontSize: 11 }}>
              <thead>
                <tr>
                  <th>Client</th>
                  <th style={{ width: '1%' }}>Branch</th>
                  <th style={{ width: '1%' }}>Keeping</th>
                  <th style={{ width: '1%' }}>Switching off</th>
                </tr>
              </thead>
              <tbody>
                {pickedBranches.map((b) => {
                  const keep = (b.rows ?? []).find((r) => r.recommendedSurvivor)
                  return (
                    <tr key={keyOf(b)}>
                      <td className="text-truncate" style={{ maxWidth: 220 }}>
                        {b.companyName || b.cusCode}
                        <span className="text-muted d-block" style={{ fontSize: 9 }}>
                          {b.cusCode}
                        </span>
                      </td>
                      <td className="text-center">{b.branchCode}</td>
                      <td className="text-center table-success">{keep?.id ?? blank}</td>
                      <td className="text-center">{pendingRows(b).length}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CModalBody>
        <div className="d-flex gap-2 p-3 pt-0">
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0 ms-auto"
            disabled={bulkBusy}
            onClick={bulkDeactivate}
          >
            {bulkBusy ? 'Working…' : `Deactivate ${pickedRowCount} row(s)`}
          </button>
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0"
            disabled={bulkBusy}
            onClick={() => setBulkConfirm(false)}
          >
            Cancel
          </button>
        </div>
      </CModal>

      <CModal alignment="center" visible={confirmOpen} backdrop="static" size="lg">
        <CModalHeader>
          <CModalTitle>Confirm deletion</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {branch && (
            <>
              {/* NO LONGER "cannot be undone", because it can. */}
              <div className="alert alert-warning rounded-0 py-2 mb-3" style={{ fontSize: 12 }}>
                <strong>
                  {deleteIds.length} row{deleteIds.length === 1 ? '' : 's'} will be removed from the
                  licensing data.
                </strong>{' '}
                Each one is moved to <strong>Archived Branches</strong>, where it can be restored
                exactly as it was. The deletion is recorded in the audit log against your user.
              </div>

              <div className="mb-2" style={{ fontSize: 12 }}>
                <span className="text-muted">Branch</span>{' '}
                <span className="fw-bold">
                  {branch.companyName || branch.cusCode} ({branch.cusCode}) · branch{' '}
                  {branch.branchCode}
                </span>
                <span
                  className={`badge ms-2 ${branch.forCloud ? 'bg-info text-dark' : 'bg-dark'}`}
                  style={{ fontSize: 9 }}
                >
                  {branch.forCloud ? 'Cloud' : 'Desktop'}
                </span>
              </div>

              <label className="col-form-label divider fw-semibold p-0 mb-1">Keeping</label>
              <table className="table table-sm table-bordered mb-3" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Branch name</th>
                    <th>Serial</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="table-success">
                    <td className="fw-bold">{keptRow?.id}</td>
                    <td>{keptRow?.branchName || blank}</td>
                    <td>{keptRow?.serialNo || blank}</td>
                    <td>{keptRow?.activateExpiryDate || blank}</td>
                  </tr>
                </tbody>
              </table>

              <label className="col-form-label divider fw-semibold p-0 mb-1">Deleting</label>
              <table className="table table-sm table-bordered mb-2" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Id</th>
                    <th>Branch name</th>
                    <th>Serial</th>
                    <th>Expiry</th>
                  </tr>
                </thead>
                <tbody>
                  {doomedRows.map((r) => (
                    <tr key={r.id} className="table-danger">
                      <td>{r.id}</td>
                      <td>{r.branchName || blank}</td>
                      <td>{r.serialNo || blank}</td>
                      <td>{r.activateExpiryDate || blank}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div className="form-text" style={{ fontSize: 10 }}>
                Before the rows are removed, the kept row inherits anything it is missing that they
                have — town, company email and phone, serial, add-on stamp, and any blank hardware
                value.
              </div>

              {branch.verdict !== 'SafeToMerge' && (
                <div
                  className="alert alert-warning rounded-0 py-1 mt-2 mb-0"
                  style={{ fontSize: 11 }}
                >
                  This branch is flagged <strong>{VERDICT[branch.verdict]?.label}</strong>. Be sure
                  these rows are the same branch before continuing.
                </div>
              )}

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm delete-btn rounded-0"
                  disabled={resolving}
                  onClick={resolve}
                >
                  {resolving ? 'Deleting…' : `Delete ${deleteIds.length} row(s)`}
                </button>
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  disabled={resolving}
                  onClick={() => setConfirmOpen(false)}
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default DuplicateBranches
