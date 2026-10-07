import React, { useState, useEffect } from 'react'
import { getToken } from '../../utils/session'
import {
  CModal,
  CModalHeader,
  CModalTitle,
  CModalBody,
  CModalFooter,
  CPopover,
} from '@coreui/react'

const axios = require('axios')
const BASE_URL = process.env.REACT_APP_URL_CONFIG

// Short explanations shown in a click popover next to each server-setup field.
const FIELD_HELP = {
  serverName:
    'A friendly name to identify this server (e.g. "Makadara Server"). It must match the ThisServerName configured on that server\'s app.',
  sqlInstance:
    'The SQL Server instance on this server where client databases live, e.g. CorebackEndMaka\\SQLEXPRESS01.',
  provisioningApiUrl:
    "This server's app (ClientsApi) web address that the master calls to create databases on it, e.g. https://corebasebackendmakadara.co.ke:5020. Required for every server except the master.",
  templateDb:
    'Only the MASTER needs a clean template database (e.g. CleanDB). The master backs it up and ships it to the target server for each new client. Leave blank on non-master servers.',
  backupPath:
    'Working .bak path. On the master: where the CleanDB backup is written. On a target server: where the shipped backup is received and restored from. Must be writable by the SQL Server service account.',
  dataPath:
    "Optional folder (on the target SQL server) where the new database's DATA files (.mdf/.ndf) are placed. Leave blank to use the server's default data folder.",
  logPath:
    "Optional folder (on the target SQL server) where the new database's LOG files (.ldf) are placed. Best practice is a separate volume from the data files. Leave blank to use the server's default log folder (falls back to the data folder).",
  baseUrl:
    'Product Base URL for this server (from the client configuration sheet). Saved on each client.',
  userUrl: 'Product URL end users use to access the system on this server. Saved on each client.',
  reportUrl: 'Product URL used for reporting on this server. Saved on each client.',
  reportServer: 'The report server / SQL instance used for reports on this server.',
  isMaster:
    'The master hosts the frontend, holds licensing (CorebaseClients) and the clean template DB, and pushes provisioning to the other servers. Only one server can be master.',
}

const renderHelp = (field) => (
  <CPopover content={FIELD_HELP[field]} placement="top" trigger="click">
    <span
      className="material-icons ms-1"
      role="button"
      title="Click for help"
      style={{ fontSize: '15px', verticalAlign: 'middle', cursor: 'pointer', color: '#F58B40' }}
    >
      info
    </span>
  </CPopover>
)

const emptyForm = {
  serverName: '',
  sqlInstance: '',
  provisioningApiUrl: '',
  templateDb: '',
  baseUrl: '',
  userUrl: '',
  reportUrl: '',
  reportServer: '',
  backupPath: '',
  dataPath: '',
  logPath: '',
  isMaster: false,
  isActive: true,
}

const Servers = () => {
  const [servers, setServers] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(emptyForm)
  const [guideOpen, setGuideOpen] = useState(false)
  const [testOpen, setTestOpen] = useState(false)
  const [testResult, setTestResult] = useState(null)
  const [testName, setTestName] = useState('')

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  const readErr = (e) =>
    e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

  // Load the registry (full rows, for editing) and merge in the readiness from ServersStatus.
  const getServers = async () => {
    setIsLoading(true)
    try {
      const [full, status] = await Promise.all([
        axios.get(`${BASE_URL}/api/Provisioning/Servers`, { headers: authHeaders() }),
        axios
          .get(`${BASE_URL}/api/Provisioning/ServersStatus`, { headers: authHeaders() })
          .catch(() => ({ data: [] })),
      ])
      const statusById = {}
      ;(status.data ?? []).forEach((s) => {
        statusById[s.id] = s
      })
      const merged = (full.data ?? []).map((s) => ({
        ...s,
        ready: statusById[s.id]?.ready ?? null,
        issues: statusById[s.id]?.issues ?? '',
      }))
      setServers(merged)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    getServers()
  }, [])

  const runTest = async (serverName) => {
    setTestName(serverName)
    setTestResult(null)
    setTestOpen(true)
    try {
      const res = await axios.post(
        `${BASE_URL}/api/Provisioning/TestServer`,
        { serverName },
        { headers: authHeaders() },
      )
      setTestResult(res.data)
    } catch (e) {
      setTestResult({ error: readErr(e) })
    }
  }

  const openAdd = () => {
    setForm(emptyForm)
    setEditingId(null)
    setModalOpen(true)
  }

  const openEdit = (s) => {
    setForm({
      serverName: s.serverName ?? '',
      sqlInstance: s.sqlInstance ?? '',
      provisioningApiUrl: s.provisioningApiUrl ?? '',
      templateDb: s.templateDb ?? '',
      baseUrl: s.baseUrl ?? '',
      userUrl: s.userUrl ?? '',
      reportUrl: s.reportUrl ?? '',
      reportServer: s.reportServer ?? '',
      backupPath: s.backupPath ?? '',
      dataPath: s.dataPath ?? '',
      logPath: s.logPath ?? '',
      isMaster: s.isMaster ?? false,
      isActive: s.isActive ?? true,
    })
    setEditingId(s.id)
    setModalOpen(true)
  }

  const saveServer = async (e) => {
    e.preventDefault()
    setError('')
    setIsLoading(true)
    try {
      if (editingId) {
        await axios.put(`${BASE_URL}/api/Provisioning/Server/${editingId}`, form, {
          headers: authHeaders(),
        })
      } else {
        await axios.post(`${BASE_URL}/api/Provisioning/Server`, form, { headers: authHeaders() })
      }
      setModalOpen(false)
      const name = form.serverName
      setForm(emptyForm)
      setEditingId(null)
      await getServers()
      runTest(name) // verify reachability/readiness after save
    } catch (e) {
      setError(readErr(e))
    } finally {
      setIsLoading(false)
    }
  }

  const deleteServer = async (id, name) => {
    if (!window.confirm(`Delete server "${name}"?`)) return
    try {
      await axios.delete(`${BASE_URL}/api/Provisioning/Server/${id}`, { headers: authHeaders() })
      getServers()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const renderReadiness = (s) => {
    if (s.ready === true) return <span className="text-success">✓ Ready</span>
    const label = s.ready === false ? '✗ Not ready' : '• Unknown'
    const cls = s.ready === false ? 'text-danger' : 'text-muted'
    const badge = <span className={cls}>{label}</span>
    if (!s.issues) return badge
    return (
      <CPopover content={s.issues} placement="top" trigger="click">
        <span role="button" style={{ cursor: 'pointer' }}>
          {badge}{' '}
          <span className="material-icons" style={{ fontSize: '13px' }}>
            info
          </span>
        </span>
      </CPopover>
    )
  }

  const renderCheck = (ok, label) => (
    <div key={label}>
      <span className={ok ? 'text-success' : 'text-danger'}>{ok ? '✓' : '✗'}</span> {label}
    </div>
  )

  return (
    <>
      <hr className="my-2" />
      <div className="d-flex justify-content-between align-items-center">
        <h6 className="m-0">Servers</h6>
        <div>
          <button
            className="btn btn-sm reverse-btn rounded-0 me-1"
            onClick={() => setGuideOpen((v) => !v)}
          >
            {guideOpen ? 'Hide setup guide' : 'Setup guide'}
          </button>
          <button className="btn btn-sm filter-btn rounded-0 me-1" onClick={getServers}>
            Refresh
          </button>
          <button className="btn btn-sm add-btn rounded-0" onClick={openAdd}>
            Add Server
          </button>
        </div>
      </div>
      <hr className="my-2" />

      <div className="text-muted mb-2" style={{ fontSize: '11px' }}>
        Each server exposes a provisioning API endpoint that the master calls to create client
        databases on it. The master holds the clean template database (CleanDB) and ships it to the
        target server when a client is created there.
      </div>

      <div className="mb-3 callout-note">
        <b>Health note:</b> “Ready” checks each server’s app endpoint and database. If a server
        shows not ready, confirm its app is running and reachable at its Server App URL, and that
        its SQL login is valid. Use Test to see the individual checks.
      </div>

      {guideOpen && (
        <div
          className="card rounded-0 mb-3"
          style={{ borderLeft: '4px solid #F58B40', fontSize: '12.5px' }}
        >
          <div className="card-body">
            <h6 className="fw-bold mb-2">How the multi-server setup works</h6>
            <p className="mb-2">
              One server is the master: it hosts the frontend, holds licensing (CorebaseClients) and
              the clean template database (CleanDB). Every server runs the same app and exposes a
              provisioning API endpoint. To create a client on a given server, the master backs up
              its CleanDB, ships it to that server’s endpoint, and the server restores it locally as
              the new client database and creates the users — on its own SQL instance.
            </p>

            <h6 className="fw-bold mt-3 mb-1">What each server needs</h6>
            <ul className="mb-2" style={{ paddingLeft: '18px' }}>
              <li>The app running and reachable by the master at its Server App URL (HTTPS).</li>
              <li>Its own local SQL instance and connection settings (in its own config).</li>
              <li>The shared provisioning key (same value on every server).</li>
              <li>A writable backup path where the shipped CleanDB is received and restored.</li>
              <li>The master additionally holds the CleanDB template.</li>
            </ul>

            <h6 className="fw-bold mt-3 mb-1">Security</h6>
            <p className="mb-2 text-muted">
              Each server’s endpoint must be reachable by the master. Lock the endpoints down with
              the shared key + TLS and restrict access (e.g. firewall / IP allow-list) to the master
              only.
            </p>

            <h6 className="fw-bold mt-3 mb-1">Adding a server here</h6>
            <p className="mb-0">
              Click Add Server and fill: friendly name (must match that server’s configured name),
              SQL instance, Server App URL, backup path, and the product URLs. Mark exactly one
              server as master and give it the CleanDB template. Values are encrypted at rest on
              save.
            </p>
          </div>
        </div>
      )}

      {error && (
        <div className="alert alert-danger rounded-0 p-2" role="alert">
          {error}
        </div>
      )}

      <div className="card rounded-0">
        <div className="card-body p-0">
          <table className="table table-sm table-hover m-0" style={{ fontSize: '10px' }}>
            <thead className="table-light">
              <tr>
                <th style={{ width: '1%' }}>#</th>
                <th>Server Name</th>
                <th>Database Server</th>
                <th>Server App URL</th>
                <th>Clean Template DB</th>
                <th className="text-center">Readiness</th>
                <th className="text-center">Master</th>
                <th className="text-center">Active</th>
                <th className="text-end">Actions</th>
              </tr>
            </thead>
            <tbody>
              {servers.map((s, idx) => (
                <tr key={s.id}>
                  <td>{idx + 1}</td>
                  <td className="fw-bold">{s.serverName}</td>
                  <td>{s.sqlInstance}</td>
                  <td>{s.provisioningApiUrl || <span className="text-muted">(local)</span>}</td>
                  <td>{s.templateDb || <span className="text-muted">—</span>}</td>
                  <td className="text-center">{renderReadiness(s)}</td>
                  <td className="text-center">{s.isMaster ? 'Yes' : ''}</td>
                  <td className="text-center">
                    <div className={s.isActive ? 'Active-r' : 'not-active-r'}></div>
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm filter-btn rounded-0 me-1"
                      onClick={() => runTest(s.serverName)}
                    >
                      Test
                    </button>
                    <button
                      className="btn btn-sm update-btn rounded-0 me-1"
                      onClick={() => openEdit(s)}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm delete-btn rounded-0"
                      onClick={() => deleteServer(s.id, s.serverName)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {servers.length === 0 && !isLoading && (
                <tr>
                  <td colSpan={9} className="text-center text-muted p-3">
                    No servers
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit server modal */}
      <CModal visible={modalOpen} alignment="center" backdrop="static" size="lg">
        <CModalHeader>
          <CModalTitle>{editingId ? 'Edit Server' : 'Add Server'}</CModalTitle>
        </CModalHeader>
        <form autoComplete="off" onSubmit={saveServer}>
          <CModalBody>
            <div className="row g-2">
              {[
                ['serverName', 'Server Name *'],
                ['sqlInstance', 'Database Server (SQL instance) *'],
                ['provisioningApiUrl', 'Server App URL (endpoint the master calls)'],
                ['templateDb', 'Clean Template Database (master only, e.g. CleanDB)'],
                ['backupPath', 'Backup File Location (.bak) *'],
                ['dataPath', 'Database Data Files Folder (optional)'],
                ['logPath', 'Database Log Files Folder (optional)'],
                ['baseUrl', 'Product Base URL'],
                ['userUrl', 'Product User URL'],
                ['reportUrl', 'Product Report URL'],
                ['reportServer', 'Report Server'],
              ].map(([key, label]) => (
                <div className="col-md-6" key={key}>
                  <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                    {label}
                    {renderHelp(key)}
                  </label>
                  <input
                    className="form-control form-control-sm rounded-0"
                    value={form[key]}
                    onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                    required={['serverName', 'sqlInstance', 'backupPath'].includes(key)}
                  />
                </div>
              ))}
              <div className="col-md-6 d-flex align-items-center mt-3">
                <input
                  type="checkbox"
                  className="form-check-input me-2"
                  checked={form.isMaster}
                  onChange={(e) => setForm({ ...form, isMaster: e.target.checked })}
                />
                <label className="form-check-label" style={{ fontSize: '12px' }}>
                  This is the master server
                  {renderHelp('isMaster')}
                </label>
              </div>
              <div className="col-md-6 d-flex align-items-center mt-3">
                <input
                  type="checkbox"
                  className="form-check-input me-2"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                />
                <label className="form-check-label" style={{ fontSize: '12px' }}>
                  Active (offer this server when creating clients)
                </label>
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <button type="submit" className="btn btn-sm update-btn rounded-0" disabled={isLoading}>
              {isLoading ? 'Saving...' : 'Save & Verify'}
            </button>
            <button
              type="button"
              className="btn btn-sm reverse-btn rounded-0"
              onClick={() => setModalOpen(false)}
            >
              Cancel
            </button>
          </CModalFooter>
        </form>
      </CModal>

      {/* Test result modal */}
      <CModal visible={testOpen} alignment="center" backdrop="static">
        <CModalHeader>
          <CModalTitle>Server Check: {testName}</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {!testResult && (
            <div className="text-center p-3">
              <span className="spinner-border spinner-border-sm" /> Checking...
            </div>
          )}
          {testResult?.error && <div className="alert alert-danger p-2">{testResult.error}</div>}
          {testResult && !testResult.error && (
            <>
              <div className={`alert p-2 ${testResult.ok ? 'alert-success' : 'alert-warning'}`}>
                {testResult.ok ? 'Server is ready for provisioning' : 'Server is NOT fully ready'}
              </div>
              {renderCheck(testResult.canConnect, 'Can connect to the database server')}
              {renderCheck(testResult.canCreateDb, 'Login can create databases')}
              {renderCheck(testResult.sourceReady, testResult.sourceLabel || 'Clean source ready')}
              {renderCheck(testResult.phamacoreWebPresent, 'PhamacoreWeb database present')}
              {renderCheck(
                (testResult.missingTables?.length ?? 0) === 0,
                (testResult.missingTables?.length ?? 0) === 0
                  ? 'Required tables present (CompanyDetails, Users, SYSNEXTNUMBERS)'
                  : `Missing tables: ${testResult.missingTables.join(', ')}`,
              )}
              {testResult.message && (
                <div className="text-muted mt-2" style={{ fontSize: '11px' }}>
                  {testResult.message}
                </div>
              )}
            </>
          )}
        </CModalBody>
        <CModalFooter>
          <button className="btn btn-sm reverse-btn rounded-0" onClick={() => setTestOpen(false)}>
            Close
          </button>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default Servers
