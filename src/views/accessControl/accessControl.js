import React, { useState, useEffect, useCallback } from 'react'
import { getToken } from '../../utils/session'
import swal from 'sweetalert'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

const authHeaders = () => ({
  Authorization: `Bearer ${getToken()}`,
  Accept: 'application/json',
  'Content-Type': 'application/json',
})
const readErr = (e) =>
  e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

// Manage access groups and the module permissions each grants. Assigning users to groups is done
// on the Users screen (user create/update), not here.
const AccessControl = () => {
  const [modules, setModules] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedId, setSelectedId] = useState(null)
  const [draftCodes, setDraftCodes] = useState([]) // editable module codes for the selected group
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [msg, setMsg] = useState('')

  // Create/edit group modal.
  const [modalOpen, setModalOpen] = useState(false)
  const [form, setForm] = useState({ id: null, name: '', description: '' })

  const err = (e) => setError(readErr(e))
  const flash = (m) => {
    setMsg(m)
    setTimeout(() => setMsg(''), 5000)
  }

  const selected = groups.find((g) => g.id === selectedId) || null

  const load = useCallback(async () => {
    setError('')
    try {
      const [m, g] = await Promise.all([
        axios.get(`${BASE_URL}/api/AccessControl/Modules`, { headers: authHeaders() }),
        axios.get(`${BASE_URL}/api/AccessControl/Groups`, { headers: authHeaders() }),
      ])
      setModules(m.data ?? [])
      setGroups(g.data ?? [])
    } catch (e) {
      err(e)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  // Keep the editable module checkboxes in sync with the selected group.
  useEffect(() => {
    const g = groups.find((x) => x.id === selectedId)
    setDraftCodes(g ? [...g.moduleCodes] : [])
  }, [selectedId, groups])

  const openCreate = () => {
    setForm({ id: null, name: '', description: '' })
    setModalOpen(true)
  }
  const openEdit = () => {
    if (!selected) return
    setForm({ id: selected.id, name: selected.name, description: selected.description || '' })
    setModalOpen(true)
  }

  const saveGroup = async () => {
    if (!form.name.trim()) return
    setBusy(true)
    setError('')
    try {
      if (form.id) {
        await axios.put(
          `${BASE_URL}/api/AccessControl/Groups/${form.id}`,
          { name: form.name.trim(), description: form.description },
          { headers: authHeaders() },
        )
        await load()
        flash('Group updated.')
      } else {
        const r = await axios.post(
          `${BASE_URL}/api/AccessControl/Groups`,
          { name: form.name.trim(), description: form.description },
          { headers: authHeaders() },
        )
        await load()
        setSelectedId(r.data?.id ?? null)
        flash('Group created.')
      }
      setModalOpen(false)
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  const deleteGroup = () => {
    if (!selected) return
    swal({
      title: `Delete "${selected.name}"?`,
      text: 'Members will lose the access this group granted.',
      icon: 'warning',
      buttons: true,
      dangerMode: true,
    }).then(async (ok) => {
      if (!ok) return
      setBusy(true)
      setError('')
      try {
        await axios.delete(`${BASE_URL}/api/AccessControl/Groups/${selected.id}`, {
          headers: authHeaders(),
        })
        setSelectedId(null)
        await load()
        flash('Group deleted.')
      } catch (e) {
        err(e)
      } finally {
        setBusy(false)
      }
    })
  }

  const toggleDraft = (code) =>
    setDraftCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )

  const saveModules = async () => {
    if (!selected) return
    setBusy(true)
    setError('')
    try {
      await axios.put(`${BASE_URL}/api/AccessControl/Groups/${selected.id}/Modules`, draftCodes, {
        headers: authHeaders(),
      })
      await load()
      flash('Permissions saved.')
    } catch (e) {
      err(e)
    } finally {
      setBusy(false)
    }
  }

  // Group the module catalog by ModuleGroup for display.
  const grouped = modules.reduce((acc, m) => {
    ;(acc[m.moduleGroup || 'Other'] = acc[m.moduleGroup || 'Other'] || []).push(m)
    return acc
  }, {})

  const dirty =
    selected &&
    (draftCodes.length !== selected.moduleCodes.length ||
      draftCodes.some((c) => !selected.moduleCodes.includes(c)))

  return (
    <div style={{ fontSize: 11 }}>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">Access Control</h6>
        <button
          className="btn btn-sm add-btn rounded-0"
          onClick={openCreate}
          disabled={busy}
          type="button"
        >
          New Group
        </button>
      </div>
      <hr className="my-2" />

      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert" style={{ fontSize: 11 }}>
          {error}
        </div>
      )}
      {msg && (
        <div className="alert alert-success rounded-0 p-2" role="alert" style={{ fontSize: 11 }}>
          {msg}
        </div>
      )}

      <div className="row g-2">
        {/* Groups list */}
        <div className="col-md-4">
          <div className="card rounded-0">
            <div className="card-header py-2" style={{ fontSize: 12, fontWeight: 600 }}>
              Groups
            </div>
            <div className="list-group list-group-flush">
              {groups.length === 0 && (
                <div className="p-3 text-muted" style={{ fontSize: 11 }}>
                  No groups yet.
                </div>
              )}
              {groups.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  className="list-group-item list-group-item-action d-flex justify-content-between align-items-center"
                  onClick={() => setSelectedId(g.id)}
                  style={{
                    fontSize: 11,
                    ...(g.id === selectedId
                      ? { background: '#C58C4F', borderColor: '#C58C4F', color: '#fff' }
                      : {}),
                  }}
                >
                  <span>
                    <span style={{ fontWeight: 600 }}>{g.name}</span>
                    {g.isSystem && (
                      <span className="badge bg-secondary ms-2" style={{ fontSize: 8 }}>
                        system
                      </span>
                    )}
                    {g.description && (
                      <div style={{ fontSize: 10, opacity: 0.85 }}>{g.description}</div>
                    )}
                  </span>
                  <span className="text-nowrap" style={{ fontSize: 9 }}>
                    {g.userCount} user{g.userCount === 1 ? '' : 's'} · {g.moduleCodes.length} mod
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Selected group permissions */}
        <div className="col-md-8">
          {!selected ? (
            <div className="card rounded-0">
              <div className="card-body text-muted" style={{ fontSize: 11 }}>
                Select a group to manage its permissions, or create a new one. Add users to groups
                from the <strong>Users</strong> screen when creating or editing a user.
              </div>
            </div>
          ) : (
            <div className="card rounded-0">
              <div className="card-header py-2 d-flex justify-content-between align-items-center">
                <span style={{ fontSize: 12, fontWeight: 600 }}>{selected.name} — permissions</span>
                <span className="d-flex gap-2">
                  <button
                    className="btn btn-sm edit-btn rounded-0"
                    onClick={openEdit}
                    disabled={busy}
                    type="button"
                  >
                    Rename
                  </button>
                  <button
                    className="btn btn-sm delete-btn rounded-0"
                    onClick={deleteGroup}
                    disabled={busy || selected.isSystem}
                    title={selected.isSystem ? 'Protected system group' : 'Delete group'}
                    type="button"
                  >
                    Delete
                  </button>
                </span>
              </div>
              <div className="card-body" style={{ fontSize: 11 }}>
                {selected.isSystem && (
                  <div className="alert alert-warning rounded-0 p-2" style={{ fontSize: 10 }}>
                    This is the protected Administrators group — it always has every permission.
                  </div>
                )}
                {Object.keys(grouped).map((name) => (
                  <div key={name} className="mb-2">
                    <div
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        color: '#8a94a6',
                        letterSpacing: '0.05em',
                      }}
                    >
                      {name}
                    </div>
                    <div className="row g-1 mt-0">
                      {grouped[name].map((m) => (
                        <div className="col-md-6" key={m.moduleCode}>
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              id={`mod-${m.moduleCode}`}
                              checked={draftCodes.includes(m.moduleCode)}
                              disabled={selected.isSystem}
                              onChange={() => toggleDraft(m.moduleCode)}
                            />
                            <label
                              className="form-check-label"
                              htmlFor={`mod-${m.moduleCode}`}
                              style={{ fontSize: 11 }}
                            >
                              {m.name}
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {!selected.isSystem && (
                  <button
                    className="btn btn-sm add-btn rounded-0 mt-2"
                    onClick={saveModules}
                    disabled={busy || !dirty}
                    type="button"
                  >
                    {busy ? 'Saving…' : 'Save Permissions'}
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Create / edit group modal (in-app, not the browser prompt) */}
      <CModal visible={modalOpen} onClose={() => setModalOpen(false)} alignment="center">
        <CModalHeader>
          <CModalTitle style={{ fontSize: 14 }}>{form.id ? 'Edit Group' : 'New Group'}</CModalTitle>
        </CModalHeader>
        <CModalBody style={{ fontSize: 12 }}>
          <label className="form-label mb-0">Name</label>
          <input
            className="form-control form-control-sm rounded-0 mb-2"
            value={form.name}
            placeholder="e.g. Finance"
            autoFocus
            onChange={(e) => setForm({ ...form, name: e.target.value })}
          />
          <label className="form-label mb-0">Description</label>
          <input
            className="form-control form-control-sm rounded-0"
            value={form.description}
            placeholder="Optional"
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />
        </CModalBody>
        <CModalFooter>
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setModalOpen(false)}
            disabled={busy}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0"
            onClick={saveGroup}
            disabled={busy || !form.name.trim()}
          >
            {busy ? 'Saving…' : form.id ? 'Save' : 'Create'}
          </button>
        </CModalFooter>
      </CModal>
    </div>
  )
}

export default AccessControl
