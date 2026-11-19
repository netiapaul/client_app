import React, { useState, useEffect, useCallback } from 'react'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import {
  cilChevronLeft,
  cilChevronRight,
  cilChevronDoubleLeft,
  cilChevronDoubleRight,
} from '@coreui/icons'
import { getToken } from '../../utils/session'
import useConfirm from '../../components/useConfirm'
import { toast } from 'react-toastify'
const axios = require('axios')

/**
 * Client Portal Users — who can sign in to the customer-facing portal, and which companies each of
 * them may see.
 *
 * One person can own several companies with different cus codes, so a portal login is linked to
 * companies explicitly rather than matched on an email field. The links on this screen are the
 * whole authorisation: a portal user sees exactly the companies listed against their name and
 * nothing else, enforced server-side on every request.
 *
 * Passwords are never chosen here. Creating an account (or resetting one) issues a temporary
 * password that is shown ONCE and is not recoverable afterwards, and the portal forces a change at
 * first sign-in.
 */
const PortalUsers = () => {
  // Replaces window.confirm, which the browser prefixes with its own hostname and which
  // cannot mark a destructive action. See useConfirm.
  const [confirm, confirmDialog] = useConfirm()
  const api = `${process.env.REACT_APP_URL_CONFIG}/api/ClientPortalUsers`

  const authHeaders = useCallback(
    () => ({
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }),
    [],
  )
  const readErr = (e) => e?.response?.data?.message || e?.message || 'Something went wrong.'

  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)

  const [items, setItems] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('') // '' all | 'true' active | 'false' disabled

  // Server-side paging: the browser only ever holds one page, however many accounts exist.
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(20)
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(0)

  // Editing. `form` null means the drawer is shut; an id on it means editing rather than creating.
  const [form, setForm] = useState(null)
  // The one-time temporary password, held only long enough to be read and copied.
  const [issued, setIssued] = useState(null)

  // Company picker
  const [companyQuery, setCompanyQuery] = useState('')
  const [companyOptions, setCompanyOptions] = useState([])
  const [companyBusy, setCompanyBusy] = useState(false)
  // Show companies another portal account already holds. Off by default — see visibleCompanies.
  const [showAssigned, setShowAssigned] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const r = await axios.get(api, {
        params: {
          search: search || '',
          page,
          pageSize,
          ...(status !== '' && { isActive: status === 'true' }),
        },
        headers: authHeaders(),
      })
      setItems(r.data?.items ?? [])
      setTotal(r.data?.total ?? 0)
      setTotalPages(r.data?.totalPages ?? 0)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setLoading(false)
    }
  }, [api, authHeaders, search, status, page, pageSize])

  // Any filter change invalidates the page number, so it is reset at the source rather than in an
  // effect — that avoids firing a request for a page that no longer exists.
  const changeSearch = (v) => {
    setSearch(v)
    setPage(1)
  }
  const changeStatus = (v) => {
    setStatus(v)
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

  // Companies are searched on the server and capped there too, so the picker never tries to hold
  // every client in the database.
  const searchCompanies = useCallback(
    async (q, forUserId) => {
      setCompanyBusy(true)
      try {
        const r = await axios.get(`${api}/Companies`, {
          // The account being edited is excluded from "already assigned", or every company it
          // already holds would come back marked as taken — by itself.
          params: { search: q || '', take: 25, excludeUserId: forUserId || undefined },
          headers: authHeaders(),
        })
        setCompanyOptions(r.data ?? [])
      } catch (e) {
        setError(readErr(e))
      } finally {
        setCompanyBusy(false)
      }
    },
    [api, authHeaders],
  )

  useEffect(() => {
    if (!form) return
    const t = setTimeout(() => searchCompanies(companyQuery, form.id), 250)
    return () => clearTimeout(t)
  }, [form, companyQuery, searchCompanies])

  // ---- editing ----

  const openCreate = () =>
    setForm({
      id: null,
      name: '',
      email: '',
      phoneNumber: '',
      isActive: true,
      companies: [],
      primaryCusCode: '',
    })

  const openEdit = (u) =>
    setForm({
      id: u.id,
      name: u.name ?? '',
      email: u.email ?? '',
      phoneNumber: u.phoneNumber ?? '',
      isActive: u.isActive,
      companies: (u.companies ?? []).map((c) => ({
        cusCode: c.cusCode,
        companyName: c.companyName,
        // Carried through so the registered-contact prompt works when editing too, not only when
        // creating — an account whose phone was never filled in is the common case for SMS.
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
      })),
      primaryCusCode: (u.companies ?? []).find((c) => c.isPrimary)?.cusCode ?? '',
    })

  const setField = (patch) => setForm((f) => ({ ...f, ...patch }))

  const addCompany = (c) => {
    if (form.companies.some((x) => x.cusCode === c.cusCode)) return
    const companies = [
      ...form.companies,
      // The registered contact details ride along so the details below can be pulled from them.
      {
        cusCode: c.cusCode,
        companyName: c.companyName,
        contactEmail: c.contactEmail,
        contactPhone: c.contactPhone,
      },
    ]

    // Picking the company is the FIRST step, so its registered contacts fill the empty fields
    // straight away rather than waiting to be asked for. Only ever into blanks: anything already
    // typed was typed deliberately and is not overwritten. The note under the fields says where
    // the values came from, so a prefill is never mistaken for something the admin entered.
    const patch = { companies, primaryCusCode: form.primaryCusCode || c.cusCode }

    if (!form.id && !form.email.trim() && c.contactEmail) patch.email = c.contactEmail.trim()
    if (!form.phoneNumber.trim() && c.contactPhone) patch.phoneNumber = c.contactPhone.trim()

    setField(patch)
  }

  /**
   * Companies already held by ANOTHER portal account are kept out of the list by default: the
   * usual case is one login per company, and a picker repeating the ones already covered is what
   * makes a duplicate easy to create by accident.
   *
   * Not removed outright, though — an owner and an accountant can both legitimately need access,
   * and a company silently missing from the list with no explanation is worse than a crowded one.
   * The count says how many are hidden and the toggle brings them back, labelled with who has them.
   */
  const assigned = companyOptions.filter((c) => c.assignedCount > 0)
  const visibleCompanies = showAssigned
    ? companyOptions
    : companyOptions.filter((c) => !c.assignedCount)

  /**
   * What the company registered with — the first linked company that has either on file.
   *
   * Offered rather than applied. The address on the licence record is the one the company actually
   * gave us, so it is the best starting point and spares retyping; but it is often the person who
   * installed the system rather than the person who should read the bills, so an admin confirms it.
   */
  const registered = (form?.companies ?? []).find((c) => c.contactEmail || c.contactPhone)

  const suggestion = registered
    ? {
        company: registered.companyName || registered.cusCode,
        email: (registered.contactEmail || '').trim(),
        phone: (registered.contactPhone || '').trim(),
      }
    : null

  // Only worth showing while something it can actually fill in still differs — otherwise the
  // prompt sits there permanently. On an edit the email is immovable, so it is not counted.
  const suggestionPending =
    !!suggestion &&
    ((!form?.id && suggestion.email && suggestion.email !== form?.email?.trim()) ||
      (suggestion.phone && suggestion.phone !== form?.phoneNumber?.trim()))

  const useRegistered = () =>
    setField({
      // On an existing account the email is the login identifier and the Update endpoint does not
      // accept a change to it, so only a NEW account takes the registered address.
      email: !form.id && suggestion.email ? suggestion.email : form.email,
      phoneNumber: suggestion.phone || form.phoneNumber,
    })

  const removeCompany = (cusCode) => {
    const companies = form.companies.filter((c) => c.cusCode !== cusCode)
    setField({
      companies,
      primaryCusCode:
        form.primaryCusCode === cusCode ? companies[0]?.cusCode ?? '' : form.primaryCusCode,
    })
  }

  const save = async () => {
    if (!form.name.trim()) return setError('Name is required.')
    if (!form.id && !form.email.trim()) return setError('Email is required.')

    setSaving(true)
    setError('')
    try {
      const cusCodes = form.companies.map((c) => c.cusCode)

      if (form.id) {
        // Two calls on purpose: the profile and the company grants are separate concerns, and the
        // grants endpoint is declarative (it receives the full intended set, not a diff).
        await axios.put(
          `${api}/${form.id}`,
          { name: form.name.trim(), phoneNumber: form.phoneNumber.trim(), isActive: form.isActive },
          { headers: authHeaders() },
        )
        await axios.put(
          `${api}/${form.id}/Companies`,
          { cusCodes, primaryCusCode: form.primaryCusCode || null },
          { headers: authHeaders() },
        )
        toast.success('Portal user updated.', { theme: 'colored', autoClose: 4000 })
      } else {
        const r = await axios.post(
          api,
          {
            name: form.name.trim(),
            email: form.email.trim(),
            phoneNumber: form.phoneNumber.trim(),
            cusCodes,
            primaryCusCode: form.primaryCusCode || null,
          },
          { headers: authHeaders() },
        )
        if (r.data?.temporaryPassword) {
          setIssued({
            email: form.email.trim(),
            password: r.data.temporaryPassword,
            emailed: r.data.emailed === true,
            reset: false,
          })
        }
      }

      setForm(null)
      await load()
    } catch (e) {
      setError(readErr(e))
    } finally {
      setSaving(false)
    }
  }

  const resetPassword = async (u) => {
    if (!(await confirm(`Issue a new temporary password for ${u.email}?`))) return
    try {
      const r = await axios.post(`${api}/${u.id}/ResetPassword`, null, { headers: authHeaders() })
      if (r.data?.temporaryPassword) {
        setIssued({
          email: u.email,
          password: r.data.temporaryPassword,
          emailed: r.data.emailed === true,
          reset: true,
        })
      }
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const resetTwoFactor = async (u) => {
    if (!(await confirm(`Turn off two-factor authentication for ${u.email}?`))) return
    try {
      await axios.post(`${api}/${u.id}/ResetTwoFactor`, null, { headers: authHeaders() })
      toast.success('Two-factor authentication reset.', { theme: 'colored', autoClose: 4000 })
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const toggleActive = async (u) => {
    const turningOff = u.isActive
    if (
      turningOff &&
      !(await confirm({
        title: `Disable ${u.email}?`,
        body: 'They will be signed out on their next request and cannot sign in again.',
        danger: true,
        confirmText: 'Disable the account',
      }))
    )
      return
    try {
      if (turningOff) {
        await axios.delete(`${api}/${u.id}`, { headers: authHeaders() })
      } else {
        await axios.put(
          `${api}/${u.id}`,
          { name: u.name, phoneNumber: u.phoneNumber, isActive: true },
          { headers: authHeaders() },
        )
      }
      await load()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const copy = async (text) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.info('Copied.', { theme: 'colored', autoClose: 2000 })
    } catch {
      /* clipboard blocked (http origin or permission) — the value is on screen to read */
    }
  }

  // ---- render ----

  const fmtDate = (v) =>
    v ? new Date(v).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }) : null

  return (
    <>
      {confirmDialog}

      <div className="cb-page-head">
        <h1 className="cb-page-head__title">
          <span className="material-icons">groups</span>
          Client Portal Users
          {total > 0 && <span className="cb-page-head__sub">{total} account(s)</span>}
        </h1>
        <div className="cb-page-head__actions">
          <button type="button" className="btn btn-sm add-btn rounded-0" onClick={openCreate}>
            New portal user
          </button>
        </div>
      </div>

      {error && <div className="alert alert-danger rounded-0 py-1 mb-2 cb-fs-body">{error}</div>}

      <div className="cb-card">
        <div className="cb-card__body">
          <div className="d-flex align-items-center gap-1 mb-2 flex-wrap">
            <input
              type="text"
              className="form-control form-control-sm rounded-0 filter-control flex-grow-1"
              style={{ minWidth: 180 }}
              placeholder="Search name, email or phone…"
              value={search}
              onChange={(e) => changeSearch(e.target.value)}
            />
            <select
              className="form-select form-select-sm rounded-0 filter-control"
              style={{ width: 120, flex: '0 0 120px' }}
              value={status}
              onChange={(e) => changeStatus(e.target.value)}
            >
              <option value="">All</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
          </div>

          {loading ? (
            <div className="cb-empty">Loading…</div>
          ) : items.length === 0 ? (
            <div className="cb-empty">
              <span className="material-icons">person_off</span>
              {search || status ? 'No accounts match.' : 'No portal users yet.'}
            </div>
          ) : (
            <div className="cb-table-wrap" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
              <table className="table table-sm table-hover cb-table">
                <thead>
                  <tr>
                    <th>User</th>
                    <th style={{ minWidth: 200 }}>Companies</th>
                    <th style={{ width: '1%' }}>Status</th>
                    <th style={{ width: '1%' }}>Last sign-in</th>
                    <th style={{ width: '1%' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((u) => (
                    <tr key={u.id}>
                      <td>
                        <span className="d-block fw-bold text-truncate" style={{ maxWidth: 220 }}>
                          {u.name}
                        </span>
                        <span
                          className="d-block text-muted text-truncate cb-fs-meta"
                          style={{ maxWidth: 220 }}
                        >
                          {u.email}
                        </span>
                        {u.phoneNumber && (
                          <span className="d-block text-muted cb-fs-meta">{u.phoneNumber}</span>
                        )}
                      </td>
                      <td>
                        {u.companies?.length ? (
                          <span className="d-flex flex-wrap gap-1">
                            {u.companies.map((c) => (
                              <span
                                key={c.cusCode}
                                className={`cb-chip ${c.isPrimary ? 'is-primary' : ''} ${
                                  c.exists ? '' : 'is-missing'
                                }`}
                                title={
                                  c.exists
                                    ? `${c.companyName} (${c.cusCode}) — ${
                                        c.branchCount
                                      } branch row(s)${c.isPrimary ? ' · opens here' : ''}`
                                    : `${c.cusCode} — no client found with this code`
                                }
                              >
                                <span className="text-truncate" style={{ maxWidth: 150 }}>
                                  {c.companyName || c.cusCode}
                                </span>
                                {c.companyName && (
                                  <span className="cb-chip__code">{c.cusCode}</span>
                                )}
                              </span>
                            ))}
                          </span>
                        ) : (
                          <span className="text-warning-emphasis cb-fs-meta">
                            no companies linked — portal will be empty
                          </span>
                        )}
                      </td>
                      <td className="text-center">
                        <span
                          className={`badge ${u.isActive ? 'bg-success' : 'bg-secondary'}`}
                          style={{ fontSize: 9 }}
                        >
                          {u.isActive ? 'Active' : 'Disabled'}
                        </span>
                        {u.mustChangePassword && (
                          <span
                            className="badge bg-warning text-dark d-block mt-1"
                            style={{ fontSize: 9 }}
                            title="A temporary password is set; they must change it at sign-in"
                          >
                            temp password
                          </span>
                        )}
                        {u.twoFactorEnabled && (
                          <span
                            className="badge bg-info text-dark d-block mt-1"
                            style={{ fontSize: 9 }}
                          >
                            2FA
                          </span>
                        )}
                      </td>
                      <td className="cb-fs-meta text-nowrap">
                        {fmtDate(u.lastLoginAt) ?? <span className="text-muted">never</span>}
                      </td>
                      <td>
                        <span className="d-flex gap-1 justify-content-end">
                          <button
                            type="button"
                            className="btn btn-sm edit-btn rounded-0"
                            onClick={() => openEdit(u)}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm filter-btn rounded-0"
                            title="Issue a new temporary password"
                            onClick={() => resetPassword(u)}
                          >
                            Password
                          </button>
                          {u.twoFactorEnabled && (
                            <button
                              type="button"
                              className="btn btn-sm filter-btn rounded-0"
                              title="Turn off their authenticator"
                              onClick={() => resetTwoFactor(u)}
                            >
                              2FA
                            </button>
                          )}
                          <button
                            type="button"
                            className={`btn btn-sm rounded-0 ${
                              u.isActive ? 'delete-btn' : 'new-btn'
                            }`}
                            onClick={() => toggleActive(u)}
                          >
                            {u.isActive ? 'Disable' : 'Enable'}
                          </button>
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {total > 0 && (
            <div className="pager mt-2 pt-2 border-top">
              <select
                className="form-select form-select-sm pager-size"
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value))
                  setPage(1)
                }}
                title="Accounts per page"
              >
                {[10, 20, 50, 100].map((n) => (
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

      {/* Create / edit */}
      <CModal visible={!!form} onClose={() => setForm(null)} alignment="center" size="lg">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {form?.id ? 'Edit portal user' : 'New portal user'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {form && (
            <>
              <div className="divider mb-2">
                {form.id ? 'Companies this user can see' : '1 · Pick the company'}
              </div>
              <p className="cb-fs-meta text-muted">
                {!form.id && (
                  <>
                    Start here — the contact details the company registered with fill in the fields
                    below, and you can change them.{' '}
                  </>
                )}
                These links are the whole authorisation — the portal shows exactly these companies
                and the server enforces it on every request. One person can own several companies
                with different cus codes; add each one.
              </p>

              {form.companies.length > 0 && (
                <div className="d-flex flex-wrap gap-1 mb-2">
                  {form.companies.map((c) => (
                    <span
                      key={c.cusCode}
                      className={`cb-chip ${form.primaryCusCode === c.cusCode ? 'is-primary' : ''}`}
                    >
                      <span className="text-truncate" style={{ maxWidth: 180 }}>
                        {c.companyName || c.cusCode}
                      </span>
                      <span className="cb-chip__code">{c.cusCode}</span>
                      {form.primaryCusCode !== c.cusCode && (
                        <button
                          type="button"
                          className="btn btn-sm p-0 border-0 bg-transparent cb-fs-meta text-decoration-underline"
                          title="Open the portal on this company"
                          onClick={() => setField({ primaryCusCode: c.cusCode })}
                        >
                          set default
                        </button>
                      )}
                      <button
                        type="button"
                        className="btn btn-sm p-0 border-0 bg-transparent"
                        title="Remove"
                        onClick={() => removeCompany(c.cusCode)}
                      >
                        <span className="material-icons" style={{ fontSize: 13 }}>
                          close
                        </span>
                      </button>
                    </span>
                  ))}
                </div>
              )}

              <input
                type="text"
                className="form-control form-control-sm rounded-0"
                placeholder="Search a client by name or code to add…"
                value={companyQuery}
                onChange={(e) => setCompanyQuery(e.target.value)}
              />

              {assigned.length > 0 && (
                <div className="d-flex align-items-center justify-content-between gap-2 mt-1">
                  <span className="cb-fs-meta text-muted">
                    {assigned.length} company(s) already have a portal login
                    {showAssigned ? '' : ' and are hidden'}.
                  </span>
                  <div className="form-check form-switch m-0">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      role="switch"
                      id="pu-show-assigned"
                      checked={showAssigned}
                      onChange={(e) => setShowAssigned(e.target.checked)}
                    />
                    <label className="form-check-label cb-fs-meta" htmlFor="pu-show-assigned">
                      Show them
                    </label>
                  </div>
                </div>
              )}

              <div
                className="border mt-1"
                style={{ maxHeight: 190, overflowY: 'auto', borderColor: '#e9edf2' }}
              >
                {companyBusy ? (
                  <div className="text-muted text-center py-3 cb-fs-table">Searching…</div>
                ) : visibleCompanies.length === 0 ? (
                  <div className="text-muted text-center py-3 cb-fs-table">
                    {companyOptions.length > 0
                      ? 'Every match already has a portal login. Turn on “Show them” to pick one anyway.'
                      : 'No clients match.'}
                  </div>
                ) : (
                  <ul className="list-group list-group-flush">
                    {visibleCompanies.map((c) => {
                      const added = form.companies.some((x) => x.cusCode === c.cusCode)
                      return (
                        <li
                          key={c.cusCode}
                          role="button"
                          className={`list-group-item list-group-item-action py-1 px-2 d-flex justify-content-between align-items-center cb-fs-table ${
                            added ? 'text-muted' : ''
                          }`}
                          onClick={() => !added && addCompany(c)}
                        >
                          <span className="text-truncate">
                            {c.companyName}
                            <span className="text-muted ms-1">({c.cusCode})</span>
                            {/* Visible before adding, so the admin can tell at a glance whether
                                this company has a contact on file at all. */}
                            {(c.contactEmail || c.contactPhone) && (
                              <span className="d-block text-muted cb-fs-meta text-truncate">
                                {[c.contactEmail, c.contactPhone].filter(Boolean).join(' · ')}
                              </span>
                            )}
                          </span>
                          <span className="cb-fs-meta text-nowrap ms-2 text-end">
                            {added ? (
                              'added'
                            ) : c.assignedCount > 0 ? (
                              // Named, not just flagged: "already taken" invites a second login,
                              // whereas knowing WHO has it usually answers the question.
                              <span className="text-warning-emphasis">
                                {c.assignedTo}
                                {c.assignedCount > 1 && ` +${c.assignedCount - 1}`}
                              </span>
                            ) : (
                              `${c.branchCount} branch row(s)`
                            )}
                          </span>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>

              <hr className="my-3" />

              {!form.id && <div className="divider mb-2">2 · Who signs in</div>}

              <div className="row g-2">
                <div className="col-md-6">
                  <label className="form-label">Name</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-0"
                    value={form.name}
                    onChange={(e) => setField({ name: e.target.value })}
                  />
                </div>
                <div className="col-md-6">
                  <label className="form-label">Email</label>
                  <input
                    type="email"
                    className="form-control form-control-sm rounded-0"
                    value={form.email}
                    disabled={!!form.id}
                    onChange={(e) => setField({ email: e.target.value })}
                  />
                  {form.id && (
                    <div className="form-text cb-fs-meta">
                      The email is the login identifier and can&apos;t be changed here.
                    </div>
                  )}
                </div>
                <div className="col-md-6">
                  <label className="form-label">Phone</label>
                  <input
                    type="text"
                    className="form-control form-control-sm rounded-0"
                    value={form.phoneNumber}
                    onChange={(e) => setField({ phoneNumber: e.target.value })}
                  />
                </div>

                {/* What the company registered with. Offered, never applied silently — the contact
                    on the licence record is often whoever installed the system rather than whoever
                    should be reading the invoices. */}
                {suggestionPending && (
                  <div className="col-12">
                    <div className="alert alert-info rounded-0 py-2 mb-0 cb-fs-body">
                      <div className="d-flex flex-wrap align-items-center gap-2">
                        <span className="material-icons" style={{ fontSize: 17 }}>
                          contact_mail
                        </span>
                        <span>
                          <span className="fw-bold">{suggestion.company}</span> registered with
                          {suggestion.email && (
                            <>
                              {' '}
                              <span className="fw-bold">{suggestion.email}</span>
                            </>
                          )}
                          {suggestion.email && suggestion.phone && ' and'}
                          {suggestion.phone && (
                            <>
                              {' '}
                              <span className="fw-bold">{suggestion.phone}</span>
                            </>
                          )}
                          . Use these, or type different ones above.
                        </span>
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0 ms-auto"
                          disabled={!!form.id && !suggestion.phone}
                          onClick={useRegistered}
                        >
                          Use these
                        </button>
                      </div>
                      {!!form.id && suggestion.email && (
                        <div className="cb-fs-meta mt-1">
                          The email is the login identifier and can&apos;t be changed on an existing
                          account — only the phone will be filled in.
                        </div>
                      )}
                    </div>
                  </div>
                )}
                {form.id && (
                  <div className="col-md-6 d-flex align-items-end">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        id="pu-active"
                        checked={form.isActive}
                        onChange={(e) => setField({ isActive: e.target.checked })}
                      />
                      <label className="form-check-label cb-fs-table" htmlFor="pu-active">
                        Account is active
                      </label>
                    </div>
                  </div>
                )}
              </div>

              <div className="d-flex justify-content-end gap-2 mt-3">
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  disabled={saving}
                  onClick={() => setForm(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-sm add-btn rounded-0"
                  disabled={saving}
                  onClick={save}
                >
                  {saving ? 'Saving…' : form.id ? 'Save changes' : 'Create user'}
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>

      {/* One-time temporary password. Shown once because it is stored only as a hash — there is no
          way to display it again, and saying so is what stops it being closed unread. It is shown
          even when the email went out, because the email can bounce and this is the only copy. */}
      <CModal visible={!!issued} onClose={() => setIssued(null)} alignment="center">
        <CModalHeader closeButton={false}>
          <CModalTitle className="cb-fs-section">
            {issued?.emailed ? 'Sign-in details sent' : 'Temporary password'}
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          {issued && (
            <>
              {issued.emailed ? (
                <div className="alert alert-success rounded-0 py-2 mb-3 cb-fs-body">
                  <span className="fw-bold">Emailed to {issued.email}</span> — with the password
                  below, the companies linked to the account, and the portal link. Keep a copy until
                  they confirm they&apos;re in, in case it bounces.
                </div>
              ) : (
                <div className="alert alert-warning rounded-0 py-2 mb-3 cb-fs-body">
                  <span className="fw-bold">The email could not be sent.</span> Pass the password on
                  yourself, and check the Emails screen — if SMTP isn&apos;t set up the message is
                  sitting there and can be resent.
                </div>
              )}

              <p className="cb-fs-body mb-2">
                {issued.reset ? 'New temporary password for ' : 'Give this to '}
                <span className="fw-bold">{issued.email}</span>. They will be asked to set their own
                password when they next sign in.
              </p>
              <div className="d-flex align-items-center gap-2 mb-2">
                <code
                  className="flex-grow-1 border px-2 py-2 text-center fw-bold"
                  style={{ fontSize: 18, letterSpacing: 2, borderColor: '#e9edf2' }}
                >
                  {issued.password}
                </code>
                <button
                  type="button"
                  className="btn btn-sm filter-btn rounded-0"
                  onClick={() => copy(issued.password)}
                >
                  Copy
                </button>
              </div>
              <div className="alert alert-warning rounded-0 py-1 mb-3 cb-fs-meta">
                This is the only time it can be shown — it is stored as a hash, not as text. If it
                is lost, issue another one.
              </div>
              <div className="d-flex justify-content-end">
                <button
                  type="button"
                  className="btn btn-sm add-btn rounded-0"
                  onClick={() => setIssued(null)}
                >
                  Done
                </button>
              </div>
            </>
          )}
        </CModalBody>
      </CModal>
    </>
  )
}

export default PortalUsers
