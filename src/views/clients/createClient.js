import React, { useState, useEffect, useRef } from 'react'
import { getToken } from '../../utils/session'
import { toast } from 'react-toastify'
import DatePicker from 'react-datepicker'
import { useNavigate } from 'react-router-dom'
import { CModal, CModalBody, CModalFooter, CModalHeader, CModalTitle } from '@coreui/react'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import moment from 'moment'
import './clientPicker.css'
import SearchableSelect from '../../components/SearchableSelect'

const axios = require('axios')

function CreateClient() {
  const [isLoading, setIsLoading] = useState(false)
  const [isClientModal, setIsClientModal] = useState(false)
  const [error, setError] = useState('')
  const [ErrorArray, setErrorArray] = useState([])
  const [customers, setCustomers] = useState([])
  // const [serialNo, setSerialNo] = useState([])
  const [packages, setPackages] = useState([])
  const [cloudModules, setCloudModules] = useState([])
  const [modulesSelected, setModulesSelected] = useState([])
  const [servers, setServers] = useState([])
  const [notReadyServers, setNotReadyServers] = useState([])
  const [accounts, setAccounts] = useState([])
  const [provisionResult, setProvisionResult] = useState(null)
  const [provisionStatus, setProvisionStatus] = useState('')
  // Searchable account picker (pop-over) state.
  const [acctPickerOpen, setAcctPickerOpen] = useState(false)
  const [acctSearch, setAcctSearch] = useState('')
  const acctPickerRef = useRef(null)
  const provisionAbortRef = useRef(null)
  const provisionRunIdRef = useRef(null) // id of the queued provisioning run, for Cancel
  const navigate = useNavigate()
  const [formData, setFormData] = useState({
    psCusCode: '',
    psCompanyName: '',
    branchCode: 1,
    psBranchName: '',
    psSerialNo: '',
    psActivated: false,
    psBedCount: '0',
    psGL: '0',
    psUserCount: 1,
    psBranchCount: 1,
    psStockTakeCals: 0,
    PsActivateDate: '',
    psActivateExpiryDate: '',
    days: 0,
    psStockTakeStartDate: '',
    stockTakeEndDate: '',
    psPickCpu: '',
    psPickBios: '',
    psPickHdd: '',
    psPickCompany: '',
    packageCode: '',
    psPickBcode: 1,
    // Cloud provisioning (restore DB + create company & users)
    provisionDb: true,
    serverName: '',
    adminUsername: '',
    adminFullName: '',
    adminCellnumber: '',
    adminEmail: '',
    companyEmail: '',
    companyPhone: '',
    useCompanyContact: false,
    physicalAddress: '',
    pinNo: '',
    vatNo: '',
    regionId: '',
    countyId: '',
    townId: '',
  })
  const [regionOpts, setRegionOpts] = useState([])
  const [countyOpts, setCountyOpts] = useState([])
  const [townOpts, setTownOpts] = useState([])
  // Pre-submit validation for the Create Client form. Returns an array of messages
  // (empty = valid). Surfaced in the error list and used to block submit.
  const validateClient = () => {
    const errs = []
    const f = formData
    if (!f.psCusCode) errs.push('Select an account.')
    if (!f.PsActivateDate) errs.push('Activate date is required.')
    if (!f.psActivateExpiryDate) errs.push('Expiry date is required.')
    if (
      f.PsActivateDate &&
      f.psActivateExpiryDate &&
      moment(f.psActivateExpiryDate)
        .startOf('day')
        .isBefore(moment(f.PsActivateDate).startOf('day'))
    )
      errs.push('Expiry date cannot be earlier than the activate date.')
    if (!f.psSerialNo) errs.push('Serial number is required.')
    if (!f.psUserCount || Number(f.psUserCount) < 1) errs.push('User CALs must be 1 or greater.')
    if (!f.psBranchCount || Number(f.psBranchCount) < 1)
      errs.push('Branch CALs must be 1 or greater.')
    if (f.provisionDb && !f.serverName)
      errs.push('Select a server to provision the database, or turn off cloud provisioning.')
    if (!f.packageCode) errs.push('Select a Client Module.')
    return errs
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const problems = validateClient()
    if (problems.length > 0) {
      setError('')
      setErrorArray(problems)
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    setErrorArray([])
    const data = {
      psCusCode: formData.psCusCode.trim(),
      psCompanyName: formData.psCompanyName.trim(),
      branchCode: formData.branchCode,
      psBranchName: formData.psBranchName.trim(),
      psSerialNo: formData.psSerialNo,
      psActivated: formData.psActivated,
      psBedCount: formData.psBedCount,
      psGL: formData.psGL,
      psUserCount: formData.psUserCount,
      psBranchCount: formData.psBranchCount,
      psStockTakeCals: formData.psStockTakeCals,
      PsActivateDate: moment(formData.PsActivateDate).format('DD/MM/YYYY'),
      psActivateExpiryDate: moment(formData.psActivateExpiryDate).format('DD/MM/YYYY'),
      psStockTakeStartDate: moment(formData.psStockTakeStartDate).format('DD/MM/YYYY'),
      stockTakeEndDate: moment(formData.stockTakeEndDate).format('DD/MM/YYYY'),
      psPickCpu: formData.psPickCpu,
      psPickBios: formData.psPickBios,
      psPickHdd: formData.psPickHdd,
      psPickCompany: formData.psPickCompany,
      psPickBcode: formData.psPickBcode,
      modulesSelected: modulesSelected,
      packageCode: formData.packageCode,
    }
    CreateClient(data)
  }
  // The AcctName picker selects an existing (pending) account from ClientDetails, so we don't
  // insert a new licensing row. Instead we provision the account to the cloud (restore P{code}DB
  // + company + users) and then mark it finalized (IsUpdated = 1) so it drops off the picker.
  const CreateClient = async (userData) => {
    const headers = {
      Authorization: `Bearer ${getToken()}`,
      Accept: 'application/json',
      'Content-Type': 'application/json',
    }
    setIsLoading(true)
    setError('')
    setErrorArray([])
    setProvisionResult(null)
    setProvisionStatus('')
    // Fresh abort controller so the Cancel button can abort the (long) provision request.
    const controller = new AbortController()
    provisionAbortRef.current = controller
    provisionRunIdRef.current = null
    try {
      // 1. Provision to the cloud (only if a server was chosen).
      if (formData.provisionDb && formData.serverName) {
        setProvisionStatus(`Provisioning on ${formData.serverName}…`)
        const res = await axios.post(
          `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/ProvisionClient`,
          {
            cusCode: userData.psCusCode,
            companyName: userData.psCompanyName,
            serverName: formData.serverName,
            packageCode: userData.packageCode,
            userCount: Number(userData.psUserCount),
            adminUsername: formData.adminUsername || null,
            adminFullName: formData.adminFullName || null,
            adminCellnumber:
              (formData.useCompanyContact ? formData.companyPhone : formData.adminCellnumber) ||
              null,
            adminEmail:
              (formData.useCompanyContact ? formData.companyEmail : formData.adminEmail) || null,
            companyEmail: formData.companyEmail || null,
            companyPhone: formData.companyPhone || null,
            physicalAddress: formData.physicalAddress || null,
            townName:
              townOpts.find((t) => String(t.townId) === String(formData.townId))?.name || null,
            townId: formData.townId ? Number(formData.townId) : null,
            activateDate: userData.PsActivateDate || null, // dd/MM/yyyy
            expiryDate: userData.psActivateExpiryDate || null, // dd/MM/yyyy
            pinNo: formData.pinNo || null,
            vatNo: formData.vatNo || null,
          },
          { headers, signal: controller.signal },
        )

        // Provisioning now runs in the background (202 Accepted). Poll the run until it finishes.
        let run = res.data

        // Gated by approval: the change wasn't applied — it's awaiting an approver. Stop here.
        if (run?.pendingApproval) {
          setIsLoading(false)
          setProvisionStatus('')
          toast.info(run.message || 'Submitted for approval — approvers have been notified.', {
            position: toast.POSITION.BOTTOM_LEFT,
            theme: 'colored',
            autoClose: 8000,
          })
          return
        }

        provisionRunIdRef.current = run?.id
        if (res.status === 202 || (run?.status && run.status !== 'Completed')) {
          run = await pollProvisionStatus(run.id, headers)
        }
        if (run?.status === 'Cancelled') {
          setIsLoading(false)
          setProvisionStatus('')
          setError('Provisioning was cancelled. Any partially-created database was rolled back.')
          return
        }
        if (run?.status === 'Failed') {
          setIsLoading(false)
          setProvisionStatus('')
          setError(run.errorMessage || 'Provisioning failed on the target server.')
          return // do NOT mark the account updated — it can be retried
        }
        setProvisionResult(run)
        setProvisionStatus('')
      }

      // 2. Mark the account finalized (leaves the picker) and save the town + company contact on the main branch.
      const townQs = formData.townId ? `&townId=${Number(formData.townId)}` : ''
      const contactQs =
        (formData.companyEmail
          ? `&companyEmail=${encodeURIComponent(formData.companyEmail)}`
          : '') +
        (formData.companyPhone ? `&companyPhone=${encodeURIComponent(formData.companyPhone)}` : '')
      await axios.post(
        `${
          process.env.REACT_APP_URL_CONFIG
        }/api/Clients/MarkClientUpdated?cuscode=${encodeURIComponent(
          userData.psCusCode,
        )}${townQs}${contactQs}`,
        {},
        { headers },
      )

      // Refresh the picker (the account should now be gone) and clear the selection.
      await GetAccounts()
      setFormData((prev) => ({ ...prev, psCusCode: '', psCompanyName: '' }))
      setIsLoading(false)
    } catch (error) {
      setIsLoading(false)
      setProvisionStatus('')
      // Axios aborts surface as ERR_CANCELED / CanceledError — show a friendly message.
      if (
        error.code === 'ERR_CANCELED' ||
        error.name === 'CanceledError' ||
        axios.isCancel?.(error)
      ) {
        setError('Provisioning was cancelled. Any partially-created database was rolled back.')
      } else {
        setError(
          error.response?.data?.message || error.request?.response || error.message || 'Failed',
        )
      }
    } finally {
      provisionAbortRef.current = null
      provisionRunIdRef.current = null
    }
  }

  // Called by the Cancel button while provisioning is running. Provisioning runs in the background,
  // so we signal the server to cancel the run (it drops any half-restored DB and marks it Cancelled);
  // the poll loop then sees the terminal state. Also abort the (brief) POST in case it's still in flight.
  const cancelProvision = async () => {
    setProvisionStatus('Cancelling…')
    const id = provisionRunIdRef.current
    if (id) {
      try {
        await axios.post(
          `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/CancelProvision/${id}`,
          {},
          {
            headers: {
              Authorization: `Bearer ${getToken()}`,
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
          },
        )
      } catch (e) {}
    } else if (provisionAbortRef.current) {
      provisionAbortRef.current.abort()
    }
  }

  // Poll a provisioning run until it reaches a terminal state (remote/queued provisioning).
  const pollProvisionStatus = async (id, headers) => {
    const started = Date.now()
    const timeoutMs = 20 * 60 * 1000 // 20 min ceiling for slow restores
    // eslint-disable-next-line no-constant-condition
    while (true) {
      await new Promise((r) => setTimeout(r, 3000))
      try {
        const res = await axios.get(
          `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/Status/${id}`,
          { headers },
        )
        const run = res.data
        setProvisionStatus(
          `${run.currentStep || run.status} on ${run.targetSqlInstance || 'the target server'}…`,
        )
        if (run.status === 'Completed' || run.status === 'Failed' || run.status === 'Cancelled')
          return run
      } catch (e) {
        // keep polling through transient errors
      }
      if (Date.now() - started > timeoutMs) {
        return { status: 'Failed', errorMessage: 'Timed out waiting for the server to finish.' }
      }
    }
  }
  // const handleDay = (e) => {
  //   const date = new Date()
  //   let res = new Date(formData.psActivateExpiryDate) ?? new Date()
  //   //   formData.psActivateExpiryDate === '' ||
  //   //   formData.psActivateExpiryDate === null
  //   //     ? new Date()
  //   //     : new Date(formData.psActivateExpiryDate)

  //   setFormData({
  //     ...formData,
  //     days: e.target.value,
  //     psActivateExpiryDate: e.target.value
  //       ? new Date(date.setDate(date.getDate() + Number(e.target.value)))
  //       : new Date(),
  //   })
  //   console.log(res)
  // }
  // const handleDate = (date) => {
  //   let diffDate = new Date().getTime() - date.getTime()
  //   let conv = Math.abs(diffDate)
  //   setFormData({
  //     ...formData,
  //     psActivateExpiryDate: date,
  //     days: Math.round(conv / (1000 * 60 * 60 * 24)),
  //   })
  //   console.log(conv)
  //   console.log(Math.round(conv / (1000 * 60 * 60 * 24)))
  // }
  const GetSerialNumbers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setFormData({ ...formData, psSerialNo: result?.serialId })
        setError(result.message)
        setIsLoading(false)
      } else {
        await response.json()
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    }
  }
  const GetPackages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/Packages`, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${getToken()}`,
          // Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setPackages(result)
        setIsLoading(false)
      } else {
        await response.json()
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    }
  }
  const CloudModules = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/CloudModules`, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${getToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setCloudModules(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        await response.json()
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    }
  }
  const GetServers = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Provisioning/ServersStatus`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const all = (await response.json()) ?? []
        // Only offer servers that passed the readiness check; keep the rest to warn about.
        setServers(all.filter((s) => s.ready))
        setNotReadyServers(all.filter((s) => !s.ready))
      }
    } catch (error) {}
  }
  // Load the account picker: main-branch (bcode 1) accounts not yet finalized (IsUpdated false/null).
  const GetAccounts = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetAccounts?search=`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        setAccounts((await response.json()) ?? [])
      }
    } catch (error) {}
  }

  // "yyyy/MM/dd" (or any parseable) string -> Date for the DatePickers; null if invalid.
  const parseDate = (s) => {
    if (!s) return null
    const d = new Date(s)
    return isNaN(d.getTime()) ? null : d
  }

  const authHeadersJson = () => ({
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  const GetRegions = async () => {
    try {
      const r = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Locations/Regions`, {
        headers: authHeadersJson(),
      })
      setRegionOpts(r.data ?? [])
    } catch (e) {}
  }
  const onRegionChange = async (regionId) => {
    setFormData((p) => ({ ...p, regionId, countyId: '', townId: '' }))
    setCountyOpts([])
    setTownOpts([])
    if (!regionId) return
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Counties?regionId=${regionId}`,
        { headers: authHeadersJson() },
      )
      setCountyOpts(r.data ?? [])
    } catch (e) {}
  }
  const onCountyChange = async (countyId) => {
    setFormData((p) => ({ ...p, countyId, townId: '' }))
    setTownOpts([])
    if (!countyId) return
    try {
      const r = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Towns?countyId=${countyId}`,
        { headers: authHeadersJson() },
      )
      setTownOpts(r.data ?? [])
    } catch (e) {}
  }

  // On picking an account, populate the details from that ClientDetails record. The admin can
  // edit everything afterwards except the account code and name.
  const pickAccount = (a) => {
    if (!a) return
    setFormData({
      ...formData,
      psCusCode: a.psCusCode ?? '',
      psCompanyName: a.psCompanyName ?? '',
      branchCode: a.branchCode ?? a.psPickBcode ?? formData.branchCode,
      psBranchName: a.psBranchName ?? '',
      psSerialNo: a.psSerialNo ?? formData.psSerialNo,
      psUserCount: a.psUserCount ?? formData.psUserCount,
      psBranchCount: a.psBranchCount ?? formData.psBranchCount,
      psBedCount: a.psBedCount ?? formData.psBedCount,
      psGL: a.psGL ?? formData.psGL,
      packageCode: a.packageCode ?? formData.packageCode,
      PsActivateDate: parseDate(a.psActivateDate) ?? formData.PsActivateDate,
      psActivateExpiryDate: parseDate(a.psActivateExpiryDate) ?? formData.psActivateExpiryDate,
    })
    setAcctPickerOpen(false)
    setAcctSearch('')
  }

  // Filter the account list by code, company or branch as the user types.
  const filteredAccounts = () => {
    const term = acctSearch.trim().toLowerCase()
    if (!term) return accounts
    return accounts.filter(
      (a) =>
        (a.psCusCode ?? '').toLowerCase().includes(term) ||
        (a.psCompanyName ?? '').toLowerCase().includes(term) ||
        (a.psBranchName ?? '').toLowerCase().includes(term),
    )
  }

  // Close the picker panel when clicking outside of it.
  useEffect(() => {
    const onDocClick = (e) => {
      if (acctPickerRef.current && !acctPickerRef.current.contains(e.target)) {
        setAcctPickerOpen(false)
      }
    }
    document.addEventListener('click', onDocClick)
    return () => document.removeEventListener('click', onDocClick)
  }, [])

  const onSelectionChange = (rows) => {
    setModulesSelected(rows.map((item) => item?.moduleCode))
  }

  useEffect(() => {
    GetSerialNumbers()
    CloudModules()
    GetPackages()
    GetServers()
    GetAccounts()
    GetRegions()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light  p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <div className="d-flex d-flex align-items-center">
              <h6 className="m-0">Create Client</h6>
            </div>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      {error && (
        <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
          <span> {error} </span>
        </div>
      )}
      {ErrorArray.length > 0 && (
        <div className="alert alert-danger mb-1 p-2" role="alert">
          <ul className="m-0">
            {ErrorArray.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )}
      {provisionStatus && (
        <div className="alert alert-info rounded-0 p-2 d-flex align-items-center" role="alert">
          <span
            className="spinner-border spinner-border-sm me-2"
            role="status"
            aria-hidden="true"
          ></span>
          <span>{provisionStatus}</span>
        </div>
      )}
      {provisionResult && (
        <div className="alert alert-success rounded-0 p-2" role="alert">
          <div className="fw-bold mb-1">Client created &amp; database provisioned</div>
          <div>
            Database: <b>{provisionResult.dbName}</b> &nbsp;|&nbsp; Company:{' '}
            <b>{provisionResult.companyName}</b> &nbsp;|&nbsp; Status:{' '}
            <b>{provisionResult.status}</b>
          </div>
          <button
            type="button"
            className="btn btn-sm add-btn rounded-0 mt-2"
            onClick={() => navigate('/dashboard')}
          >
            Go to Licenses
          </button>
        </div>
      )}
      <div className="row g-2">
        <div className="col-md">
          <div className="card card-body rounded-0">
            <div className="d-flex justify-content-between">
              <div className="d-flex justify-content-between">
                <p className="mb-0 fw-bold align-self-end" style={{ fontSize: '11px' }}>
                  Client Details
                </p>
              </div>

              <div className="d-flex">
                <p className="m-0 fw-bold" style={{ fontSize: '11px' }}>
                  Status:{' '}
                  <span className={formData.psActivated ? 'text-success' : 'text-danger'}>
                    {formData.psActivated ? 'Active' : 'Not Active'}
                  </span>
                </p>
              </div>
            </div>
            <hr className="mt-1 mb-0" />
            <form autoComplete="off" onSubmit={handleSubmit}>
              <div className="row my-3">
                <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                  Acct Name
                </label>
                <div className="col-md">
                  <div className="client-picker" ref={acctPickerRef}>
                    <input
                      type="text"
                      id="psCusCode"
                      name="psCusCode"
                      className="form-control form-control-sm rounded-0"
                      placeholder="Select account..."
                      autoComplete="off"
                      readOnly
                      required
                      value={
                        formData.psCusCode
                          ? `${formData.psCusCode} — ${formData.psCompanyName}`
                          : ''
                      }
                      onClick={() => {
                        setAcctPickerOpen(true)
                        setAcctSearch('')
                      }}
                    />
                    {acctPickerOpen && (
                      <div className="picker-panel">
                        <div className="search">
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            placeholder="Search code, company or branch..."
                            autoComplete="off"
                            autoFocus
                            value={acctSearch}
                            onChange={(e) => setAcctSearch(e.target.value)}
                          />
                        </div>
                        <div className="list">
                          <table>
                            <thead>
                              <tr>
                                <th>Code</th>
                                <th>Company</th>
                                <th>Branch</th>
                                <th>Serial No</th>
                                <th>Expiry</th>
                              </tr>
                            </thead>
                            <tbody>
                              {filteredAccounts().map((a, index) => (
                                <tr key={index} className="pick" onClick={() => pickAccount(a)}>
                                  <td>
                                    <strong>{a.psCusCode}</strong>
                                  </td>
                                  <td>{a.psCompanyName}</td>
                                  <td>{a.psBranchName}</td>
                                  <td>{a.psSerialNo}</td>
                                  <td>
                                    {a.psActivateExpiryDate
                                      ? moment(a.psActivateExpiryDate).format('DD/MM/YYYY')
                                      : ''}
                                  </td>
                                </tr>
                              ))}
                              {filteredAccounts().length === 0 && (
                                <tr className="empty">
                                  <td colSpan="5">No matching accounts.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="row">
                <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                  Branch
                </label>
                <div className="col-md">
                  <div className="row">
                    <div className="col pe-0">
                      <input
                        type="number"
                        name="branchCode"
                        id="branchCode"
                        value={formData.branchCode}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            branchCode: e.target.value,
                            psPickBcode: e.target.value,
                          })
                        }
                        required
                      />
                    </div>
                    <div className="col-8 ps-0">
                      <input
                        type="text"
                        name="psBranchName"
                        id="psBranchName"
                        value={formData.psBranchName}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) => setFormData({ ...formData, psBranchName: e.target.value })}
                        required
                      />
                    </div>
                  </div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row mb-3">
                <label htmlFor="psSerialNo" className="col-md-3 col-form-label divider">
                  Serial No
                </label>
                <div className="col-md">
                  <div className="row">
                    <div className="col-6">
                      {/* <select
                        className="form-select form-select-sm rounded-0"
                        aria-label="Default select example"
                        style={{
                          appearance: 'none',
                        }}
                        id="psSerialNo"
                        name="psSerialNo"
                        value={formData.psSerialNo}
                        // onChange={(e) =>
                        //   setEditFormData({ ...editFormData, querySerialNo: e.target.value })
                        // }
                        disabled
                      >
                        <option value={''}></option>
                        {serialNo.slice(0, 10).map((serial, index) => (
                          <option key={index} value={serial.serialId}>
                            {serial.serialId}
                          </option>
                        ))}
                      </select> */}
                      <input
                        type="text"
                        name="psSerialNo"
                        id="psSerialNo"
                        value={formData.psSerialNo}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) => setFormData({ ...formData, psSerialNo: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <div className="row">
                        <label htmlFor="blocked" className="col-3 col-form-label"></label>
                        <div className="col ">
                          <div className="form-check">
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={formData.psActivated}
                              name="blocked"
                              id="blocked"
                              onChange={(e) =>
                                setFormData({ ...formData, psActivated: e.target.checked })
                              }
                            />
                            <label
                              htmlFor="blocked"
                              className={formData.psActivated ? 'text-success' : 'text-danger'}
                            >
                              {formData.psActivated ? 'Active' : 'Not Active'}
                            </label>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="row mb-3">
                <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                  Activate Date
                </label>
                <div className="col-md ">
                  <div className="row">
                    <div className="col-5">
                      <DatePicker
                        className="form-control form-control-sm rounded-0"
                        selected={formData.PsActivateDate}
                        dateFormat="dd/MM/yyyy"
                        peekNextMonth
                        showMonthDropdown
                        showYearDropdown
                        dropdownMode="select"
                        minDate={new Date()}
                        onChange={(date) => setFormData({ ...formData, PsActivateDate: date })}
                        // onChange={(date) => handleDate(date)}
                        required
                      />
                    </div>
                    <div className="col">
                      <div className="row">
                        <label htmlFor="branchCode" className="col-3 col-form-label divider">
                          Expiry Date
                        </label>
                        <div className="col ">
                          <DatePicker
                            className="form-control form-control-sm rounded-0"
                            selected={formData.psActivateExpiryDate}
                            dateFormat="dd/MM/yyyy"
                            peekNextMonth
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            minDate={formData.PsActivateDate || new Date()}
                            onChange={(date) =>
                              setFormData({ ...formData, psActivateExpiryDate: date })
                            }
                            // onChange={(date) => handleDate(date)}
                            required
                          />
                          {/* <input
                            type="number"
                            name="days"
                            id="days"
                            value={formData.days}
                            className="form-control form-control-sm rounded-0"
                            onChange={handleDay}
                          /> */}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="row">
                <label htmlFor="psSerialNo" className="col-md-3 col-form-label divider">
                  Bed Count
                </label>
                <div className="col-md ">
                  <div className="row">
                    <div className="col-6">
                      <input
                        type="text"
                        name="psBedCount"
                        id="psBedCount"
                        value={formData.psBedCount}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) => setFormData({ ...formData, psBedCount: e.target.value })}
                        required
                      />
                    </div>
                    <div className="col-6">
                      <div className="row">
                        <label htmlFor="psSerialNo" className="col-md-3 col-form-label divider">
                          GL
                        </label>
                        <div className="col ">
                          <input
                            type="text"
                            name="psGL"
                            id="psGL"
                            value={formData.psGL}
                            className="form-control form-control-sm rounded-0"
                            onChange={(e) => setFormData({ ...formData, psGL: e.target.value })}
                            required
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row">
                <label className="col-md-3 col-form-label divider">
                  Location (Region / County / Town)
                </label>
                <div className="col-md">
                  <div className="row g-2">
                    <div className="col">
                      <SearchableSelect
                        options={regionOpts}
                        value={formData.regionId}
                        onChange={(v) => onRegionChange(v)}
                        getId={(o) => o.regionId}
                        getLabel={(o) => o.name}
                        placeholder="Search region..."
                      />
                    </div>
                    <div className="col">
                      <SearchableSelect
                        options={countyOpts}
                        value={formData.countyId}
                        onChange={(v) => onCountyChange(v)}
                        getId={(o) => o.countyId}
                        getLabel={(o) => o.name}
                        placeholder="Search county..."
                        disabled={!formData.regionId}
                      />
                    </div>
                    <div className="col">
                      <SearchableSelect
                        options={townOpts}
                        value={formData.townId}
                        onChange={(v) => setFormData({ ...formData, townId: v })}
                        getId={(o) => o.townId}
                        getLabel={(o) => o.name}
                        placeholder="Search town..."
                        disabled={!formData.countyId}
                      />
                    </div>
                  </div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row mb-2">
                <label className="col-md-3 col-form-label divider">Company Details</label>
                <div className="col-md">
                  <div className="row g-2">
                    <div className="col-md-6">
                      <input
                        type="email"
                        className="form-control form-control-sm rounded-0"
                        placeholder="Company email"
                        value={formData.companyEmail}
                        onChange={(e) => setFormData({ ...formData, companyEmail: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="Company phone"
                        value={formData.companyPhone}
                        onChange={(e) => setFormData({ ...formData, companyPhone: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="row g-2 mt-0">
                    <div className="col-md-12">
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="Physical address"
                        value={formData.physicalAddress}
                        onChange={(e) =>
                          setFormData({ ...formData, physicalAddress: e.target.value })
                        }
                      />
                    </div>
                  </div>
                  <div className="row g-2 mt-0">
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="PIN No."
                        value={formData.pinNo}
                        onChange={(e) => setFormData({ ...formData, pinNo: e.target.value })}
                      />
                    </div>
                    <div className="col-md-6">
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        placeholder="VAT No."
                        value={formData.vatNo}
                        onChange={(e) => setFormData({ ...formData, vatNo: e.target.value })}
                      />
                    </div>
                  </div>
                  <div className="form-text" style={{ fontSize: '10px' }}>
                    Written into the new customer database (SYSDEFAULTS) and saved on the client
                    record.
                  </div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row">
                <div className="col-md">
                  <div className="row">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      User CALS
                    </label>
                    <div className="col-md ">
                      <div className="row">
                        <div className="col">
                          <input
                            type="number"
                            name="psUserCount"
                            id="psUserCount"
                            value={formData.psUserCount}
                            className="form-control form-control-sm rounded-0"
                            onChange={(e) =>
                              setFormData({ ...formData, psUserCount: e.target.value })
                            }
                            required
                          />
                        </div>
                        <div className="col">
                          <div className="row">
                            <label htmlFor="branchCode" className="col-md-5 col-form-label divider">
                              Branch CALS
                            </label>
                            <div className="col-md ">
                              <input
                                type="number"
                                name="psBranchCount"
                                id="psBranchCount"
                                value={formData.psBranchCount}
                                className="form-control form-control-sm rounded-0"
                                onChange={(e) =>
                                  setFormData({ ...formData, psBranchCount: e.target.value })
                                }
                                required
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row">
                <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                  Stock Take CALS
                </label>
                <div className="col-md ">
                  <div className="row">
                    <div className="col">
                      <input
                        type="text"
                        name="psStockTakeCals"
                        id="psStockTakeCals"
                        value={formData.psStockTakeCals}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) =>
                          setFormData({ ...formData, psStockTakeCals: e.target.value })
                        }
                      />
                    </div>
                    <div className="col">
                      <div className="row">
                        <label htmlFor="branchCode" className="col-3 col-form-label divider">
                          From
                        </label>
                        <div className="col ">
                          <DatePicker
                            className="form-control form-control-sm rounded-0"
                            selected={formData.psStockTakeStartDate}
                            dateFormat="dd/MM/yyyy"
                            peekNextMonth
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            onChange={(date) =>
                              setFormData({ ...formData, psStockTakeStartDate: date })
                            }
                          />
                        </div>
                      </div>
                    </div>
                    <div className="col">
                      <div className="row">
                        <label htmlFor="branchCode" className="col-3 col-form-label divider">
                          To
                        </label>
                        <div className="col ">
                          <DatePicker
                            className="form-control form-control-sm rounded-0"
                            selected={formData.stockTakeEndDate}
                            dateFormat="dd/MM/yyyy"
                            peekNextMonth
                            showMonthDropdown
                            showYearDropdown
                            dropdownMode="select"
                            onChange={(date) =>
                              setFormData({ ...formData, stockTakeEndDate: date })
                            }
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <hr className="mb-3 mt-1" />
              <div className="row mb-1">
                <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                  Client Modules <span style={{ color: '#e55353' }}>*</span>
                </label>
                <div className="col-md">
                  <span className="d-flex flex-row gap-5 text-center">
                    {packages
                      ?.filter((item) => item !== null)
                      .map((module, index) => (
                        <span className="form-check" key={index}>
                          <input
                            className="form-check-input"
                            type="radio"
                            name="clientType"
                            id="desktop"
                            value={module.packageNum}
                            // onChange={(e) => console.log(e.target.value)}
                            onChange={(e) =>
                              setFormData({ ...formData, packageCode: e.target.value })
                            }
                          />
                          <label className="form-check-label" htmlFor="desktop">
                            {module.description}
                          </label>
                        </span>
                      ))}
                    {/* <span className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="clientType"
                          id="desktop"
                          // value={title}
                          // checked={title === 'false'}
                          // onChange={() => setTitle('false')}
                        />
                        <label className="form-check-label" htmlFor="desktop">
                          Light
                        </label>
                      </span>
                      <span className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="clientType"
                          id="cloud"
                          // value={title}
                          // checked={title === 'true'}
                          // onChange={() => setTitle('true')}
                        />
                        <label className="form-check-label" htmlFor="cloud">
                          Standard
                        </label>
                      </span>
                      <span className="form-check">
                        <input
                          className="form-check-input"
                          type="radio"
                          name="clientType"
                          id="both"
                          // value={title}
                          // checked={title === ''}
                          // onChange={() => setTitle('')}
                        />
                        <label className="form-check-label" htmlFor="both">
                          Professional
                        </label>
                      </span> */}
                  </span>
                </div>
              </div>
              <hr className="my-3" />
              <div className="row mb-2">
                <label className="col-md-3 col-form-label divider">Cloud Provisioning</label>
                <div className="col-md align-self-center">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formData.provisionDb}
                      id="provisionDb"
                      onChange={(e) => setFormData({ ...formData, provisionDb: e.target.checked })}
                    />
                    <label className="form-check-label" htmlFor="provisionDb">
                      Create the customer database &amp; users now (restore + company +
                      admin/support)
                    </label>
                  </div>
                </div>
              </div>
              {formData.provisionDb && (
                <>
                  <div className="row mb-3">
                    <label htmlFor="serverName" className="col-md-3 col-form-label divider">
                      Server
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        id="serverName"
                        value={formData.serverName}
                        onChange={(e) => setFormData({ ...formData, serverName: e.target.value })}
                        required={formData.provisionDb}
                      >
                        <option value=""></option>
                        {servers.map((s) => (
                          <option key={s.id} value={s.serverName}>
                            {s.serverName} ({s.sqlInstance})
                          </option>
                        ))}
                      </select>
                      {servers.length === 0 && (
                        <div className="form-text text-danger" style={{ fontSize: '11px' }}>
                          No servers are ready for provisioning.
                        </div>
                      )}
                      {notReadyServers.length > 0 && (
                        <div
                          className="alert alert-warning rounded-0 p-2 mt-2 mb-0"
                          style={{ fontSize: '11px' }}
                        >
                          <b>{notReadyServers.length} server(s) not ready</b> and hidden from the
                          list:
                          <ul className="m-0 ps-3">
                            {notReadyServers.map((s) => (
                              <li key={s.id}>
                                {s.serverName} — {s.issues}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="row mb-3">
                    <label htmlFor="adminUsername" className="col-md-3 col-form-label divider">
                      Admin User
                    </label>
                    <div className="col-md">
                      <div className="row">
                        <div className="col pe-0">
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            id="adminUsername"
                            placeholder="username (optional)"
                            value={formData.adminUsername}
                            onChange={(e) =>
                              setFormData({ ...formData, adminUsername: e.target.value })
                            }
                          />
                        </div>
                        <div className="col ps-1 pe-0">
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            id="adminFullName"
                            placeholder="full name (optional)"
                            value={formData.adminFullName}
                            onChange={(e) =>
                              setFormData({ ...formData, adminFullName: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="row mt-1">
                        <div className="col pe-0">
                          <input
                            type="email"
                            className="form-control form-control-sm rounded-0"
                            id="adminEmail"
                            placeholder="admin email"
                            value={
                              formData.useCompanyContact
                                ? formData.companyEmail
                                : formData.adminEmail
                            }
                            disabled={formData.useCompanyContact}
                            onChange={(e) =>
                              setFormData({ ...formData, adminEmail: e.target.value })
                            }
                          />
                        </div>
                        <div className="col-4 ps-1">
                          <input
                            type="text"
                            className="form-control form-control-sm rounded-0"
                            id="adminCellnumber"
                            placeholder="admin phone"
                            value={
                              formData.useCompanyContact
                                ? formData.companyPhone
                                : formData.adminCellnumber
                            }
                            disabled={formData.useCompanyContact}
                            onChange={(e) =>
                              setFormData({ ...formData, adminCellnumber: e.target.value })
                            }
                          />
                        </div>
                      </div>
                      <div className="form-check mt-1">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          id="useCompanyContact"
                          checked={formData.useCompanyContact}
                          onChange={(e) =>
                            setFormData({ ...formData, useCompanyContact: e.target.checked })
                          }
                        />
                        <label
                          className="form-check-label"
                          htmlFor="useCompanyContact"
                          style={{ fontSize: '11px' }}
                        >
                          Use the same email &amp; phone as the company
                        </label>
                      </div>
                      <div className="form-text" style={{ fontSize: '10px' }}>
                        Leave blank to auto-generate. A support user is always created. Admin email
                        is also used for the welcome email.
                      </div>
                    </div>
                  </div>
                </>
              )}
              <hr className="my-3" />
              <div className="d-flex justify-content-end">
                <button
                  type="submit"
                  style={{ width: '5rem' }}
                  className="btn btn-sm add-btn me-1 rounded-0"
                  disabled={isLoading}
                >
                  {isLoading ? (
                    <span
                      className="spinner-border text-denter spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  ) : (
                    'Create'
                  )}
                </button>
                {/* One Cancel button: aborts the in-flight provisioning while loading, otherwise leaves the form. */}
                <button
                  type="button"
                  className="btn btn-sm cancel-btn rounded-0"
                  onClick={() => (isLoading ? cancelProvision() : navigate('/dashboard'))}
                >
                  <i className="fa fa-times-circle" style={{ marginRight: 5 }}></i>
                  {isLoading ? 'Cancel Provisioning' : 'Cancel'}
                </button>
              </div>
            </form>
          </div>
        </div>
        <div className="col-md-4">
          <div className="card h-100 card-body rounded-0">
            {/* <p className="fw-bold mb-0 text-center" style={{ fontSize: '11px' }}>
              Client Details Summary
            </p>
            <ul className="list-group list-group-flush" style={{ fontSize: '10px' }}>
              <li className="list-group-item d-flex justify-content-between">
                <span className="fw-bold ">CPU</span>
                <span>{formData.psPickCpu}</span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span className="fw-bold ">BIOS</span>
                <span>{formData.psPickBios}</span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span className="fw-bold ">Hard Disk</span>
                <span>{formData.psPickHdd}</span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span className="fw-bold">Company</span>
                <span>
                  {formData.psPickCompany} - {formData.psPickBcode}
                </span>
              </li>
              <li className="list-group-item d-flex justify-content-between">
                <span className="fw-bold">Last Service Date</span>
                <span>{new Date().toLocaleString()}</span>
              </li>
            </ul> */}
          </div>
        </div>
      </div>
      {/* Module Modals */}
      <CModal visible={isClientModal} alignment="center" backdrop="static" scrollable>
        <CModalHeader>
          <CModalTitle>Client Modules</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <MaterialTable
            columns={[
              {
                title: 'Code',
                field: 'moduleCode',
                cellStyle: {
                  width: '10%',
                },
              },
              {
                title: 'Module',
                field: 'moduleName',
                cellStyle: {
                  width: 120,
                },
              },
              {
                title: 'Sub Module',
                field: 'subModuleName',
                cellStyle: {
                  minWidth: 200,
                },
              },
            ]}
            icons={tableIcons}
            onSelectionChange={(rows) => onSelectionChange(rows)}
            options={{
              ...tableOptions,
              search: true,
              paging: false,
              sorting: true,
              maxBodyHeight: 200,
              overflowY: 'auto',
              selection: true,
              showSelectAllCheckbox: true,
              // rowStyle: (rowData) => ({
              //   backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
              // }),
            }}
            isLoading={isLoading}
            data={cloudModules}
            title=""
          />
        </CModalBody>
        <CModalFooter>
          <div className="d-flex justify-content-end">
            <button
              type="submit"
              className="btn add-btn btn-sm rounded-0 me-1"
              style={{ width: '4rem' }}
              onClick={() => setIsClientModal(false)}
            >
              Select
            </button>

            <button
              type="button"
              style={{ width: '4rem' }}
              className="btn btn-sm cancel-btn float-end rounded-0"
              onClick={() => {
                setIsClientModal(false)
                setModulesSelected([])
                CloudModules()
              }}
            >
              Cancel
            </button>
          </div>
        </CModalFooter>
      </CModal>
    </>
  )
}

export default CreateClient
