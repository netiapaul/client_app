import React, { useState, useEffect } from 'react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions, themedRowStyle } from '../../utils/helpers'
import Moment from 'react-moment'
import { useNavigate } from 'react-router-dom'
import Drawer from '@mui/material/Drawer'
import DatePicker from 'react-datepicker'
import moment from 'moment'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'
import SearchableSelect from '../../components/SearchableSelect'

const axios = require('axios')

const emptyBranch = {
  branchNo: '',
  name: '',
  email: '',
  phone: '',
  serial: '',
  activeDate: new Date(),
  expiryDate: new Date(),
  userCount: 1,
  enabled: true,
  acct: true,
  showallcustomer: true,
  showallcustomertrans: true,
  regionId: '',
  countyId: '',
  townId: '',
}

const Dashboard = () => {
  //  "material-table": "^2.0.3",
  // const [title, setTitle] = useState('')
  const today = new Date()
  const futureDate = new Date(today)
  let tableRef = React.createRef()
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({
    // start far in the past so expired/converted clients still appear by default
    startDate: new Date(new Date().setFullYear(today.getFullYear() - 10)),
    endDate: new Date(futureDate.setDate(today.getDate() + 3650)),
    forcloundch: '',
    expirystatus: 0,
  })
  const [isDrawerOpened, setIsDrawerOpened] = useState(false)
  const [selectedRow, setSelectedRow] = useState({})
  const [summary, setSummary] = useState([])
  const [branches, setBranches] = useState([])
  // Server-attachment (for existing/legacy clients)
  const [clientLink, setClientLink] = useState(null) // { linked, serverName, dbName }
  const [attachOpen, setAttachOpen] = useState(false)
  const [attachServers, setAttachServers] = useState([])
  const [attachServerName, setAttachServerName] = useState('')
  const [attachResult, setAttachResult] = useState(null) // { exists, dbName, companyExists }
  const [attachBusy, setAttachBusy] = useState(false)
  const [attachMsg, setAttachMsg] = useState('')
  const [branchOpen, setBranchOpen] = useState(false)
  const [branchSaving, setBranchSaving] = useState(false)
  const [branchStatus, setBranchStatus] = useState('')
  const branchAbortRef = React.useRef(null)
  const [branchForm, setBranchForm] = useState(emptyBranch)
  const [modules, setModules] = useState([])
  const [selectedModules, setSelectedModules] = useState([])
  const [regionOpts, setRegionOpts] = useState([])
  const [countyOpts, setCountyOpts] = useState([])
  const [townOpts, setTownOpts] = useState([])
  const navigate = useNavigate()
  const [data, setData] = useState([])
  // Placement audit: map of cuscode -> issue (null until the check has been run).
  const [placementIssues, setPlacementIssues] = useState(null)
  const [verifying, setVerifying] = useState(false)

  const authHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  const readErr = (e) =>
    e?.response?.data?.message || e?.request?.response || `${e?.code}: ${e?.message}`

  async function getClients() {
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        {
          params: {
            startDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.startDate)),
            endDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.endDate)),
            forcloundch: filter?.forcloundch,
            expirystatus: filter?.expirystatus,
          },
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setData(response.data)
      setIsDrawerOpened(false)
    } catch (error) {
      setError(`${error?.code}: ${error?.message}`)
      setIsDrawerOpened(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFilter((prevState) => {
      return {
        ...prevState,
        [name]: value,
      }
    })
  }

  const handleSelectedQueries = () => {
    getClients()
  }

  // On-demand placement audit: ask the API to confirm every client's database is still on its
  // expected server. Flags any that drifted (e.g. an admin moved a DB outside the portal).
  const verifyPlacements = async () => {
    setVerifying(true)
    setError('')
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/VerifyPlacements`,
        { headers: authHeaders() },
      )
      const map = {}
      ;(r.data?.issues ?? []).forEach((i) => {
        map[i.cusCode] = i
      })
      setPlacementIssues(map)
      // Augment the listing rows (new array ref) so the table re-renders with the warning flags.
      setData((prev) => prev.map((row) => ({ ...row, _placement: map[row.psCusCode] || null })))
    } catch (e) {
      setError(readErr(e))
    } finally {
      setVerifying(false)
    }
  }

  // Fix a drifted client by re-attaching it to the server where its database was found.
  const reattachPlacement = async (cusCode, serverName) => {
    setError('')
    try {
      await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/AttachClient`,
        { cusCode, serverName, dbName: '' },
        { headers: authHeaders() },
      )
      await getClients()
      await verifyPlacements()
    } catch (e) {
      setError(readErr(e))
    }
  }

  const handleRowClick = (e, rowData) => {
    setSelectedRow({ ...rowData })
    setSummary(data.filter((cus) => cus.psCusCode === rowData?.psCusCode))
    getBranches(rowData?.psCusCode)
    loadClientLink(rowData?.psCusCode)
  }

  // Whether this client is already linked to a server (so Add Branch can route it).
  const loadClientLink = async (cuscode) => {
    setClientLink(null)
    if (!cuscode) return
    try {
      const r = await axios.get(
        `${
          process.env.REACT_APP_URL_CONFIG
        }/api/Provisioning/ClientServer?cuscode=${encodeURIComponent(cuscode)}`,
        { headers: authHeaders() },
      )
      setClientLink(r.data)
    } catch (e) {}
  }

  // Open the "Attach to Server" modal for the selected client.
  const openAttach = async () => {
    setAttachServerName('')
    setAttachResult(null)
    setAttachMsg('')
    setError('')
    setAttachOpen(true)
    try {
      const r = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/Servers`, {
        headers: authHeaders(),
      })
      setAttachServers(r.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }

  // Verify the client's DB exists on the chosen server (derived name, or the typed override).
  const verifyAttach = async () => {
    if (!attachServerName) {
      setError('Select a server first.')
      return
    }
    setAttachBusy(true)
    setError('')
    setAttachMsg('')
    try {
      const r = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/CheckClientDb`,
        {
          cusCode: selectedRow?.psCusCode,
          serverName: attachServerName,
          dbName: '', // always the derived P{code}DB — manual DB-name entry is not allowed
        },
        { headers: authHeaders() },
      )
      setAttachResult(r.data)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAttachBusy(false)
    }
  }

  const doAttach = async () => {
    setAttachBusy(true)
    setError('')
    try {
      const r = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/AttachClient`,
        {
          cusCode: selectedRow?.psCusCode,
          serverName: attachServerName,
          dbName: '', // derived P{code}DB only
        },
        { headers: authHeaders() },
      )
      setAttachMsg(`Attached to ${r.data?.serverName} (${r.data?.dbName}).`)
      await loadClientLink(selectedRow?.psCusCode)
      // refresh the client list so the Server column updates
      getClients()
      setTimeout(() => {
        setAttachOpen(false)
        setAttachMsg('')
      }, 1200)
    } catch (e) {
      setError(readErr(e))
    } finally {
      setAttachBusy(false)
    }
  }

  // The listing shows one row per client (main branch); load its branches on click.
  const getBranches = async (cuscode) => {
    if (!cuscode) return
    setBranches([])
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClientBranches`,
        {
          params: { cuscode },
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setBranches(response.data ?? [])
    } catch (error) {}
  }

  // Open the "Add Branch" modal for the selected client, pre-filling sensible defaults.
  const openAddBranch = async () => {
    // Suggest the lowest UNUSED branch code (fill gaps) rather than max+1, so codes stay compact and
    // don't climb toward the numbering-scheme ceiling (214). The field is still editable; the server
    // validates uniqueness + range.
    const used = new Set(
      branches
        .map((b) => Number(b.branchCode || b.psPickBcode || 0))
        .filter((n) => !isNaN(n) && n > 0),
    )
    let nextNo = 1
    while (used.has(nextNo)) nextNo++
    const expiry = selectedRow?.psActivateExpiryDate
      ? new Date(selectedRow.psActivateExpiryDate)
      : new Date(new Date().setFullYear(new Date().getFullYear() + 1))
    setBranchForm({
      ...emptyBranch,
      branchNo: String(nextNo),
      expiryDate: expiry,
      activeDate: new Date(),
    })
    setError('')
    setBranchOpen(true)
    setCountyOpts([])
    setTownOpts([])
    // fetch an available serial + the cloud modules (pre-select all) + regions + the client's company contact
    try {
      const [s, m, reg, contact] = await Promise.all([
        axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`, {
          headers: authHeaders(),
        }),
        axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/CloudModules`, {
          headers: authHeaders(),
        }),
        axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Locations/Regions`, {
          headers: authHeaders(),
        }),
        axios
          .get(
            `${
              process.env.REACT_APP_URL_CONFIG
            }/api/Clients/ClientContact?cuscode=${encodeURIComponent(
              selectedRow?.psCusCode ?? '',
            )}`,
            { headers: authHeaders() },
          )
          .catch(() => ({ data: {} })),
      ])
      // Pre-fill the branch email/phone from the client's company contact (editable).
      setBranchForm((prev) => ({
        ...prev,
        serial: s.data?.serialId ?? '',
        email: contact.data?.companyEmail ?? '',
        phone: contact.data?.companyPhone ?? '',
      }))
      const mods = m.data ?? []
      setModules(mods)
      setSelectedModules(mods.map((x) => x.moduleCode))
      setRegionOpts(reg.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }

  // Cascading region -> county -> town for the branch form.
  const onRegionChange = async (regionId) => {
    setBranchForm((prev) => ({ ...prev, regionId, countyId: '', townId: '' }))
    setCountyOpts([])
    setTownOpts([])
    if (!regionId) return
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Counties?regionId=${regionId}`,
        { headers: authHeaders() },
      )
      setCountyOpts(r.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }
  const onCountyChange = async (countyId) => {
    setBranchForm((prev) => ({ ...prev, countyId, townId: '' }))
    setTownOpts([])
    if (!countyId) return
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Towns?countyId=${countyId}`,
        { headers: authHeaders() },
      )
      setTownOpts(r.data ?? [])
    } catch (e) {
      setError(readErr(e))
    }
  }

  const toggleModule = (code) => {
    setSelectedModules((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code],
    )
  }

  // Field-level validation for the Add Branch form. Returns an object keyed by field;
  // empty object means the form is valid. Used both to show inline errors live and to
  // guard the submit.
  const validateBranch = (f, mods) => {
    const errs = {}
    const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!String(f.branchNo).trim() || Number(f.branchNo) < 1)
      errs.branchNo = 'Branch code must be 1 or greater'
    if (!String(f.name).trim()) errs.name = 'Branch name is required'
    if (!String(f.phone).trim()) errs.phone = 'Phone is required'
    if (f.email && !emailRe.test(f.email)) errs.email = 'Enter a valid email address'
    if (!String(f.serial).trim()) errs.serial = 'Serial number is required'
    if (!f.userCount || Number(f.userCount) < 1) errs.userCount = 'User CALs must be 1 or greater'
    if (!f.activeDate) errs.activeDate = 'Active date is required'
    if (!f.expiryDate) errs.expiryDate = 'Expiry date is required'
    if (
      f.activeDate &&
      f.expiryDate &&
      moment(f.expiryDate).startOf('day').isBefore(moment(f.activeDate).startOf('day'))
    )
      errs.expiryDate = 'Expiry date cannot be earlier than the active date'
    if (!mods || mods.length === 0) errs.modules = 'Select at least one cloud module'
    return errs
  }

  const submitBranch = async (e) => {
    e.preventDefault()
    const errs = validateBranch(branchForm, selectedModules)
    if (Object.keys(errs).length > 0) {
      setError('Please fix the highlighted fields before saving.')
      return
    }
    setBranchSaving(true)
    setError('')
    setBranchStatus('')
    // Fresh abort controller so the Cancel button can abort the request mid-flight.
    const controller = new AbortController()
    branchAbortRef.current = controller
    try {
      const res = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/CreateBranch?cuscode=${encodeURIComponent(
          selectedRow.psCusCode,
        )}`,
        {
          bcode: Number(branchForm.branchNo),
          branchcode: `BR00${branchForm.branchNo}`,
          branchName: branchForm.name,
          enabled: branchForm.enabled,
          mainbranch: false,
          acct: branchForm.acct,
          showallcustomer: branchForm.showallcustomer,
          showallcustomertrans: branchForm.showallcustomertrans,
          phoneNumber: branchForm.phone,
          email: branchForm.email,
          borderpartwhole: 'W',
          lockpartwholeborder: true,
          lockpartwholebtrans: true,
          btranspartwhole: 'W',
          activeDate: moment(branchForm.activeDate).format('DD/MM/YYYY'),
          expiryDate: moment(branchForm.expiryDate).format('DD/MM/YYYY'),
          userCount: Number(branchForm.userCount),
          psSerialNo: branchForm.serial,
          townId: branchForm.townId ? Number(branchForm.townId) : null,
          cloudModules: selectedModules.map((c) => Number(c)),
        },
        { headers: authHeaders(), signal: controller.signal },
      )

      // Gated by approval: the branch wasn't added — it's awaiting an approver. Stop here.
      if (res.data?.pendingApproval) {
        setBranchStatus('')
        setBranchOpen(false)
        toast.info(res.data.message || 'Submitted for approval — approvers have been notified.', {
          position: toast.POSITION.BOTTOM_LEFT,
          theme: 'colored',
          autoClose: 8000,
        })
        return
      }

      // Local client completes synchronously (200). A remote client is queued (202) and runs on
      // that server's worker — poll the job until it finishes before closing/refreshing.
      if (res.status === 202 && res.data?.jobId) {
        setBranchStatus(`Queued on ${res.data.server || 'the target server'} — provisioning…`)
        const final = await pollJobStatus(res.data.jobId)
        if (final?.status === 'Failed') {
          setBranchStatus('')
          setError(final.errorMessage || 'Add branch failed on the target server.')
          setBranchSaving(false)
          return
        }
      }

      setBranchStatus('')
      setBranchOpen(false)
      getBranches(selectedRow.psCusCode)
    } catch (err) {
      setBranchStatus('')
      if (err.code === 'ERR_CANCELED' || err.name === 'CanceledError' || axios.isCancel?.(err)) {
        setError('Add branch was cancelled. Any partial changes were rolled back.')
      } else {
        setError(readErr(err))
      }
    } finally {
      branchAbortRef.current = null
      setBranchSaving(false)
    }
  }

  // Cancel button in the Add Branch modal: aborts the request; the server's transaction rolls back.
  const cancelBranch = () => {
    if (branchAbortRef.current) {
      setBranchStatus('Cancelling…')
      branchAbortRef.current.abort()
    }
  }

  // Poll a queued job (remote add-branch) until it reaches a terminal state.
  const pollJobStatus = async (jobId) => {
    const started = Date.now()
    const timeoutMs = 20 * 60 * 1000
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/Job/${jobId}`,
          { headers: authHeaders() },
        )
        if (res.data?.status === 'Completed' || res.data?.status === 'Failed') return res.data
      } catch (e) {
        // keep polling through transient errors
      }
      if (Date.now() - started > timeoutMs) {
        return { status: 'Failed', errorMessage: 'Timed out waiting for the server to finish.' }
      }
    }
  }

  useEffect(() => {
    getClients()
  }, [])

  // Live validation state for the Add Branch form (recomputed each render).
  const branchErrors = validateBranch(branchForm, selectedModules)
  const branchInvalid = Object.keys(branchErrors).length > 0
  const fieldErr = (msg) =>
    msg ? (
      <div className="text-danger" style={{ fontSize: '10px' }}>
        {msg}
      </div>
    ) : null

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">
              Customer Clients:{' '}
              {filter.forcloundch === ''
                ? 'All Clients'
                : filter.forcloundch === 'true'
                ? 'Cloud Clients'
                : 'Desktop Clients'}
            </h6>
          </div>
          <div className="d-flex flex-row">
            <React.Fragment>
              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm filter-btn rounded-0"
                onClick={() => setIsDrawerOpened(true)}
              >
                Filters
              </button>
              <Drawer
                anchor={'right'}
                open={isDrawerOpened}
                PaperProps={{ style: { width: '30rem' } }}
              >
                <h6 className="offcanvas-title my-2 px-2" id="filtersLabel">
                  Filter Options
                </h6>
                <hr className="my-1" />
                <div className="container">
                  <div className="row my-2">
                    <label className="col-form-label col-3 divider">Date</label>
                    <div className="col">
                      <div className="row">
                        <div className="col-md-6 ">
                          <div className="row">
                            <label
                              htmlFor="startDate"
                              className="form-label col-3 align-self-center mb-0"
                            >
                              From:
                            </label>
                            <div className="col">
                              <DatePicker
                                selected={filter?.startDate}
                                placeholderText="DD/MM/YYYY"
                                className="form-control form-control-sm rounded-0"
                                id="startDate"
                                name="startDate"
                                dateFormat="dd/MM/yyyy"
                                onChange={(date) => {
                                  setFilter({ ...filter, startDate: date })
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="row">
                            <label
                              htmlFor="endDate"
                              className="form-label col-3 align-self-center mb-0"
                            >
                              To:
                            </label>
                            <div className="col">
                              <DatePicker
                                selected={filter?.endDate}
                                placeholderText="DD/MM/YYYY"
                                className="form-control form-control-sm rounded-0"
                                id="endDate"
                                name="endDate"
                                dateFormat="dd/MM/yyyy"
                                onChange={(date) => {
                                  setFilter({ ...filter, endDate: date })
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row my-2">
                    <label htmlFor="forcloundch" className="col-md-3 col-form-label divider">
                      Client Type
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        aria-label="Default select example"
                        id="forcloundch"
                        name="forcloundch"
                        value={filter?.forcloundch}
                        onChange={handleChange}
                        // onChange={this.function.handleChange}
                      >
                        <option value={''}>Both</option>
                        <option value={'true'}>Cloud</option>
                        <option value={'false'}>Desktop</option>
                      </select>
                    </div>
                  </div>
                  <div className="row my-2">
                    <label htmlFor="expirystatus" className="col-md-3 col-form-label divider">
                      Expiry Status
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        aria-label="Default select example"
                        id="expirystatus"
                        name="expirystatus"
                        value={filter?.expirystatus}
                        onChange={handleChange}
                        // onChange={this.function.handleChange}
                      >
                        <option value={'0'}>All</option>
                        <option value={'1'}>Expired</option>
                        <option value={'2'}>Active</option>
                      </select>
                    </div>
                  </div>
                  <hr />
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      className="btn add-btn top-btn rounded-0"
                      onClick={handleSelectedQueries}
                    >
                      Select
                    </button>
                    <button
                      className="btn delete-btn top-btn rounded-0"
                      onClick={() => setIsDrawerOpened(false)}
                    >
                      close
                    </button>
                  </div>
                </div>
              </Drawer>
            </React.Fragment>
            {/* <span className="d-flex flex-row gap-3">
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="desktop"
                  value={title}
                  checked={title === 'false'}
                  onChange={() => setTitle('false')}
                />
                <label className="form-check-label fw-semibold" htmlFor="desktop">
                  Desktop
                </label>
              </span>
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="cloud"
                  value={title}
                  checked={title === 'true'}
                  // onChange={() => console.log('true')}
                  onChange={() => setTitle('true')}
                />
                <label className="form-check-label fw-semibold" htmlFor="cloud">
                  Cloud
                </label>
              </span>
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="both"
                  value={title}
                  checked={title === ''}
                  onChange={() => setTitle('')}
                />
                <label className="form-check-label fw-semibold" htmlFor="both">
                  Both
                </label>
              </span>
            </span> */}
            {/* <button
              className="btn btn-sm filter-btn dropdown-toggle rounded-0"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Client Type
            </button>
            <ul className="dropdown-menu">
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('')}
                style={{ fontSize: '12px' }}
              >
                Both
              </li>
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('true')}
                style={{ fontSize: '12px' }}
              >
                Cloud
              </li>
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('false')}
                style={{ fontSize: '12px' }}
              >
                Desktop
              </li>
            </ul> */}
            {hasModule(MODULES.CreateClient) && (
              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm add-btn ms-3 rounded-0"
                onClick={() => navigate('/client/create-client')}
              >
                Create
              </button>
            )}
          </div>
        </div>
      </div>
      <hr className="my-2" />
      {error && (
        <div
          className="alert alert-danger d-flex align-items-center mx-0 mb-2 rounded-0"
          role="alert"
        >
          <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}
      {/* Split view: clients on the left, the selected client's branches on the right */}
      <div className="row g-2">
        <div className="col-md-7">
          <div className="card rounded-0">
            <div className="card-header py-1 d-flex justify-content-between align-items-center">
              <span style={{ fontSize: 12 }}>
                <span className="fw-bold">Clients</span>
                {selectedRow?.psCusCode &&
                  (clientLink == null ? (
                    <span className="ms-2 text-muted">· checking link…</span>
                  ) : clientLink.linked ? (
                    <span className="ms-2 text-muted">
                      · Hosted on:{' '}
                      <span className="fw-bold text-body">{clientLink.serverName}</span> (
                      {clientLink.dbName})
                    </span>
                  ) : (
                    <span className="ms-2 text-danger">· Not linked to a server</span>
                  ))}
              </span>
              <div className="d-flex gap-1">
                <button
                  type="button"
                  className="btn btn-sm filter-btn rounded-0"
                  onClick={verifyPlacements}
                  disabled={verifying}
                  title="Check that every client's database is still on its expected server"
                >
                  {verifying ? 'Verifying…' : 'Verify placements'}
                </button>
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  onClick={openAttach}
                  disabled={!selectedRow?.psCusCode}
                  title={
                    selectedRow?.psCusCode
                      ? 'Attach the selected client to a server'
                      : 'Select a client first'
                  }
                >
                  {clientLink?.linked ? 'Re-attach to Server' : 'Attach to Server'}
                </button>
              </div>
            </div>
            {placementIssues &&
              (Object.keys(placementIssues).length === 0 ? (
                <div className="alert alert-success rounded-0 m-2 p-2" style={{ fontSize: 11 }}>
                  ✓ All client databases are on their expected servers.
                </div>
              ) : (
                <div className="alert alert-warning rounded-0 m-2 p-2" style={{ fontSize: 11 }}>
                  <div className="fw-bold mb-1">
                    {Object.keys(placementIssues).length} client(s) with database placement issues:
                  </div>
                  {Object.values(placementIssues).map((i) => (
                    <div
                      key={i.cusCode}
                      className="d-flex align-items-center justify-content-between border-top py-1"
                    >
                      <span>
                        ⚠ <b>{i.company || i.cusCode}</b> ({i.cusCode}) — {i.message}
                      </span>
                      {i.status === 'moved' && i.foundOn && (
                        <button
                          type="button"
                          className="btn btn-sm update-btn rounded-0 ms-2"
                          style={{ whiteSpace: 'nowrap' }}
                          onClick={() => reattachPlacement(i.cusCode, i.foundOn)}
                        >
                          Re-attach to {i.foundOn}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              ))}
            <div className="card-body p-0">
              <MaterialTable
                columns={[
                  {
                    title: '#',
                    field: 'counter',
                    render: (rowData) => rowData.tableData.id + 1,
                    sorting: false,
                    cellStyle: { width: '1%', textAlign: 'center' },
                  },
                  { title: 'Acct', field: 'psCusCode' },
                  { title: 'AcctName', field: 'psCompanyName', cellStyle: { minWidth: 150 } },
                  {
                    title: 'Server',
                    field: 'connectedServer',
                    render: (rowData) =>
                      rowData._placement ? (
                        <span className="text-danger fw-bold" title={rowData._placement.message}>
                          ⚠ {rowData.connectedServer || rowData._placement.expectedServer}
                        </span>
                      ) : rowData.connectedServer ? (
                        rowData.connectedServer
                      ) : (
                        <span className="text-muted">—</span>
                      ),
                  },
                  { title: 'Package', field: 'packageName' },
                  {
                    title: 'Branches',
                    field: 'branchesCount',
                    type: 'numeric',
                    cellStyle: { width: '1%', textAlign: 'center' },
                    headerStyle: { textAlign: 'center' },
                  },
                  {
                    title: 'Users',
                    field: 'companyUsers',
                    type: 'numeric',
                    cellStyle: { width: '1%', textAlign: 'center' },
                    headerStyle: { textAlign: 'center' },
                  },
                  {
                    title: 'Cloud',
                    field: 'forCloud',
                    render: (rowData) => (
                      <input type="checkbox" checked={rowData.forCloud} disabled />
                    ),
                    cellStyle: { width: '1%', textAlign: 'center' },
                  },
                ]}
                tableRef={tableRef}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: data.length <= 30 ? false : true,
                  sorting: true,
                  padding: 'dense',
                  rowStyle: (rowData) => ({
                    ...themedRowStyle(selectedRow?.psCusCode === rowData.psCusCode),
                    fontWeight: selectedRow?.psCusCode === rowData.psCusCode ? '600' : '400',
                  }),
                }}
                onRowClick={(e, selectedRow) => handleRowClick(e, selectedRow)}
                data={data}
                title=""
              />
            </div>
          </div>
        </div>

        <div className="col-md-5">
          <div className="card rounded-0" style={{ minHeight: 300 }}>
            <div className="card-body">
              {!selectedRow?.psCusCode ? (
                <div className="text-muted text-center py-5" style={{ fontSize: 13 }}>
                  Select a client on the left to view its branches.
                </div>
              ) : (
                <>
                  <div className="d-flex justify-content-between align-items-center mb-2">
                    <div className="fw-bold" style={{ fontSize: 13 }}>
                      {selectedRow?.psCompanyName ?? selectedRow?.psCusCode} (
                      {selectedRow?.psCusCode})
                    </div>
                    <div className="d-flex gap-2">
                      {hasModule(MODULES.AddBranch) && (
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0"
                          onClick={openAddBranch}
                        >
                          Add Branch
                        </button>
                      )}
                    </div>
                  </div>
                  <MaterialTable
                    columns={[
                      {
                        title: '#',
                        field: 'counter',
                        sorting: false,
                        render: (rowData) => rowData.tableData.id + 1,
                        cellStyle: { width: '1%', textAlign: 'center' },
                      },
                      { title: 'Bcode', field: 'psPickBcode', cellStyle: { width: '1%' } },
                      { title: 'Branch', field: 'psBranchName', cellStyle: { minWidth: 140 } },
                      { title: 'Town', field: 'townName', cellStyle: { minWidth: 100 } },
                      {
                        title: 'Active',
                        field: 'psActivated',
                        render: (rowData) => (
                          <div
                            className={rowData.psActivated === '1' ? 'Active-r' : 'not-active-r'}
                          ></div>
                        ),
                        cellStyle: { width: '1%' },
                      },
                      {
                        title: 'Expiry',
                        field: 'psActivateExpiryDate',
                        render: (rowData) =>
                          !rowData?.psActivateExpiryDate ? (
                            ''
                          ) : (
                            <Moment format="DD/MM/YYYY">{rowData?.psActivateExpiryDate}</Moment>
                          ),
                        cellStyle: { width: '1%' },
                      },
                      {
                        title: 'Temp Expiry',
                        field: 'psTemporaryActivateExpiryDate',
                        render: (rowData) =>
                          !rowData?.psTemporaryActivateExpiryDate ? (
                            ''
                          ) : (
                            <Moment format="DD/MM/YYYY">
                              {rowData?.psTemporaryActivateExpiryDate}
                            </Moment>
                          ),
                        cellStyle: { width: '1%' },
                      },
                    ]}
                    icons={tableIcons}
                    options={{
                      ...tableOptions,
                      search: false,
                      paging: false,
                      sorting: true,
                      toolbar: false,
                      padding: 'dense',
                      maxBodyHeight: 420,
                    }}
                    onRowClick={(e, rowData) => {
                      // Opening a client is the edit screen — only for users who can update clients.
                      if (hasModule(MODULES.UpdateClient)) navigate(`/client/${rowData.id}`)
                      else toast.info('You have view-only access to clients.', { theme: 'colored' })
                    }}
                    data={branches}
                    title=""
                  />
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Attach to Server modal (for existing/legacy clients) */}
      <CModal
        visible={attachOpen}
        alignment="center"
        backdrop="static"
        size="lg"
        onClose={() => setAttachOpen(false)}
      >
        <CModalHeader>
          <CModalTitle style={{ fontSize: '14px' }}>
            Attach to Server — {selectedRow?.psCompanyName ?? selectedRow?.psCusCode} (
            {selectedRow?.psCusCode})
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <p className="text-muted" style={{ fontSize: 12 }}>
            Link this client to the server that already holds its database. We verify the database
            exists on that server before attaching, so branches route to the right place.
          </p>
          {attachMsg && (
            <div className="alert alert-success rounded-0 p-2" style={{ fontSize: 12 }}>
              {attachMsg}
            </div>
          )}
          <div className="row g-2">
            <div className="col-md-8">
              <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                Server *
              </label>
              <SearchableSelect
                options={attachServers}
                value={attachServerName}
                onChange={(v) => {
                  setAttachServerName(v)
                  setAttachResult(null)
                }}
                getId={(o) => o.serverName}
                getLabel={(o) => `${o.serverName} (${o.sqlInstance})`}
                placeholder="Search server..."
              />
            </div>
            <div className="col-md-4 d-flex align-items-end">
              <button
                type="button"
                className="btn btn-sm cancel-btn rounded-0 w-100"
                onClick={verifyAttach}
                disabled={attachBusy || !attachServerName}
              >
                {attachBusy ? 'Checking…' : 'Verify'}
              </button>
            </div>
          </div>

          <div className="mt-2" style={{ fontSize: 12 }}>
            {attachResult && !attachResult.exists && (
              <div className="alert alert-warning rounded-0 p-2 mb-0">
                <i className="fa fa-times-circle me-1" aria-hidden="true"></i>
                The database for this client was not found on <strong>{attachResult.server}</strong>
                . It may be on a different server, or not created yet — please raise a support issue
                to have it checked. (You cannot attach to a server where the database does not
                exist.)
              </div>
            )}
            {attachResult && attachResult.exists && attachResult.companyExists && (
              <div className="alert alert-success rounded-0 p-2 mb-0">
                <i className="fa fa-check-circle me-1" aria-hidden="true"></i>
                Verified on <strong>{attachResult.server}</strong> — database and company record
                found. Ready to attach.
              </div>
            )}
            {attachResult && attachResult.exists && !attachResult.companyExists && (
              <div className="alert alert-warning rounded-0 p-2 mb-0">
                <i className="fa fa-exclamation-triangle me-1" aria-hidden="true"></i>
                The database exists on <strong>{attachResult.server}</strong>, but this
                client&apos;s company record was not found there — likely the wrong server. Please
                verify or raise a support issue.
              </div>
            )}
          </div>
        </CModalBody>
        <CModalFooter>
          <button
            type="button"
            className="btn btn-sm cancel-btn rounded-0"
            onClick={() => setAttachOpen(false)}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0"
            onClick={doAttach}
            disabled={attachBusy || !attachResult?.exists || !attachResult?.companyExists}
          >
            Attach
          </button>
        </CModalFooter>
      </CModal>

      {/* Add Branch modal */}
      <CModal visible={branchOpen} alignment="center" backdrop="static" size="lg" scrollable>
        <CModalHeader>
          <CModalTitle>
            Add Branch — {selectedRow?.psCompanyName ?? selectedRow?.psCusCode}
          </CModalTitle>
        </CModalHeader>
        <form autoComplete="off" onSubmit={submitBranch}>
          <CModalBody>
            {error && <div className="alert alert-danger rounded-0 p-2">{error}</div>}
            {branchStatus && (
              <div className="alert alert-info rounded-0 p-2 d-flex align-items-center">
                <span
                  className="spinner-border spinner-border-sm me-2"
                  role="status"
                  aria-hidden="true"
                ></span>
                <span>{branchStatus}</span>
              </div>
            )}
            <div className="row g-2">
              <div className="col-md-3">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Branch Code *
                </label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.branchNo}
                  onChange={(e) => setBranchForm({ ...branchForm, branchNo: e.target.value })}
                  required
                />
                {fieldErr(branchErrors.branchNo)}
              </div>
              <div className="col-md-9">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Branch Name *
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.name}
                  onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                  required
                />
                {fieldErr(branchErrors.name)}
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Phone *
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.phone}
                  onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                  required
                />
                {fieldErr(branchErrors.phone)}
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Email
                </label>
                <input
                  type="email"
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.email}
                  onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                />
                {fieldErr(branchErrors.email)}
              </div>

              <div className="col-md-4">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Region
                </label>
                <SearchableSelect
                  options={regionOpts}
                  value={branchForm.regionId}
                  onChange={(v) => onRegionChange(v)}
                  getId={(o) => o.regionId}
                  getLabel={(o) => o.name}
                  placeholder="Search region..."
                />
              </div>
              <div className="col-md-4">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  County
                </label>
                <SearchableSelect
                  options={countyOpts}
                  value={branchForm.countyId}
                  onChange={(v) => onCountyChange(v)}
                  getId={(o) => o.countyId}
                  getLabel={(o) => o.name}
                  placeholder="Search county..."
                  disabled={!branchForm.regionId}
                />
              </div>
              <div className="col-md-4">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Town
                </label>
                <SearchableSelect
                  options={townOpts}
                  value={branchForm.townId}
                  onChange={(v) => setBranchForm({ ...branchForm, townId: v })}
                  getId={(o) => o.townId}
                  getLabel={(o) => o.name}
                  placeholder="Search town..."
                  disabled={!branchForm.countyId}
                />
              </div>

              <div className="col-md-6">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Serial No *
                </label>
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.serial}
                  onChange={(e) => setBranchForm({ ...branchForm, serial: e.target.value })}
                  required
                />
                {fieldErr(branchErrors.serial)}
              </div>
              <div className="col-md-3">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  User CALs *
                </label>
                <input
                  type="number"
                  min={1}
                  className="form-control form-control-sm rounded-0"
                  value={branchForm.userCount}
                  onChange={(e) => setBranchForm({ ...branchForm, userCount: e.target.value })}
                  required
                />
                {fieldErr(branchErrors.userCount)}
              </div>
              <div className="col-md-3"></div>
              <div className="col-md-6">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Active Date *
                </label>
                <DatePicker
                  className="form-control form-control-sm rounded-0"
                  selected={branchForm.activeDate}
                  dateFormat="dd/MM/yyyy"
                  onChange={(d) => setBranchForm({ ...branchForm, activeDate: d })}
                  required
                />
                {fieldErr(branchErrors.activeDate)}
              </div>
              <div className="col-md-6">
                <label className="form-label mb-0" style={{ fontSize: '11px' }}>
                  Expiry Date *
                </label>
                <DatePicker
                  className="form-control form-control-sm rounded-0"
                  selected={branchForm.expiryDate}
                  dateFormat="dd/MM/yyyy"
                  minDate={branchForm.activeDate}
                  onChange={(d) => setBranchForm({ ...branchForm, expiryDate: d })}
                  required
                />
                {fieldErr(branchErrors.expiryDate)}
              </div>
            </div>

            <div className="d-flex flex-wrap gap-3 mt-3" style={{ fontSize: '12px' }}>
              {[
                ['enabled', 'Enabled'],
                ['acct', 'Accounts'],
                ['showallcustomer', 'Show all customers'],
                ['showallcustomertrans', 'Show all customer transactions'],
              ].map(([key, label]) => (
                <div className="form-check" key={key}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`br_${key}`}
                    checked={branchForm[key]}
                    onChange={(e) => setBranchForm({ ...branchForm, [key]: e.target.checked })}
                  />
                  <label className="form-check-label" htmlFor={`br_${key}`}>
                    {label}
                  </label>
                </div>
              ))}
            </div>

            <hr className="my-2" />
            <div className="d-flex justify-content-between align-items-center">
              <label className="fw-bold" style={{ fontSize: '12px' }}>
                Cloud Modules ({selectedModules.length}/{modules.length})
                {fieldErr(branchErrors.modules)}
              </label>
              <div>
                <button
                  type="button"
                  className="btn btn-sm reverse-btn rounded-0 me-1"
                  onClick={() => setSelectedModules(modules.map((m) => m.moduleCode))}
                >
                  All
                </button>
                <button
                  type="button"
                  className="btn btn-sm reverse-btn rounded-0"
                  onClick={() => setSelectedModules([])}
                >
                  None
                </button>
              </div>
            </div>
            <div style={{ maxHeight: 180, overflowY: 'auto', fontSize: '12px' }} className="mt-1">
              {modules.map((m) => (
                <div className="form-check" key={m.moduleCode}>
                  <input
                    className="form-check-input"
                    type="checkbox"
                    id={`mod_${m.moduleCode}`}
                    checked={selectedModules.includes(m.moduleCode)}
                    onChange={() => toggleModule(m.moduleCode)}
                  />
                  <label className="form-check-label" htmlFor={`mod_${m.moduleCode}`}>
                    {m.subModuleName || m.moduleName}
                  </label>
                </div>
              ))}
            </div>
          </CModalBody>
          <CModalFooter>
            <button
              type="submit"
              className="btn btn-sm update-btn rounded-0"
              disabled={branchSaving || branchInvalid}
            >
              {branchSaving ? 'Saving...' : 'Add Branch'}
            </button>
            {/* One Cancel button: aborts the in-flight add while saving, otherwise closes the modal. */}
            <button
              type="button"
              className="btn btn-sm reverse-btn rounded-0"
              onClick={() => (branchSaving ? cancelBranch() : setBranchOpen(false))}
            >
              {branchSaving ? 'Cancel Add Branch' : 'Cancel'}
            </button>
          </CModalFooter>
        </form>
      </CModal>
    </>
  )
}

export default Dashboard
