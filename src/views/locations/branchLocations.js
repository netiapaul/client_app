import React, { useState, useEffect, useCallback, useMemo } from 'react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import SearchableSelect from '../../components/SearchableSelect'
const axios = require('axios')

/**
 * Branch Locations — one place to see and fix every client branch's region/county/town.
 *
 * Replaces opening each client, then each of its branches, just to discover which ones still have
 * no location. The left list carries a located/total count per client (incomplete clients first, an
 * "only incomplete" filter and a cloud/desktop one); the right pane edits that client's branches
 * inline.
 *
 * Edits are staged, not saved per keystroke: pick region → county → town on as many branches as you
 * like, then Save. Each branch is written centrally and mirrored onto its BRANCH row in the client's
 * own database; a mirror failure is reported per row as a warning, since the central value is
 * authoritative and the push can be retried.
 */
const BranchLocations = () => {
  // The screen itself is gated by ViewBranchLocations on the route/nav; editing is a separate
  // right. Without it the pickers are read-only and the save actions are gone — the server
  // enforces the same split, so this is convenience, not the control.
  const canManage = hasModule(MODULES.ManageBranchLocations)

  const [error, setError] = useState('')
  const [loadingClients, setLoadingClients] = useState(false)
  const [loadingBranches, setLoadingBranches] = useState(false)
  const [saving, setSaving] = useState(false)

  const [summary, setSummary] = useState(null)
  const [clients, setClients] = useState([])
  const [search, setSearch] = useState('')
  const [onlyMissing, setOnlyMissing] = useState(false)
  // Cloud/desktop surface: '' both, 'true' cloud, 'false' desktop. A string so it maps onto a
  // <select> directly, matching the dashboard's Client Type filter.
  const [clientType, setClientType] = useState('')
  const [selected, setSelected] = useState(null) // the client whose branches are shown

  const [branches, setBranches] = useState([])
  // Staged edits keyed by branch row id: { regionId, countyId, townId }. A row only appears here
  // once touched, so an untouched branch is never written.
  const [edits, setEdits] = useState({})

  // Lookup caches. Counties/towns are fetched per parent id and kept, so switching between branches
  // in the same county doesn't refetch.
  const [regions, setRegions] = useState([])
  const [countiesByRegion, setCountiesByRegion] = useState({})
  const [townsByCounty, setTownsByCounty] = useState({})

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )

  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const api = `${process.env.REACT_APP_URL_CONFIG}/api/Locations`

  // The surface filter as the API takes it: a nullable bool, so "both" means sending nothing at all
  // rather than an empty string (which a bool? parameter would reject).
  const typeParam = useMemo(
    () => (clientType === '' ? {} : { forCloud: clientType === 'true' }),
    [clientType],
  )

  // ---- loads ----

  const loadSummary = useCallback(async () => {
    try {
      const r = await axios.get(`${api}/CoverageSummary`, {
        params: { ...typeParam },
        headers: authHeaders(),
      })
      setSummary(r.data)
    } catch (e) {
      /* the header stat is a nicety — never block the screen on it */
    }
  }, [api, authHeaders, typeParam])

  const loadClients = useCallback(async () => {
    setLoadingClients(true)
    setError('')
    try {
      const r = await axios.get(`${api}/ClientCoverage`, {
        params: { search: search || '', onlyMissing, ...typeParam },
        headers: authHeaders(),
      })
      setClients(r.data ?? [])
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoadingClients(false)
    }
  }, [api, authHeaders, search, onlyMissing, typeParam])

  const loadRegions = useCallback(async () => {
    try {
      const r = await axios.get(`${api}/Regions`, { headers: authHeaders() })
      setRegions(r.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }, [api, authHeaders])

  const loadCounties = useCallback(
    async (regionId) => {
      if (!regionId || countiesByRegion[regionId]) return
      try {
        const r = await axios.get(`${api}/Counties`, {
          params: { regionId },
          headers: authHeaders(),
        })
        setCountiesByRegion((prev) => ({ ...prev, [regionId]: r.data ?? [] }))
      } catch (e) {
        setError(readErr(e))
      }
    },
    [api, authHeaders, countiesByRegion],
  )

  const loadTowns = useCallback(
    async (countyId) => {
      if (!countyId || townsByCounty[countyId]) return
      try {
        const r = await axios.get(`${api}/Towns`, { params: { countyId }, headers: authHeaders() })
        setTownsByCounty((prev) => ({ ...prev, [countyId]: r.data ?? [] }))
      } catch (e) {
        setError(readErr(e))
      }
    },
    [api, authHeaders, townsByCounty],
  )

  const loadBranches = useCallback(
    async (cuscode) => {
      if (!cuscode) return
      setLoadingBranches(true)
      setBranches([])
      setEdits({})
      try {
        const r = await axios.get(`${api}/ClientBranches`, {
          params: { cuscode, ...typeParam },
          headers: authHeaders(),
        })
        const rows = r.data ?? []
        setBranches(rows)
        // Warm the lookups the already-located rows need, so their pickers show a label rather
        // than an empty box on first paint.
        const regionIds = [...new Set(rows.map((b) => b.regionId).filter(Boolean))]
        const countyIds = [...new Set(rows.map((b) => b.countyId).filter(Boolean))]
        await Promise.all([
          ...regionIds.map((rid) => loadCounties(rid)),
          ...countyIds.map((cid) => loadTowns(cid)),
        ])
      } catch (e) {
        setError(readErr(e))
      } finally {
        setLoadingBranches(false)
      }
    },
    [api, authHeaders, loadCounties, loadTowns, typeParam],
  )

  useEffect(() => {
    loadRegions()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // The header totals have to follow the surface filter, so this re-runs when it changes
  // (loadSummary's identity only moves with it).
  useEffect(() => {
    loadSummary()
  }, [loadSummary])

  // Re-query the client list on search / filter change, debounced so typing doesn't spam the API.
  useEffect(() => {
    const t = setTimeout(() => loadClients(), 250)
    return () => clearTimeout(t)
  }, [loadClients])

  // Likewise the open client's branches: the rows on the right must be the ones its located/total
  // count was computed from, otherwise the two panes disagree.
  useEffect(() => {
    if (selected?.cusCode) loadBranches(selected.cusCode)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clientType])

  useEffect(() => {
    if (error) {
      const t = setTimeout(() => setError(''), 10000)
      return () => clearTimeout(t)
    }
  }, [error])

  // ---- editing ----

  // The effective value for a row: the staged edit if it has one, otherwise what was loaded.
  const rowValue = (b) =>
    edits[b.id] ?? {
      regionId: b.regionId ? String(b.regionId) : '',
      countyId: b.countyId ? String(b.countyId) : '',
      townId: b.townId ? String(b.townId) : '',
    }

  const setRow = (b, patch) =>
    setEdits((prev) => ({ ...prev, [b.id]: { ...rowValue(b), ...patch } }))

  const onRegion = async (b, regionId) => {
    // Changing a parent clears what hangs off it, so a stale county/town can't be saved.
    setRow(b, { regionId, countyId: '', townId: '' })
    if (regionId) await loadCounties(regionId)
  }

  const onCounty = async (b, countyId) => {
    setRow(b, { countyId, townId: '' })
    if (countyId) await loadTowns(countyId)
  }

  const onTown = (b, townId) => setRow(b, { townId })

  // Only rows whose town actually differs from what was loaded are worth saving.
  const pendingIds = useMemo(
    () =>
      Object.keys(edits).filter((id) => {
        const b = branches.find((x) => String(x.id) === String(id))
        if (!b) return false
        const before = b.townId ? String(b.townId) : ''
        return (edits[id].townId || '') !== before
      }),
    [edits, branches],
  )

  // Copy the first located branch's town to every branch that has none — the common case where a
  // client's branches all sit in one town, and the whole point of "as easy as possible".
  const applyFirstToEmpty = () => {
    const source = branches.find((b) => rowValue(b).townId)
    if (!source) {
      toast.info('Set a location on one branch first, then this copies it to the empty ones.', {
        theme: 'colored',
      })
      return
    }
    const v = rowValue(source)
    const next = { ...edits }
    let n = 0
    branches.forEach((b) => {
      if (rowValue(b).townId) return
      next[b.id] = { regionId: v.regionId, countyId: v.countyId, townId: v.townId }
      n++
    })
    setEdits(next)
    toast.info(
      n ? `Copied to ${n} branch(es) — review, then Save.` : 'Every branch already has a location.',
      {
        theme: 'colored',
      },
    )
  }

  const saveAll = async () => {
    if (pendingIds.length === 0) return
    setSaving(true)
    setError('')
    try {
      const items = pendingIds.map((id) => ({
        id: Number(id),
        townId: edits[id].townId ? Number(edits[id].townId) : null,
      }))
      const r = await axios.put(`${api}/BranchLocationBulk`, { items }, { headers: authHeaders() })
      const { saved, failed, warnings, results } = r.data ?? {}

      if (saved > 0) {
        toast.success(`Saved ${saved} branch location(s).`, { theme: 'colored', autoClose: 5000 })
      }
      // A warning means the central write landed but the client database didn't — worth showing
      // per row, because each is a different host that may need a retry.
      if (warnings > 0) {
        ;(results ?? [])
          .filter((x) => x.saved && x.warning)
          .forEach((x) => toast.warning(x.warning, { theme: 'colored', autoClose: 12000 }))
      }
      if (failed > 0) {
        const first = (results ?? []).find((x) => !x.saved)
        setError(`${failed} branch(es) could not be saved. ${first?.error ?? ''}`)
      }

      await Promise.all([loadBranches(selected?.cusCode), loadClients(), loadSummary()])
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const selectClient = (c) => {
    if (pendingIds.length > 0 && !window.confirm('Discard unsaved location changes?')) return
    setSelected(c)
    loadBranches(c.cusCode)
  }

  // Switching surface reloads the branch list and so drops staged edits — ask first, exactly as
  // picking a different client does.
  const changeClientType = (v) => {
    if (v === clientType) return
    if (pendingIds.length > 0 && !window.confirm('Discard unsaved location changes?')) return
    setClientType(v)
  }

  // ---- render ----

  const coverageBadge = (c) => {
    if (c.branchesTotal === 0) return <span className="badge bg-secondary">no branches</span>
    if (c.complete) return <span className="badge bg-success">all {c.branchesTotal}</span>
    return (
      <span className="badge bg-warning text-dark">
        {c.branchesLocated} of {c.branchesTotal}
      </span>
    )
  }

  // Which surface a client's branches sit on. Same colours as the Duplicate Branches screen, so
  // Cloud/Desktop/Mixed mean the same thing wherever they appear.
  //
  // "Mixed" = the customer holds BOTH licences: some of its branches are cloud rows and some are
  // desktop rows. Read off the whole-client counts, not the filtered total, so the category still
  // tells the truth while one surface is being worked on — a mixed client stays mixed under the
  // Cloud filter, which is precisely when it is worth knowing it has desktop branches too.
  // Returns null when the API sent no counts at all — an older build of it, say. Nothing is
  // rendered in that case: inferring a category from absent fields is how every client ends up
  // wearing the same badge, which looks like data and isn't.
  const surfaceOf = (c) => {
    if (c.cloudBranches == null && c.desktopBranches == null) return null
    if (!c.cloudBranches) return { label: 'Desktop', cls: 'bg-dark' }
    if (!c.desktopBranches) return { label: 'Cloud', cls: 'bg-info text-dark' }
    return { label: 'Mixed', cls: 'bg-secondary' }
  }

  const surfaceTitle = (c) =>
    c.cloudBranches && c.desktopBranches
      ? `Holds both licences: ${c.cloudBranches} cloud and ${c.desktopBranches} desktop branch(es)`
      : c.cloudBranches
      ? `${c.cloudBranches} cloud branch(es)`
      : `${c.desktopBranches ?? 0} desktop branch(es)`

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between align-items-center">
          <h6 className="m-0">Branch Locations</h6>
          {summary && (
            <span className="text-muted" style={{ fontSize: 11 }}>
              <span className="fw-bold text-body">{summary.branchesLocated}</span> of{' '}
              <span className="fw-bold text-body">{summary.branchesTotal}</span> branches located
              {/* Said explicitly: the totals follow the surface filter, so without this the
                  numbers would appear to drop for no visible reason. */}
              {clientType !== '' && (
                <span className="ms-1">({clientType === 'true' ? 'cloud' : 'desktop'} only)</span>
              )}
              {summary.branchesMissing > 0 && (
                <span className="text-danger fw-bold ms-2">
                  {summary.branchesMissing} still missing
                </span>
              )}
            </span>
          )}
        </div>
      </div>
      <hr className="my-2" />

      {error && (
        <div className="alert alert-danger d-flex align-items-center mx-0 mb-2 rounded-0 py-1">
          <span style={{ fontSize: 12 }}>{error}</span>
        </div>
      )}

      <div className="row g-2">
        {/* Clients */}
        <div className="col-md-4">
          <div className="card rounded-0 h-100">
            <div className="card-body p-2">
              {/* Search and surface read as one bar; heights are pinned by .filter-control. */}
              <div className="d-flex align-items-center gap-1 mb-2">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0 filter-control flex-grow-1"
                  placeholder="Search client name or code…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="form-select form-select-sm rounded-0 filter-control"
                  style={{ width: 110, flex: '0 0 110px' }}
                  title="Cloud and desktop are separate licences for the same customer, with separate branches"
                  value={clientType}
                  onChange={(e) => changeClientType(e.target.value)}
                >
                  <option value="">Both</option>
                  <option value="true">Cloud</option>
                  <option value="false">Desktop</option>
                </select>
              </div>
              <div className="form-check mb-2">
                <input
                  className="form-check-input"
                  type="checkbox"
                  id="onlyMissing"
                  checked={onlyMissing}
                  onChange={(e) => setOnlyMissing(e.target.checked)}
                />
                <label className="form-check-label" htmlFor="onlyMissing" style={{ fontSize: 11 }}>
                  Only clients with missing locations
                </label>
              </div>

              {loadingClients ? (
                <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
                  Loading…
                </div>
              ) : clients.length === 0 ? (
                <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
                  {onlyMissing
                    ? clientType === ''
                      ? 'Every branch has a location.'
                      : `Every ${
                          clientType === 'true' ? 'cloud' : 'desktop'
                        } branch has a location.`
                    : 'No clients match.'}
                </div>
              ) : (
                <ul
                  className="list-group list-group-flush"
                  style={{ maxHeight: 520, overflowY: 'auto' }}
                >
                  {clients.map((c) => (
                    <li
                      key={c.cusCode}
                      role="button"
                      className={`list-group-item list-group-item-action py-1 px-2 d-flex justify-content-between align-items-center ${
                        selected?.cusCode === c.cusCode ? 'active-row fw-bold' : ''
                      }`}
                      style={{ fontSize: 11 }}
                      onClick={() => selectClient(c)}
                    >
                      <span className="text-truncate me-2">
                        <span
                          className="d-block text-truncate"
                          title={`${c.companyName} (${c.cusCode})`}
                        >
                          {c.companyName}
                          <span className="text-muted ms-1">({c.cusCode})</span>
                        </span>
                        {/* Two separate facts. "Attached" is the dashboard's Server column, so the
                            screens agree; having a database is what decides whether a save can
                            actually reach BRANCH, and a legacy client can have one without the
                            other. */}
                        <span
                          className={`d-block text-truncate fw-normal ${
                            c.attachedToServer
                              ? 'text-muted'
                              : c.hasDatabase
                              ? 'text-warning-emphasis'
                              : 'text-danger'
                          }`}
                          style={{ fontSize: 10 }}
                          title={
                            c.attachedToServer
                              ? `Linked to ${c.serverName} — database ${c.dbName}`
                              : c.hasDatabase
                              ? `Not linked to a server in the listing, but database ${c.dbName} was found on this instance, so locations will still be applied.`
                              : 'No database found — locations save centrally only'
                          }
                        >
                          {c.attachedToServer
                            ? `${c.serverName} · ${c.dbName}`
                            : c.hasDatabase
                            ? `not linked · ${c.dbName}`
                            : 'no database found'}
                        </span>
                      </span>
                      <span className="d-flex flex-column align-items-end gap-1">
                        {coverageBadge(c)}
                        {surfaceOf(c) && (
                          <span
                            className={`badge ${surfaceOf(c).cls}`}
                            style={{ fontSize: 9 }}
                            title={surfaceTitle(c)}
                          >
                            {surfaceOf(c).label}
                          </span>
                        )}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>

        {/* Branches */}
        <div className="col-md-8">
          <div className="card rounded-0 h-100" style={{ minHeight: 320 }}>
            <div className="card-body p-2">
              {!selected ? (
                <div className="text-muted text-center py-5" style={{ fontSize: 13 }}>
                  Select a client on the left to set its branch locations.
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <span className="fw-bold" style={{ fontSize: 12 }}>
                      {selected.companyName}
                      <span className="text-muted ms-1 fw-normal">({selected.cusCode})</span>
                      {selected.hasDatabase && (
                        <span className="text-muted ms-2 fw-normal" style={{ fontSize: 10 }}>
                          {selected.attachedToServer ? `${selected.serverName} · ` : ''}
                          {selected.dbName}
                        </span>
                      )}
                    </span>
                    <div className="d-flex gap-2 align-items-center">
                      {pendingIds.length > 0 && (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          {pendingIds.length} unsaved
                        </span>
                      )}
                      {canManage ? (
                        <>
                          <button
                            type="button"
                            className="btn btn-sm filter-btn rounded-0"
                            style={{ fontSize: 11 }}
                            disabled={saving || loadingBranches || branches.length < 2}
                            title="Copy the first branch that has a location to every branch without one"
                            onClick={applyFirstToEmpty}
                          >
                            Copy to empty
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm add-btn rounded-0"
                            style={{ fontSize: 11 }}
                            disabled={saving || pendingIds.length === 0}
                            onClick={saveAll}
                          >
                            {saving
                              ? 'Saving…'
                              : `Save${pendingIds.length ? ` (${pendingIds.length})` : ''}`}
                          </button>
                        </>
                      ) : (
                        <span className="badge bg-secondary">view only</span>
                      )}
                    </div>
                  </div>

                  {loadingBranches ? (
                    <div className="text-muted text-center py-5" style={{ fontSize: 12 }}>
                      Loading branches…
                    </div>
                  ) : (
                    <div style={{ maxHeight: 520, overflowY: 'auto' }}>
                      <table className="table table-sm mb-0" style={{ fontSize: 11 }}>
                        <thead>
                          <tr>
                            <th style={{ width: '1%' }}>#</th>
                            {/* A branch code is only unique within a surface — the same client can
                                have a branch 1 on each — so the rows need telling apart here.
                                Always shown: with a filter on, it is also what says which surface
                                these rows are. */}
                            <th style={{ width: '1%' }}>Type</th>
                            <th style={{ minWidth: 110 }}>Branch</th>
                            <th style={{ minWidth: 130 }}>Region</th>
                            <th style={{ minWidth: 130 }}>County</th>
                            <th style={{ minWidth: 130 }}>Town</th>
                          </tr>
                        </thead>
                        <tbody>
                          {branches.map((b) => {
                            const v = rowValue(b)
                            const dirty = pendingIds.includes(String(b.id))
                            return (
                              <tr key={b.id} className={dirty ? 'table-active' : ''}>
                                <td className="align-middle">{b.branchCode}</td>
                                {/* A dash, not "Desktop", when the row carries no flag — absent is
                                    not the same as false, and guessing here mislabels every row. */}
                                <td className="align-middle text-center">
                                  {b.forCloud == null ? (
                                    <span className="text-muted" title="Not reported by the API">
                                      —
                                    </span>
                                  ) : (
                                    <span
                                      className={`badge ${
                                        b.forCloud ? 'bg-info text-dark' : 'bg-dark'
                                      }`}
                                      style={{ fontSize: 9 }}
                                    >
                                      {b.forCloud ? 'Cloud' : 'Desktop'}
                                    </span>
                                  )}
                                </td>
                                <td className="align-middle">
                                  <span className="fw-bold">{b.branchName}</span>
                                  {!v.townId && (
                                    <span className="badge bg-warning text-dark ms-1">
                                      no location
                                    </span>
                                  )}
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={regions}
                                    value={v.regionId}
                                    onChange={(val) => onRegion(b, val)}
                                    getId={(o) => o.regionId}
                                    getLabel={(o) => o.name}
                                    placeholder="Region…"
                                    disabled={!canManage}
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={countiesByRegion[v.regionId] ?? []}
                                    value={v.countyId}
                                    onChange={(val) => onCounty(b, val)}
                                    getId={(o) => o.countyId}
                                    getLabel={(o) => o.name}
                                    placeholder="County…"
                                    disabled={!canManage || !v.regionId}
                                  />
                                </td>
                                <td>
                                  <SearchableSelect
                                    options={townsByCounty[v.countyId] ?? []}
                                    value={v.townId}
                                    onChange={(val) => onTown(b, val)}
                                    getId={(o) => o.townId}
                                    getLabel={(o) => o.name}
                                    placeholder="Town…"
                                    disabled={!canManage || !v.countyId}
                                  />
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                      {branches.length === 0 && (
                        <div className="text-muted text-center py-4" style={{ fontSize: 12 }}>
                          {clientType === ''
                            ? 'This client has no branches.'
                            : `This client has no ${
                                clientType === 'true' ? 'cloud' : 'desktop'
                              } branches — switch the filter to see its others.`}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Said up front rather than discovered as a warning after saving. Keyed on
                      hasDatabase, not attachedToServer: what matters here is whether there is
                      somewhere to write, and a legacy client can have one without the other. */}
                  {selected.hasDatabase ? (
                    <div className="form-text mt-2" style={{ fontSize: 10 }}>
                      Saving writes the location centrally and mirrors it onto the branch&apos;s
                      BRANCH row in <span className="fw-bold">{selected.dbName}</span>
                      {selected.attachedToServer ? (
                        <>
                          {' '}
                          on <span className="fw-bold">{selected.serverName}</span>
                        </>
                      ) : (
                        <> on this instance (no server link recorded in the client listing)</>
                      )}
                      . If it can&apos;t be reached the central value is still saved and you&apos;ll
                      see a warning for that branch.
                    </div>
                  ) : (
                    <div
                      className="alert alert-warning rounded-0 py-1 mt-2 mb-0"
                      style={{ fontSize: 10 }}
                    >
                      No database could be found for this client, so there is nothing to mirror
                      into. Locations set here are saved centrally and will reach its BRANCH rows
                      once it is attached to a server.
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default BranchLocations
