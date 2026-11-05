import React, { useState, useEffect, useCallback } from 'react'
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

/**
 * Duplicate Branches — review and resolve branches that exist as more than one row.
 *
 * A branch's identity is (cus code, branch code, cloud flag). Nothing in the database enforces
 * that — ClientDetails is keyed on an identity Id alone — so whether a registration updates or
 * inserts is decided in code. Where that decision compares the PC's CPU/BIOS/disk it is unreliable:
 * many rows have a blank hardware field, some differ only by a corrupted character, and machines
 * get replaced. Each of those misses the existing row and inserts a new one.
 *
 * Organised BY CLIENT. One account can own dozens of duplicated branches (one has 43 of the 81),
 * so the left list is one row per client and its branches are reviewed together on the right —
 * a branch-per-row list repeated the same client name down the page.
 *
 * Deleting licensing rows is destructive and the recommendation is NOT always right, so nothing is
 * resolved automatically and every deletion is confirmed in a modal that spells out exactly what
 * will be kept and removed.
 */
const DuplicateBranches = () => {
  const canResolve = hasModule(MODULES.ResolveDuplicateBranches)

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [resolving, setResolving] = useState(false)
  // Hidden by default so the working area isn't pushed down; the toggle pulses briefly on arrival
  // (see .guide-hint) so it is still noticed.
  const [showGuide, setShowGuide] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)

  const [summary, setSummary] = useState(null)
  const [clients, setClients] = useState([])
  const [verdictFilter, setVerdictFilter] = useState('')
  const [search, setSearch] = useState('')

  // Two levels of selection: the client on the left, then which of its branches is being compared.
  const [client, setClient] = useState(null)
  const [branch, setBranch] = useState(null)

  // Paging is done by the server, by client: it groups, filters and pages in SQL, so the browser
  // only ever holds one page regardless of how large the table gets.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(10)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // The admin's choice for the open branch: which row survives, which ids get deleted.
  const [survivorId, setSurvivorId] = useState(null)
  const [deleteIds, setDeleteIds] = useState([])

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

  // Any change to the filters invalidates the current page number, so reset it at the source
  // rather than in an effect — that avoids firing a request for a page that no longer exists.
  const changeSearch = (v) => {
    setSearch(v)
    setPage(1)
  }
  const changeVerdict = (v) => {
    setVerdictFilter(v)
    setPage(1)
  }
  const changePageSize = (v) => {
    setPageSize(Number(v))
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

  // Opening a branch pre-selects the recommendation ONLY when it is safe. Anything needing review
  // starts blank so the admin has to make the call rather than confirm a default.
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

  // Re-point the selection at the freshly loaded data. Without this, resolving one branch of a
  // client with 43 of them would drop you back to an empty panel after every single merge.
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

  const chooseSurvivor = (id) => {
    setSurvivorId(id)
    setDeleteIds((prev) => prev.filter((x) => x !== id)) // a row can't be kept and deleted
  }

  const toggleDelete = (id) => {
    if (id === survivorId) return
    setDeleteIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  // Always read the nested collections through these. A payload from a backend that hasn't been
  // restarted after the per-client change carries no `branches` at all, and indexing straight into
  // it took the whole screen down with it — a stale API should degrade, not white-screen.
  const branches = client?.branches ?? []
  const rows = branch?.rows ?? []

  const keptRow = rows.find((r) => r.id === survivorId)
  const doomedRows = rows.filter((r) => deleteIds.includes(r.id))

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

  // Columns the service reported as varying within this branch — only those get highlighted, so
  // the eye goes straight to what actually differs instead of scanning every cell.
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

      {/* Plain-language explanation. This module is used rarely and deletes licensing rows, so the
          rules it applies should never have to be inferred from the table. */}
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

      <div className="row g-2">
        {/* Clients */}
        <div className="col-md-5">
          <div className="card rounded-0 h-100">
            <div className="card-body p-2">
              {/* Flex rather than a grid row: the two controls have to read as a single bar, and
                  align-items-center removes any residual vertical drift between an input and a
                  select. Heights are pinned by .filter-control. */}
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
                              {/* Only shown when the client is mixed — otherwise the badge above
                                  already says everything about it. */}
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
                          <td colSpan={5} className="text-muted text-center py-3">
                            Nothing matches.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Server-side pager, laid out like the one MaterialTable renders on the Licences
                  listing so both screens read the same. Only the current page is ever fetched. */}
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
                    onClick={() => setPage(1)}
                    title="First page"
                  >
                    <CIcon icon={cilChevronDoubleLeft} size="sm" />
                  </button>
                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
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
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    title="Next page"
                  >
                    <CIcon icon={cilChevronRight} size="sm" />
                  </button>
                  <button
                    type="button"
                    className="btn pager-btn"
                    disabled={loading || page >= totalPages}
                    onClick={() => setPage(totalPages)}
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
                      <button
                        type="button"
                        className="btn btn-sm delete-btn rounded-0"
                        style={{ fontSize: 11 }}
                        disabled={resolving || !survivorId || deleteIds.length === 0}
                        onClick={() => setConfirmOpen(true)}
                      >
                        Delete {deleteIds.length} selected…
                      </button>
                    ) : (
                      <span
                        className="badge bg-secondary"
                        title="You do not have the right to resolve duplicates"
                      >
                        view only
                      </span>
                    )}
                  </div>

                  {/* This client's duplicated branches. Kept as a short scrolling list because one
                      account can have dozens, and they are worked through one after another. */}
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
                          return (
                            <tr
                              key={`${b.branchCode}|${b.forCloud}`}
                              role="button"
                              className={isOpen ? 'table-active fw-bold' : ''}
                              onClick={() => openBranch(b)}
                            >
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
                            <td colSpan={5} className="text-muted text-center py-2">
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
                              <th style={{ width: '1%' }} title="The single row to keep">
                                Keep
                              </th>
                              <th style={{ width: '1%' }} title="Rows to permanently delete">
                                Delete
                              </th>
                              <th title="ClientDetails row id">Id</th>
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

      {/* Deletion is permanent, so it is confirmed against an explicit list of what goes and what
          stays rather than a one-line browser prompt. */}
      <CModal alignment="center" visible={confirmOpen} backdrop="static" size="lg">
        <CModalHeader>
          <CModalTitle>Confirm deletion</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {branch && (
            <>
              <div className="alert alert-danger rounded-0 py-2 mb-3" style={{ fontSize: 12 }}>
                <strong>
                  {deleteIds.length} row{deleteIds.length === 1 ? '' : 's'} will be permanently
                  deleted.
                </strong>{' '}
                This cannot be undone. The deletion is recorded in the audit log against your user.
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
