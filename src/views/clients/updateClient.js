import React, { useState, useEffect } from 'react'
import { getToken } from '../../utils/session'
import { useParams, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
// CoreUI's icon set — the `fa fa-*` classes used elsewhere in this app render nothing.
import CIcon from '@coreui/icons-react'
import { cilCalendar, cilTrash, cilWarning } from '@coreui/icons'
import moment from 'moment'
import Moment from 'react-moment'
import Multiselect from 'multiselect-react-dropdown'
import SearchableSelect from '../../components/SearchableSelect'
import { toast } from 'react-toastify'
import { useBreadcrumbLabel } from '../../context/BreadcrumbContext'
const axios = require('axios')
// The three company-wide switches, in the order they are shown. `column` is the database column
// behind each, named on screen so an operator can match it to the behaviour they know.
const COMPANY_SETTING_FIELDS = [
  { key: 'enablePackages', label: 'Enable packages', column: 'EnablePackages' },
  { key: 'lockUserCount', label: 'Lock user count to licensed seats', column: 'LockuserCount' },
  { key: 'maltiusersLogin', label: 'Multi-user login', column: 'MaltiusersLogin' },
]

const UpdateClient = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setLabel } = useBreadcrumbLabel()
  const [error, setError] = useState('')
  const [totalUsers, setTotalUSers] = useState(0)
  const [clientModal, setClientModal] = useState(false)
  const [isClientModal, setIsClientModal] = useState(false)
  const [serialModal, setSerialModal] = useState(false)
  // BRANCH-level expiry.
  const [branchExpiryEdit, setBranchExpiryEdit] = useState(false)
  const [branchExpiryDate, setBranchExpiryDate] = useState(null)
  const [branchTempDays, setBranchTempDays] = useState('')

  const [tempDays, setTempDays] = useState('') // temporary-expiry extension (days)
  const [tempDate, setTempDate] = useState(null) // ...or pick the temp expiry date directly
  const [userCALSModal, setUserCALSModal] = useState(false)
  const [branchCALSModal, setBranchCALSModal] = useState(false)
  const [stockTakeCALSModal, setStockTakeCALSModal] = useState(false)
  const [psBedCountModal, setPsBedCountModal] = useState(false)
  const [psGLModal, setPsGLModal] = useState(false)
  const [addOnsModal, setAddOnsModal] = useState(false)
  // Add-on grants live per branch, so each change picks a scope. Expiry is optional — blank never lapses.
  const [addOnScope, setAddOnScope] = useState('all')
  const [addOnExpiry, setAddOnExpiry] = useState(null)
  // One size for every per-add-on action button.
  const addOnActionStyle = { fontSize: 10, minWidth: 84 }
  // Expiry editor for an add-on already granted: null when closed.
  const [expiryEdit, setExpiryEdit] = useState(null)
  const [extendDays, setExtendDays] = useState('')
  const [extendDate, setExtendDate] = useState(null)
  const [extendScope, setExtendScope] = useState('all')
  // Branch-level Is Active/Archived are edited together in their own modal.
  const [branchStatusModal, setBranchStatusModal] = useState(false)
  const [branchStatusForm, setBranchStatusForm] = useState({ isActive: false, archived: false })
  const [packages, setPackages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  // Company level changes every branch of the client; branch level changes only this one row.
  const [activeTab, setActiveTab] = useState('company')
  // The three company-wide switches, read live from the client's own databases.
  const [companySettings, setCompanySettings] = useState(null)
  const [companySettingsModal, setCompanySettingsModal] = useState(false)
  const [companySettingsForm, setCompanySettingsForm] = useState({
    enablePackages: true,
    lockUserCount: true,
    maltiusersLogin: false,
  })
  const [data, setData] = useState({
    error: '',
    psCusCode: '',
    psCompanyName: '',
    branchCode: '',
    psBranchName: '',
    psActivateExpiryDate: '',
    psSerialNo: '',
    psStockTakeCals: '',
    psBedCount: '',
    psGL: false,
    psActivated: false,
    psStockTakeStartDate: '',
    stockTakeEndDate: '',
    addons: [],
    addOnCoverage: [],
    moduleAccess: [],
    psBranchCount: '',
    psUserCount: '',
    psPickCpu: '',
    psPickBios: '',
    psPickCompany: '',
    psPickBcode: '',
    psPickHdd: '',
    pickDate: '',
    packageCode: '',
    packageName: '',
    totalUsers: 0,
    // Rollups across every branch (not this row's own flags) — see GetClientDetailsVM.
    companyArchived: false,
    companyActive: false,
    branchCount: 0,
    // This branch's own flags.
    archived: false,
  })
  const [editFormData, setEditFormData] = useState({
    /*** Change Details ***/
    queryAcctCode: '',
    queryAcctName: '',
    queryBranchCode: '',
    queryBranchName: '',
    querySerialNo: '',
    queryExpiryDate: '',
    queryDays: '',
    psBedCount: '',
    psGL: false,
    isActive: false,
    archived: false,
    queryUserCount: '',
    queryBranchCount: '',
    queryStockTakeCals: '',
    queryStockTakeStartDate: '',
    queryStockTakeEndDate: '',
    queryAddOns: [],
    AddOnsArray: [],
    selectedAdons: '',
    packageCode: '',
  })
  const [serialNo, setSerialNo] = useState([])
  const [addOns, setAddOns] = useState([])
  // Region -> County -> Town location picker for this branch.
  const [regionOpts, setRegionOpts] = useState([])
  const [countyOpts, setCountyOpts] = useState([])
  const [townOpts, setTownOpts] = useState([])
  const [loc, setLoc] = useState({ regionId: '', countyId: '', townId: '' })
  const [locSaving, setLocSaving] = useState(false)
  const [locMsg, setLocMsg] = useState('')

  const GetClientDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClientDetails?id=${id}`,
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
        const result = await response.json()
        setIsLoading(false)
        setData({
          ...data,
          psCusCode: result?.clientDetails.psCusCode,
          psCompanyName: result?.clientDetails.psCompanyName,
          branchCode: result?.clientDetails.branchCode,
          psBranchName: result?.clientDetails.psBranchName,
          psSerialNo: result?.clientDetails.psSerialNo,
          psActivated: result?.clientDetails.psActivated === '1' ? true : false,
          psActivateExpiryDate: result?.clientDetails?.psActivateExpiryDate,
          psTemporaryActivateExpiryDate: result?.clientDetails?.psTemporaryActivateExpiryDate,
          psBedCount: result?.clientDetails?.psBedCount,
          psGL: result?.clientDetails?.psGL,
          psUserCount: result?.clientDetails.psUserCount,
          psBranchCount: result?.clientDetails.psBranchCount,
          psStockTakeCals: result?.clientDetails.psStockTakeCals,
          psStockTakeStartDate: result?.clientDetails.psStockTakeStartDate,
          stockTakeEndDate: result?.clientDetails.stockTakeEndDate,
          addons: result?.clientAddOn,
          // One entry per add-on with branch coverage + expiry (grants are stored per branch).
          addOnCoverage: result?.addOnCoverage ?? [],
          moduleAccess: result?.moduleAccess,
          psPickCpu: result?.clientDetails.psPickCPU,
          psPickBios: result?.clientDetails.psPickBios,
          psPickHdd: result?.clientDetails.psPickHDD,
          psPickCompany: result?.clientDetails.psPickCompany,
          psPickBcode: result?.clientDetails.psPickBcode,
          pickDate: result?.clientDetails.pickDate,
          packageCode: result?.clientDetails.packageCode,
          packageName: result?.clientDetails.packageName,
          companyArchived: result?.companyArchived === true,
          companyActive: result?.companyActive === true,
          branchCount: result?.branchCount ?? 0,
          // Every branch with the expiry it sits on.
          branchExpiries: result?.branchExpiries ?? [],
          archived: result?.clientDetails?.archived === true,
        })
        setEditFormData({
          ...editFormData,
          queryAcctCode: result?.clientDetails.psCusCode,
          queryAcctName: result?.clientDetails.psCompanyName,
          queryBranchCode: result?.clientDetails.branchCode,
          querySerialNo: result?.clientDetails.psSerialNo,
          psBedCount: result?.clientDetails?.psBedCount,
          psGL: result?.clientDetails?.psGL,
          queryBranchName: result?.clientDetails.psBranchName,
          queryExpiryDate:
            result.clientDetails.psActivateExpiryDate === '' ||
            result.clientDetails.psActivateExpiryDate === null
              ? ''
              : new Date(result?.clientDetails?.psActivateExpiryDate),
          // The Serial/Expiry modal is company level.
          isActive: result?.companyActive === true,
          archived: result?.companyArchived === true,
          queryStockTakeStartDate:
            result.clientDetails.psStockTakeStartDate === '' ||
            result.clientDetails.psStockTakeStartDate === null
              ? ''
              : new Date(result?.clientDetails?.psStockTakeStartDate),
          queryStockTakeEndDate:
            result.clientDetails.stockTakeEndDate === '' ||
            result.clientDetails.stockTakeEndDate === null
              ? ''
              : new Date(result?.clientDetails?.stockTakeEndDate),
          queryUserCount: result?.clientDetails?.psUserCount,
          // The add-on picker starts EMPTY and is only for what you're granting now.
          AddOnsArray: [],
          selectedAdons: [],
          queryStockTakeCals: result?.clientDetails.psStockTakeCals,
          queryBranchCount: result?.clientDetails.psBranchCount,
        })
        prefillLocation(result?.clientDetails?.townId)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
      }
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }

  // ---- Region -> County -> Town location picker ----
  const locHeaders = () => ({
    Authorization: `Bearer ${getToken()}`,
    Accept: 'application/json',
    'Content-Type': 'application/json',
  })
  const GetRegions = async () => {
    try {
      const r = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Locations/Regions`, {
        headers: locHeaders(),
      })
      setRegionOpts(r.data ?? [])
    } catch (e) {}
  }
  const loadCounties = async (regionId) => {
    if (!regionId) return
    const r = await axios.get(
      `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Counties?regionId=${regionId}`,
      { headers: locHeaders() },
    )
    setCountyOpts(r.data ?? [])
  }
  const loadTowns = async (countyId) => {
    if (!countyId) return
    const r = await axios.get(
      `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Towns?countyId=${countyId}`,
      { headers: locHeaders() },
    )
    setTownOpts(r.data ?? [])
  }
  const onRegionChange = async (regionId) => {
    setLoc({ regionId, countyId: '', townId: '' })
    setCountyOpts([])
    setTownOpts([])
    if (regionId) await loadCounties(regionId)
  }
  const onCountyChange = async (countyId) => {
    setLoc((p) => ({ ...p, countyId, townId: '' }))
    setTownOpts([])
    if (countyId) await loadTowns(countyId)
  }
  // Prefill region/county/town from an existing TownId on the branch.
  const prefillLocation = async (townId) => {
    if (!townId) return
    try {
      const res = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Locations/Resolve/${townId}`,
        { headers: locHeaders() },
      )
      const d = res.data
      await loadCounties(d.regionId)
      await loadTowns(d.countyId)
      setLoc({
        regionId: String(d.regionId),
        countyId: String(d.countyId),
        townId: String(d.townId),
      })
    } catch (e) {}
  }
  const saveLocation = async () => {
    setLocSaving(true)
    setLocMsg('')
    try {
      const qs = loc.townId ? `?id=${id}&townId=${Number(loc.townId)}` : `?id=${id}`
      await axios.put(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateClientTown${qs}`,
        {},
        {
          headers: locHeaders(),
        },
      )
      setLocMsg('Saved')
      setTimeout(() => setLocMsg(''), 4000)
    } catch (e) {
      setError(e?.response?.data?.message || e.message)
    } finally {
      setLocSaving(false)
    }
  }

  const GetAllUsersInCompany = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetAllUsersInCompany?ClientID=${id}`,
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
        const result = await response.json()
        setIsLoading(false)
        setTotalUSers(result ?? 0)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
      }
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const GetSerialNumbers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`,
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
        const result = await response.json()
        setSerialNo(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        await response.json()
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const GetAddOns = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Logs/GetAddOns`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${getToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setAddOns(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        await response.json()
        setIsLoading(false)
      }
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const GetPackages = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/Packages`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${getToken()}`,
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
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  // Every gated endpoint answers in one of four ways: queued for approval.
  const handleGatedResponse = (body) => {
    if (body?.pendingApproval) {
      toast.info(body.message || 'Submitted for approval — approvers have been notified.', {
        position: toast.POSITION.BOTTOM_LEFT,
        theme: 'colored',
        autoClose: 8000,
      })
      return false
    }
    if (body?.unchanged) {
      toast.info(body.message || 'Nothing changed.', { theme: 'colored', autoClose: 5000 })
      return false
    }
    // The central write succeeded; only the mirror into the client database failed.
    if (body?.warning) {
      toast.warning(body.warning, { theme: 'colored', autoClose: 12000 })
    }
    return true
  }

  // One PUT, shared by the simple query-string toggles.
  const putToggle = async (path, params, { reload = true } = {}) => {
    setIsLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        id,
        cpu: data.psPickCpu ?? '',
        bios: data.psPickBios ?? '',
        hdd: data.psPickHdd ?? '',
        ...params,
      })
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/${path}?${qs.toString()}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message || 'The change could not be applied.')
        return { ok: false, applied: false }
      }
      // ok but not applied is the normal "queued for approval" case — not a failure.
      const applied = handleGatedResponse(body)
      if (applied && reload) GetClientDetails(id)
      return { ok: true, applied }
    } catch (err) {
      setError(err?.message || 'The change could not be applied.')
      return { ok: false, applied: false }
    } finally {
      setIsLoading(false)
      setTimeout(() => setError(''), 10000)
    }
  }

  // Live from the hosting server — these three have no central copy to read instead.
  const GetCompanySettings = async () => {
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetCompanySettings?id=${id}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setCompanySettings({ unavailable: body?.message || 'These settings could not be read.' })
        return
      }
      // A warning means the client's host was unreachable, so there is nothing to show or edit.
      setCompanySettings(body?.warning ? { unavailable: body.warning } : body)
    } catch (err) {
      setCompanySettings({ unavailable: err?.message || 'These settings could not be read.' })
    }
  }

  // The Edit button stays disabled until something actually moves.
  const companySettingsChanged = () =>
    COMPANY_SETTING_FIELDS.some(
      (f) => companySettings && companySettingsForm[f.key] !== (companySettings[f.key] === true),
    )

  // Company level by construction: SYSDEFAULTS and CompanyDetails hold one row for the whole client.
  const SaveCompanySettings = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        id,
        cpu: data.psPickCpu ?? '',
        bios: data.psPickBios ?? '',
        hdd: data.psPickHdd ?? '',
      })
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateCompanySettings?${qs.toString()}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          // A switch whose column is missing is never sent: the server would refuse it.
          body: JSON.stringify(
            COMPANY_SETTING_FIELDS.reduce(
              (acc, f) =>
                companySettings?.[f.key] === null
                  ? acc
                  : { ...acc, [f.key]: companySettingsForm[f.key] },
              {},
            ),
          ),
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message || 'The change could not be applied.')
        return
      }
      // Closed either way: a queued approval is nothing more for the operator to do here.
      handleGatedResponse(body)
      setCompanySettingsModal(false)
      GetCompanySettings()
    } catch (err) {
      setError(err?.message || 'The change could not be applied.')
    } finally {
      setIsLoading(false)
      setTimeout(() => setError(''), 10000)
    }
  }

  // Branch level — Is Active and Archived are separate endpoints.
  const SaveBranchStatus = async (e) => {
    e.preventDefault()
    const activeChanged = branchStatusForm.isActive !== data.psActivated
    const archivedChanged = branchStatusForm.archived !== data.archived
    if (!activeChanged && !archivedChanged) {
      toast.info('Nothing changed.', { theme: 'colored', autoClose: 5000 })
      return
    }
    if (activeChanged) {
      const r = await putToggle(
        'UpdateBranchActive',
        { isActive: String(branchStatusForm.isActive) },
        { reload: false },
      )
      if (!r.ok) {
        GetClientDetails(id)
        return
      }
    }
    if (archivedChanged) {
      const r = await putToggle(
        'UpdateBranchArchived',
        { archived: String(branchStatusForm.archived) },
        { reload: false },
      )
      if (!r.ok) {
        GetClientDetails(id)
        return
      }
    }
    setBranchStatusModal(false)
    GetClientDetails(id)
  }

  // Company level — the name is applied to every branch and mirrored to the client database's.
  const UpdateClientDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateClientDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            companyName: editFormData.queryAcctName,
          }),
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setClientModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  /** This branch's own row out of the company-wide list the detail endpoint returns. */
  const thisBranchExpiry = () => {
    const found = (data?.branchExpiries ?? []).find((b) => String(b.id) === String(id))
    if (found) return found

    return data?.psActivateExpiryDate
      ? {
          id,
          branchCode: data.branchCode,
          branchName: data.psBranchName,
          licenceExpiry: data.psActivateExpiryDate,
          temporaryExpiry: data.psTemporaryActivateExpiryDate,
        }
      : null
  }

  /** The branches this one shares an invoice with — those on the SAME licence expiry. */
  const invoiceGroupPeers = () => {
    const mine = thisBranchExpiry()
    if (!mine?.licenceExpiry) return []
    const key = String(mine.licenceExpiry).slice(0, 10)
    return (data?.branchExpiries ?? []).filter(
      (b) => String(b.id) !== String(id) && String(b.licenceExpiry ?? '').slice(0, 10) === key,
    )
  }

  /** Branches NOT on the company-wide date — what a Company-level save would reset. */
  const branchesOffCompanyDate = () => {
    const rows = data?.branchExpiries ?? []
    if (rows.length < 2) return []
    const target = moment(editFormData.queryExpiryDate).format('YYYY-MM-DD')
    return rows.filter((b) => String(b.licenceExpiry ?? '').slice(0, 10) !== target)
  }

  const saveBranchExpiry = async () => {
    if (!branchExpiryDate) return setError('Pick an expiry date for this branch.')
    const r = await putToggle('UpdateBranchExpiry', {
      expiryDate: moment(branchExpiryDate).format('DD/MM/YYYY'),
    })
    if (r.ok) setBranchExpiryEdit(false)
  }

  const saveBranchTempDays = async () => {
    const n = Number(branchTempDays)
    if (!Number.isFinite(n) || n <= 0)
      return setError('Enter the number of extension days (greater than zero).')
    const r = await putToggle('UpdateBranchTempExpiry', { days: String(n) })
    if (r.ok) setBranchTempDays('')
  }

  // Serial / expiry / Is Active go together in one request; Archived is its own endpoint.
  const UpdateSerialsDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateSerialDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serialNo: editFormData.querySerialNo,
            isActive: editFormData.isActive,
            cusCode: data.psCusCode,
            branchCode: data.branchCode,
            // The expiry here is COMPANY level and always writes every branch row.
            expiryDate: moment(editFormData.queryExpiryDate).format('DD/MM/YYYY'),
          }),
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      const serialApplied = handleGatedResponse(body)

      // Archive change, if any. Skipped on a failure rather than stacking a second error message.
      if (editFormData.archived !== data.companyArchived) {
        const r = await putToggle(
          'UpdateCompanyArchived',
          { archived: String(editFormData.archived) },
          { reload: false },
        )
        if (!r.ok) {
          setIsLoading(false)
          GetClientDetails(id)
          return
        }
      }

      setSerialModal(false)
      setIsLoading(false)
      setEditFormData({
        ...editFormData,
        queryDays: '',
      })
      // Reload when anything landed, or when the archive leg ran, so the screen matches the server.
      if (serialApplied || editFormData.archived !== data.companyArchived) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateTemporaryDate = async () => {
    const days = Number(tempDays)
    if (!days || days <= 0) {
      setError('Enter the number of extension days (greater than zero).')
      setTimeout(() => setError(''), 6000)
      return
    }
    setIsLoading(true)
    setError('')
    try {
      // Temporary grace extension of N days beyond the client's expiry — applied to all branches.
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateTemporaryDate?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}&days=${days}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setSerialModal(false)
      setIsLoading(false)
      setTempDays('')
      setTempDate(null)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateUserCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateUserCals?id=${id}&cpu=${
          data.psPickCpu
        }&bios=${data.psPickBios}&hdd=${data.psPickHdd}&userCals=${Number(
          editFormData.queryUserCount,
        )}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setUserCALSModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateBranchCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateBranchCals?id=${id}&cpu=${
          data.psPickCpu
        }&bios=${data.psPickBios}&hdd=${data.psPickHdd}&branchCals=${Number(
          editFormData.queryBranchCount,
        )}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setBranchCALSModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateBedCount = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateBedCount?id=${id}&cpu=${
          data.psPickCpu
        }&bios=${data.psPickBios}&hdd=${data.psPickHdd}&BedCount=${Number(
          editFormData.psBedCount,
        )}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setPsBedCountModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateGL = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateGL?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}&psGL=${editFormData.psGL}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setPsGLModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateStockTakeCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateStockTakeCals?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            stocktakeCalls: editFormData.queryStockTakeCals,
            fromDate: moment(editFormData.queryStockTakeStartDate).format('DD/MM/YYYY'),
            toDate: moment(editFormData.queryStockTakeEndDate).format('DD/MM/YYYY'),
          }),
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setStockTakeCALSModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  // Grants are stored per branch, so the scope choice is real: all branches, or just this one.
  const UpdateAddsOn = async (e) => {
    e.preventDefault()
    const ids = editFormData.selectedAdons
    if (!ids || ids.length === 0) {
      setError('Select at least one add-on')
      setTimeout(() => setError(''), 6000)
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        id,
        cpu: data.psPickCpu ?? '',
        bios: data.psPickBios ?? '',
        hdd: data.psPickHdd ?? '',
        allBranches: String(addOnScope === 'all'),
      })
      if (addOnExpiry) qs.set('expiryDate', moment(addOnExpiry).format('DD/MM/YYYY'))

      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateAddsOn?${qs.toString()}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            psCusCode: data.psCusCode,
            branchCode: data.branchCode,
            addonId: ids,
          }),
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setAddOnsModal(false)
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdatePackage = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdatePackage?id=${id}&packagecode=${editFormData.packageCode}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setIsLoading(false)
      setIsClientModal(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  // --- Extending an add-on already granted ---

  // The baseline a days-extension counts from: the add-on's own expiry while it is still running.
  const extendBaseline = (row) => {
    const current = row?.expiryDate ?? row?.earliestExpiry
    if (!current) return moment().startOf('day')
    const m = moment(current).startOf('day')
    return m.isAfter(moment().startOf('day')) ? m : moment().startOf('day')
  }

  const openExpiryEdit = (row) => {
    setExpiryEdit(row)
    setExtendDays('')
    setExtendDate(row?.expiryDate ? new Date(row.expiryDate) : null)
    // Default the scope to however the add-on is currently held.
    setExtendScope(row?.allBranches ? 'all' : 'branch')
  }

  // Days -> date. Shown as a preview.
  const onExtendDays = (e) => {
    const value = e.target.value
    setExtendDays(value)

    const days = Number(value)
    setExtendDate(
      value && Number.isFinite(days) && days > 0
        ? extendBaseline(expiryEdit).add(days, 'days').toDate()
        : null,
    )
  }

  /** How many licensed days a chosen date would REMOVE, or 0 when it adds or changes nothing. */
  const shortensBy = () => {
    if (!extendDate || !expiryEdit) return 0

    const current = expiryEdit.expiryDate ?? expiryEdit.earliestExpiry
    if (!current) return 0 // "never expires" — any date is a reduction, but of nothing countable

    const lost = moment(current).startOf('day').diff(moment(extendDate).startOf('day'), 'days')
    return lost > 0 ? lost : 0
  }

  // Date -> days, counted from the same baseline so the two boxes agree.
  const onExtendDate = (date) => {
    setExtendDate(date)

    if (!date) {
      setExtendDays('')
      return
    }

    const days = moment(date).startOf('day').diff(extendBaseline(expiryEdit), 'days')
    setExtendDays(days > 0 ? String(days) : '')
  }

  const SaveAddOnExpiry = async (e) => {
    e.preventDefault()
    if (!expiryEdit) return
    const days = Number(extendDays)
    if (!extendDate && !(days > 0)) {
      setError('Enter a new expiry date or a number of days.')
      setTimeout(() => setError(''), 6000)
      return
    }
    setIsLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        id,
        cpu: data.psPickCpu ?? '',
        bios: data.psPickBios ?? '',
        hdd: data.psPickHdd ?? '',
        addonId: expiryEdit.addonId,
        allBranches: String(extendScope === 'all'),
      })
      // Mixed expiries only stay staggered if the server does the arithmetic per row.
      if (days > 0 && expiryEdit.mixedExpiry) qs.set('days', String(days))
      else if (extendDate) qs.set('expiryDate', moment(extendDate).format('DD/MM/YYYY'))
      else qs.set('days', String(days))

      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateAddOnExpiry?${qs.toString()}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setError(body?.message || 'The expiry could not be changed.')
        return
      }
      setExpiryEdit(null)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (err) {
      setError(err?.message || 'The expiry could not be changed.')
    } finally {
      setIsLoading(false)
      setTimeout(() => setError(''), 10000)
    }
  }

  // Removal is scoped the same way granting is — all branches, or only this one.
  const DeleteAddsOn = async (addonId, allBranches) => {
    setIsLoading(true)
    setError('')
    try {
      const qs = new URLSearchParams({
        id,
        cpu: data.psPickCpu ?? '',
        bios: data.psPickBios ?? '',
        hdd: data.psPickHdd ?? '',
        cusCode: data.psCusCode ?? '',
        branchCode: data.branchCode ?? '',
        addonId,
        allBranches: String(allBranches),
      })
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/RemoveAddons?${qs.toString()}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setIsLoading(false)
      if (handleGatedResponse(body)) GetClientDetails(id)
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const UpdateDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT',
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const body = await response.json()
      if (!response.ok) {
        setIsLoading(false)
        setError(body.message)
        return
      }
      setIsLoading(false)
      // Finalize is gated too: only leave the screen once it has actually been applied.
      if (handleGatedResponse(body)) navigate('/dashboard')
    } catch (error) {
      setIsLoading(false)
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }

  const handleDay = (e) => {
    const date = new Date()

    setEditFormData({
      ...editFormData,
      queryDays: e.target.value,
      queryExpiryDate: e.target.value
        ? new Date(date.setDate(date.getDate() + Number(e.target.value)))
        : new Date(),
    })
  }

  const handleDate = (date) => {
    let diffDate = new Date().getTime() - date.getTime()
    let conv = Math.abs(diffDate)
    setEditFormData({
      ...editFormData,
      queryExpiryDate: date,
      queryDays: Math.round(conv / (1000 * 60 * 60 * 24)),
    })
  }

  // Temporary-extension date <-> days, mirroring the expiry entry above.
  const handleTempDay = (e) => {
    const value = e.target.value
    setTempDays(value)
    setTempDate(value ? moment().add(Number(value), 'days').toDate() : null)
  }

  const handleTempDate = (date) => {
    setTempDate(date)
    setTempDays(
      date ? String(moment(date).startOf('day').diff(moment().startOf('day'), 'days')) : '',
    )
  }

  // Select and de-select must both leave selectedAdons as an ARRAY of ids.
  const onAddOnPick = (selectedList) =>
    setEditFormData({
      ...editFormData,
      AddOnsArray: selectedList,
      selectedAdons: selectedList.map((item) => item.addonId),
    })

  useEffect(() => {
    GetSerialNumbers()
    GetAddOns()
    GetPackages()
    GetRegions()
    GetClientDetails()
    GetAllUsersInCompany()
    GetCompanySettings()
  }, [])

  // Show the loaded client's name in the breadcrumb (instead of the generic "Update Client").
  useEffect(() => {
    setLabel(data?.psCompanyName || data?.psCusCode || null)
    return () => setLabel(null)
  }, [data?.psCompanyName, data?.psCusCode, setLabel])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light  p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <div className="d-flex d-flex align-items-center">
              <h6 className="m-0">
                Client:{' '}
                <span className="company_text_color fw-semibold">{data?.psCompanyName}</span>
              </h6>
            </div>
          </div>
          <div className="">
            <button
              type="button"
              style={{ width: '5rem' }}
              className="btn btn-sm add-btn me-1 rounded-0"
              disabled={isLoading}
              onClick={UpdateDetails}
            >
              {isLoading ? (
                <span
                  className="spinner-border text-denter spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                'Update'
              )}
            </button>
            <button
              type="button"
              style={{ width: '5rem' }}
              className="btn btn-sm cancel-btn rounded-0"
              onClick={() => navigate('/dashboard')}
            >
              <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i>
              Cancel
            </button>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      {data.error && (
        <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
          <span> {data.error} </span>
        </div>
      )}
      {error && (
        <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
          <span> {error} </span>
        </div>
      )}
      {/* Company level changes every branch of this client. */}
      <ul className="nav nav-tabs" style={{ fontSize: '13px' }}>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'company' ? 'active' : ''}`}
            onClick={() => setActiveTab('company')}
          >
            Company Level
            <span className="text-muted ms-1 fw-normal" style={{ fontSize: '11px' }}>
              (all {data.branchCount || 0} branch{data.branchCount === 1 ? '' : 'es'})
            </span>
          </button>
        </li>
        <li className="nav-item">
          <button
            type="button"
            className={`nav-link ${activeTab === 'branch' ? 'active' : ''}`}
            onClick={() => setActiveTab('branch')}
          >
            Branch Level
            <span className="text-muted ms-1 fw-normal" style={{ fontSize: '11px' }}>
              ({data.psBranchName || data.branchCode || 'this branch'})
            </span>
          </button>
        </li>
      </ul>
      <div className="row g-2 mt-0">
        {activeTab === 'company' && (
          <div className="col-md">
            <div className="card h-100 rounded-0" style={{ borderTopLeftRadius: 0 }}>
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <div className="d-flex justify-content-between">
                    <p className="mb-0 fw-bold align-self-end" style={{ fontSize: '11px' }}>
                      Company Level — applies to every branch
                    </p>
                  </div>

                  <div className="d-flex">
                    <p className="m-0 fw-bold" style={{ fontSize: '11px' }}>
                      Status:{' '}
                      <span className={data.companyActive ? 'text-success' : 'text-danger'}>
                        {data.companyActive ? 'All branches active' : 'Not all branches active'}
                      </span>
                      {data.companyArchived && <span className="text-danger ms-2">• Archived</span>}
                    </p>
                  </div>
                </div>
                <hr className="mt-1 mb-2" />
                <form autoComplete="off">
                  <div className="row my-3">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      Acct Name
                    </label>
                    <div className="col-md ps-1">
                      <div className="row">
                        <div className="col pe-0">
                          <input
                            type="text"
                            name="psCusCode"
                            id="psCusCode"
                            value={data.psCusCode}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            disabled
                            readOnly
                          />
                        </div>
                        <div className="col-8 ps-0">
                          <input
                            type="text"
                            name="psCompanyName"
                            id="psCompanyName"
                            value={data.psCompanyName}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            disabled
                            readOnly
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* The branch code/name belong to the Branch Level tab. */}
                  <div className="d-flex justify-content-end">
                    <p
                      className="my-1 fw-bold"
                      role="button"
                      style={{ fontSize: '10px', color: '#c58c4f' }}
                      onClick={() => setClientModal(true)}
                    >
                      Change
                    </p>
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-1">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      Client Modules
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
                                checked={module.packageNum === data.packageCode}
                                onChange={() => {}}
                                disabled
                              />
                              <label className="form-check-label" htmlFor="desktop">
                                {module.description}
                              </label>
                            </span>
                          ))}
                      </span>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <p
                      className="my-1 fw-bold"
                      role="button"
                      style={{ fontSize: '10px', color: '#c58c4f' }}
                      onClick={() => setIsClientModal(true)}
                    >
                      Change
                    </p>
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-3">
                    <label htmlFor="psSerialNo" className="col-md-3 col-form-label divider">
                      Serial No
                    </label>
                    <div className="col-md ps-1">
                      <div className="row">
                        <div className="col-6">
                          <input
                            type="text"
                            name="psSerialNo"
                            id="psSerialNo"
                            value={data.psSerialNo}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            disabled
                          />
                        </div>
                        <div className="col-6">
                          <div className="row">
                            <label htmlFor="blocked" className="col-3 col-form-label"></label>
                            <div className="col ps-0">
                              <div className="form-check">
                                <input
                                  className="form-check-input"
                                  type="checkbox"
                                  checked={data.companyActive}
                                  name="blocked"
                                  id="blocked"
                                  readOnly
                                />
                                <label
                                  className={
                                    data.companyActive
                                      ? 'form-check-label text-success fw-bold'
                                      : 'form-check-label text-danger fw-bold'
                                  }
                                  htmlFor="blocked"
                                >
                                  {data.companyActive ? 'Is Active' : 'Not Active'}
                                </label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Archive is independent of activation. */}
                  <div className="row mb-1">
                    <label
                      htmlFor="companyArchivedView"
                      className="col-md-3 col-form-label divider"
                    >
                      Archived
                    </label>
                    <div className="col-md ps-1">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={data.companyArchived}
                          name="companyArchivedView"
                          id="companyArchivedView"
                          readOnly
                          disabled
                        />
                        <label
                          className={
                            data.companyArchived
                              ? 'form-check-label text-danger fw-bold'
                              : 'form-check-label fw-bold'
                          }
                          htmlFor="companyArchivedView"
                        >
                          {data.companyArchived ? 'Archived' : 'Not Archived'}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="row mb-1">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      Expiry Date
                    </label>
                    <div className="col-md ps-1">
                      <div className="row">
                        <div className="col-6">
                          <input
                            type="text"
                            name="psActivateExpiryDate"
                            id="psActivateExpiryDate"
                            value={
                              !data.psActivateExpiryDate
                                ? ''
                                : moment(data.psActivateExpiryDate).format('DD/MM/YYYY')
                            }
                            className="form-control form-control-sm rounded-0 fw-medium"
                            readOnly
                            disabled
                          />
                        </div>
                        <div className="col-6">
                          <div className="row">
                            <label htmlFor="branchCode" className="col-3 col-form-label divider">
                              Days
                            </label>
                            <div className="col ps-0">
                              <input
                                type="text"
                                name=""
                                id=""
                                className="form-control form-control-sm rounded-0 fw-medium"
                                readOnly
                                disabled
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  {/* Location is per-branch — it lives on the Branch Level tab. */}
                  <div className="d-flex justify-content-end">
                    {data.psCusCode === '' || data.branchCode === '' ? (
                      ''
                    ) : (
                      <p
                        className="my-1 fw-bold"
                        role="button"
                        style={{ fontSize: '10px', color: '#c58c4f' }}
                        disabled={!data.psCusCode || !data.branchCode}
                        onClick={() => setSerialModal(true)}
                      >
                        Change
                      </p>
                    )}
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-1">
                    <div className="col-md">
                      <div className="row">
                        <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                          User CALS
                        </label>
                        <div className="col-md ps-1">
                          <div className="row">
                            <div className="col">
                              <input
                                type="text"
                                name="psUserCount"
                                id="psUserCount"
                                value={data.psUserCount}
                                className="form-control form-control-sm rounded-0 fw-medium"
                                disabled
                                readOnly
                              />
                              <div className="d-flex justify-content-end">
                                <p
                                  className="my-1 fw-bold"
                                  role="button"
                                  style={{ fontSize: '10px', color: '#c58c4f' }}
                                  onClick={() => setUserCALSModal(true)}
                                >
                                  Change
                                </p>
                              </div>
                            </div>
                            <div className="col">
                              <div className="row">
                                <label
                                  htmlFor="branchCode"
                                  className="col-md-5 col-form-label divider"
                                >
                                  Branch CALS
                                </label>
                                <div className="col-md ps-1">
                                  <input
                                    type="text"
                                    name="psBranchCount"
                                    id="psBranchCount"
                                    value={data.psBranchCount}
                                    className="form-control form-control-sm rounded-0 fw-medium"
                                    disabled
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="d-flex justify-content-end">
                                <p
                                  className="my-1 fw-bold"
                                  role="button"
                                  style={{ fontSize: '10px', color: '#c58c4f' }}
                                  onClick={() => setBranchCALSModal(true)}
                                >
                                  Change
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-1">
                    <div className="col-md">
                      <div className="row">
                        <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                          Bed Count
                        </label>
                        <div className="col-md ps-1">
                          <div className="row">
                            <div className="col">
                              <input
                                type="text"
                                name="psUserCount"
                                id="psUserCount"
                                value={data.psBedCount}
                                className="form-control form-control-sm rounded-0 fw-medium"
                                disabled
                                readOnly
                              />
                              <div className="d-flex justify-content-end">
                                <p
                                  className="my-1 fw-bold"
                                  role="button"
                                  style={{ fontSize: '10px', color: '#c58c4f' }}
                                  onClick={() => setPsBedCountModal(true)}
                                >
                                  Change
                                </p>
                              </div>
                            </div>
                            <div className="col">
                              <div className="row">
                                <label
                                  htmlFor="branchCode"
                                  className="col-md-5 col-form-label divider"
                                >
                                  GL
                                </label>
                                <div className="col-md ps-1">
                                  <input
                                    type="text"
                                    name="psGL"
                                    id="psGL"
                                    value={data.psGL}
                                    className="form-control form-control-sm rounded-0 fw-medium"
                                    disabled
                                    readOnly
                                  />
                                </div>
                              </div>
                              <div className="d-flex justify-content-end">
                                <p
                                  className="my-1 fw-bold"
                                  role="button"
                                  style={{ fontSize: '10px', color: '#c58c4f' }}
                                  onClick={() => setPsGLModal(true)}
                                >
                                  Change
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-1">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      Stock Take CALS
                    </label>
                    <div className="col-md ps-1">
                      <div className="row">
                        <div className="col">
                          <input
                            type="text"
                            name="psStockTakeCals"
                            id="psStockTakeCals"
                            value={data.psStockTakeCals}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            disabled
                            readOnly
                          />
                        </div>
                        <div className="col">
                          <div className="row">
                            <label htmlFor="branchCode" className="col-3 col-form-label divider">
                              From
                            </label>
                            <div className="col ps-0">
                              <input
                                type="text"
                                name="psStockTakeStartDate"
                                id="psStockTakeStartDate"
                                value={
                                  !data.psStockTakeStartDate
                                    ? ''
                                    : moment(data.psStockTakeStartDate).format('DD/MM/YYYY')
                                }
                                className="form-control form-control-sm rounded-0 fw-medium"
                                disabled
                                readOnly
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col">
                          <div className="row">
                            <label htmlFor="branchCode" className="col-3 col-form-label divider">
                              To
                            </label>
                            <div className="col ps-0">
                              <input
                                type="text"
                                name="stockTakeEndDate"
                                id="stockTakeEndDate"
                                value={
                                  !data.stockTakeEndDate
                                    ? ''
                                    : moment(data.stockTakeEndDate).format('DD/MM/YYYY')
                                }
                                className="form-control form-control-sm rounded-0 fw-medium"
                                disabled
                                readOnly
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <p
                      className="my-1 fw-bold"
                      role="button"
                      style={{ fontSize: '10px', color: '#c58c4f' }}
                      onClick={() => setStockTakeCALSModal(true)}
                    >
                      Change
                    </p>
                  </div>
                  <hr className="mb-3 mt-1" />
                  <div className="row mb-1">
                    <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                      Add Ons
                    </label>
                    {/* One row per add-on rather than per grant. */}
                    <div className="col-md ps-1">
                      {(data.addOnCoverage ?? []).length === 0 ? (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          No add-ons on this client.
                        </span>
                      ) : (
                        <ul className="list-group list-group-flush">
                          {data.addOnCoverage.map((a) => (
                            <li
                              className="list-group-item py-1 d-flex justify-content-between align-items-center"
                              key={a.addonId}
                            >
                              <span className="fw-bold">
                                {a.addonName}
                                {a.fullyExpired && (
                                  <span className="badge bg-danger ms-2">Expired</span>
                                )}
                                {!a.fullyExpired && a.branchesExpired > 0 && (
                                  <span className="badge bg-warning text-dark ms-2">
                                    {a.branchesExpired} expired
                                  </span>
                                )}
                              </span>
                              <span className="text-muted" style={{ fontSize: 10 }}>
                                {a.allBranches
                                  ? `all ${a.branchesTotal} branches`
                                  : `${a.branchesGranted} of ${a.branchesTotal} branches`}
                                {' · '}
                                {a.mixedExpiry
                                  ? `mixed expiry${
                                      a.earliestExpiry
                                        ? `, from ${moment(a.earliestExpiry).format('DD/MM/YYYY')}`
                                        : ''
                                    }`
                                  : a.expiryDate
                                  ? `expires ${moment(a.expiryDate).format('DD/MM/YYYY')}`
                                  : 'no expiry'}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <p
                      className="my-1 fw-bold"
                      role="button"
                      style={{ fontSize: '10px', color: '#c58c4f' }}
                      onClick={() => {
                        // Always open on a clean grant form — nothing selected, no expiry.
                        setEditFormData({ ...editFormData, AddOnsArray: [], selectedAdons: [] })
                        setAddOnScope('all')
                        setAddOnExpiry(null)
                        setExpiryEdit(null)
                        setAddOnsModal(true)
                      }}
                    >
                      Change
                    </p>
                  </div>
                  {/* COMPANY-WIDE SWITCHES — one row each in the client's own databases, so there is
                      no per-branch copy that could disagree. Read live from the hosting server. */}
                  <hr className="my-3" />
                  <div className="row mb-1">
                    <label className="col-md-3 col-form-label divider">Company Settings</label>
                    <div className="col-md ps-1">
                      {!companySettings ? (
                        <span className="text-muted" style={{ fontSize: 11 }}>
                          Reading from the client&apos;s database…
                        </span>
                      ) : companySettings.unavailable ? (
                        <div
                          className="alert alert-warning rounded-0 py-1 px-2 mb-0"
                          style={{ fontSize: 11 }}
                        >
                          {companySettings.unavailable}
                        </div>
                      ) : (
                        COMPANY_SETTING_FIELDS.map((f) => (
                          <div className="form-check" key={f.key}>
                            <input
                              className="form-check-input"
                              type="checkbox"
                              checked={companySettings[f.key] === true}
                              name={`view-${f.key}`}
                              id={`view-${f.key}`}
                              readOnly
                              disabled
                            />
                            <label className="form-check-label fw-bold" htmlFor={`view-${f.key}`}>
                              {f.label}
                              {companySettings[f.key] === null && (
                                <span className="text-muted fw-normal">
                                  {' '}
                                  — not present in this database
                                </span>
                              )}
                            </label>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    {companySettings && !companySettings.unavailable && (
                      <p
                        className="my-1 fw-bold"
                        role="button"
                        style={{ fontSize: '10px', color: '#c58c4f' }}
                        onClick={() => {
                          setCompanySettingsForm({
                            enablePackages: companySettings.enablePackages === true,
                            lockUserCount: companySettings.lockUserCount === true,
                            maltiusersLogin: companySettings.maltiusersLogin === true,
                          })
                          setCompanySettingsModal(true)
                        }}
                      >
                        Change
                      </p>
                    )}
                  </div>
                  <hr className="my-3" />
                </form>
              </div>
            </div>
          </div>
        )}
        {activeTab === 'branch' && (
          <div className="col-md">
            <div className="card h-100 rounded-0" style={{ borderTopLeftRadius: 0 }}>
              <div className="card-body">
                <div className="d-flex justify-content-between">
                  <p className="mb-0 fw-bold align-self-end" style={{ fontSize: '11px' }}>
                    Branch Level — applies to this branch only
                  </p>
                  <p className="m-0 fw-bold" style={{ fontSize: '11px' }}>
                    Status:{' '}
                    <span className={data.psActivated ? 'text-success' : 'text-danger'}>
                      {data.psActivated ? 'Active' : 'Not Active'}
                    </span>
                    {data.archived && <span className="text-danger ms-2">• Archived</span>}
                  </p>
                </div>
                <hr className="mt-1 mb-2" />
                <form autoComplete="off">
                  <div className="row my-3">
                    <label
                      htmlFor="branchCodeBranchTab"
                      className="col-md-3 col-form-label divider"
                    >
                      Branch
                    </label>
                    <div className="col-md ps-1">
                      <div className="row">
                        <div className="col pe-0">
                          <input
                            type="text"
                            name="branchCodeBranchTab"
                            id="branchCodeBranchTab"
                            value={data.branchCode}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            disabled
                            readOnly
                          />
                        </div>
                        <div className="col-8 ps-0">
                          <input
                            type="text"
                            name="psBranchNameBranchTab"
                            id="psBranchNameBranchTab"
                            value={data.psBranchName}
                            className="form-control form-control-sm rounded-0 fw-medium"
                            readOnly
                            disabled
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                  <hr className="mb-3 mt-1" />
                  {/* Region -> County -> Town for this branch. */}
                  <div className="row mb-1">
                    <label htmlFor="regionId" className="col-md-3 col-form-label divider">
                      Location
                    </label>
                    <div className="col-md ps-1">
                      <div className="row g-1">
                        <div className="col-md-4">
                          <SearchableSelect
                            options={regionOpts}
                            value={loc.regionId}
                            onChange={(v) => onRegionChange(v)}
                            getId={(o) => o.regionId}
                            getLabel={(o) => o.name}
                            placeholder="Search region…"
                          />
                        </div>
                        <div className="col-md-4">
                          <SearchableSelect
                            options={countyOpts}
                            value={loc.countyId}
                            onChange={(v) => onCountyChange(v)}
                            getId={(o) => o.countyId}
                            getLabel={(o) => o.name}
                            placeholder="Search county…"
                            disabled={!loc.regionId}
                          />
                        </div>
                        <div className="col-md-4">
                          <SearchableSelect
                            options={townOpts}
                            value={loc.townId}
                            onChange={(v) => setLoc((p) => ({ ...p, townId: v }))}
                            getId={(o) => o.townId}
                            getLabel={(o) => o.name}
                            placeholder="Search town…"
                            disabled={!loc.countyId}
                          />
                        </div>
                      </div>
                      <div className="d-flex align-items-center gap-2 mt-1">
                        <button
                          type="button"
                          className="btn btn-sm add-btn rounded-0"
                          onClick={saveLocation}
                          disabled={locSaving || data.psCusCode === ''}
                        >
                          {locSaving ? 'Saving…' : 'Save Location'}
                        </button>
                        {locMsg && <span className="text-success">{locMsg}</span>}
                      </div>
                    </div>
                  </div>
                  <hr className="mb-3 mt-3" />

                  {/* BRANCH EXPIRY. Separate from the company-wide date on the other tab. */}
                  <div className="row mb-1">
                    <label className="col-md-3 col-form-label divider">Licence expires</label>
                    <div className="col-md ps-1">
                      {(() => {
                        const mine = thisBranchExpiry()
                        const peers = invoiceGroupPeers()

                        // A grace date equal to the licence date is not an extension.
                        const grace =
                          mine?.temporaryExpiry && mine.temporaryExpiry !== mine.licenceExpiry
                            ? moment(mine.temporaryExpiry).format('DD/MM/YYYY')
                            : null

                        return (
                          <>
                            <span className="fw-bold" style={{ fontSize: 12 }}>
                              {mine?.licenceExpiry
                                ? moment(mine.licenceExpiry).format('DD/MM/YYYY')
                                : '—'}
                            </span>
                            {grace && (
                              <span className="d-block text-muted" style={{ fontSize: 10 }}>
                                Grace period runs to {grace}.
                              </span>
                            )}
                            {/* Only claimed when the company-wide list is actually loaded. */}
                            {(data?.branchExpiries ?? []).length > 0 && (
                              <span className="d-block text-muted" style={{ fontSize: 10 }}>
                                {peers.length > 0
                                  ? `Invoiced together with ${peers
                                      .map((b) => b.branchName || `branch ${b.branchCode}`)
                                      .join(', ')} — they share this date.`
                                  : 'Invoiced on its own — no other branch shares this date.'}
                              </span>
                            )}
                          </>
                        )
                      })()}
                    </div>
                  </div>

                  {branchExpiryEdit ? (
                    <div className="row mb-1">
                      <label htmlFor="branchExpiry" className="col-md-3 col-form-label divider">
                        New expiry
                      </label>
                      <div className="col-md ps-1">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <DatePicker
                            id="branchExpiry"
                            selected={branchExpiryDate}
                            onChange={(d) => setBranchExpiryDate(d)}
                            dateFormat="dd/MM/yyyy"
                            placeholderText="dd/mm/yyyy"
                            className="form-control form-control-sm rounded-0"
                          />
                          <button
                            type="button"
                            className="btn btn-sm add-btn rounded-0"
                            disabled={isLoading}
                            onClick={saveBranchExpiry}
                          >
                            Save expiry
                          </button>
                          <button
                            type="button"
                            className="btn btn-sm cancel-btn rounded-0"
                            disabled={isLoading}
                            onClick={() => setBranchExpiryEdit(false)}
                          >
                            Cancel
                          </button>
                        </div>
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          This branch only. It moves the branch onto the invoice for that date —
                          joining the branches already on it, or onto one of its own.
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="row mb-1">
                      <label className="col-md-3 col-form-label divider">Grace extension</label>
                      <div className="col-md ps-1">
                        <div className="d-flex flex-wrap align-items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            className="form-control form-control-sm rounded-0"
                            style={{ width: 110 }}
                            placeholder="days"
                            value={branchTempDays}
                            onChange={(e) => setBranchTempDays(e.target.value)}
                            aria-label="Grace extension days for this branch"
                          />
                          <button
                            type="button"
                            className="btn btn-sm edit-btn rounded-0"
                            disabled={isLoading || !branchTempDays}
                            onClick={saveBranchTempDays}
                          >
                            Extend
                          </button>
                        </div>
                        <div className="text-muted" style={{ fontSize: 10 }}>
                          Counted from this branch&apos;s own expiry. Moves the grace date only, so
                          the branch stays on the same invoice.
                        </div>
                      </div>
                    </div>
                  )}

                  {!branchExpiryEdit && (
                    <div className="d-flex justify-content-end">
                      <p
                        className="my-1 fw-bold"
                        role="button"
                        style={{ fontSize: '10px', color: '#c58c4f' }}
                        onClick={() => {
                          const mine = thisBranchExpiry()
                          setBranchExpiryDate(
                            mine?.licenceExpiry ? new Date(mine.licenceExpiry) : null,
                          )
                          setBranchExpiryEdit(true)
                        }}
                      >
                        Change expiry
                      </p>
                    </div>
                  )}

                  <hr className="mb-3 mt-3" />
                  {/* Per-branch activation and archival. */}
                  <div className="row mb-1">
                    <label htmlFor="branchActiveView" className="col-md-3 col-form-label divider">
                      Is Active
                    </label>
                    <div className="col-md ps-1">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={data.psActivated}
                          name="branchActiveView"
                          id="branchActiveView"
                          readOnly
                          disabled
                        />
                        <label
                          className={
                            data.psActivated
                              ? 'form-check-label text-success fw-bold'
                              : 'form-check-label text-danger fw-bold'
                          }
                          htmlFor="branchActiveView"
                        >
                          {data.psActivated ? 'Is Active' : 'Not Active'}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="row mb-1">
                    <label htmlFor="branchArchivedView" className="col-md-3 col-form-label divider">
                      Archived
                    </label>
                    <div className="col-md ps-1">
                      <div className="form-check">
                        <input
                          className="form-check-input"
                          type="checkbox"
                          checked={data.archived}
                          name="branchArchivedView"
                          id="branchArchivedView"
                          readOnly
                          disabled
                        />
                        <label
                          className={
                            data.archived
                              ? 'form-check-label text-danger fw-bold'
                              : 'form-check-label fw-bold'
                          }
                          htmlFor="branchArchivedView"
                        >
                          {data.archived ? 'Archived' : 'Not Archived'}
                        </label>
                      </div>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <p
                      className="my-1 fw-bold"
                      role="button"
                      style={{ fontSize: '10px', color: '#c58c4f' }}
                      onClick={() => {
                        setBranchStatusForm({
                          isActive: data.psActivated,
                          archived: data.archived,
                        })
                        setBranchStatusModal(true)
                      }}
                    >
                      Change
                    </p>
                  </div>
                  <hr className="my-3" />
                </form>
              </div>
            </div>
          </div>
        )}
        <div className="col-md-3">
          <div className="card h-100 rounded-0">
            <div className="card-body p-2">
              <p className="fw-bold mb-0 text-center" style={{ fontSize: '11px' }}>
                Client Details Summary
              </p>
              <hr className="my-1" />
              <ul className="list-group list-group-flush" style={{ fontSize: '10px' }}>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold ">CPU</span>
                  <span>{data.psPickCpu}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold ">BIOS</span>
                  <span>{data.psPickBios}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold ">Hard Disk</span>
                  <span>{data.psPickHdd}</span>
                </li>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold">Company</span>
                  <span>
                    {data.psPickCompany} - {data.psPickBcode}
                  </span>
                </li>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold">Last Service Date</span>
                  <span>
                    <Moment format="DD/MM/YYYY">{data.pickDate}</Moment>
                  </span>
                </li>
                <li className="list-group-item d-flex justify-content-between">
                  <span className="fw-bold">All Users</span>
                  <span className="fw-bold">{totalUsers}</span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Client Modal */}
      <CModal alignment="center" visible={clientModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Client Name</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateClientDetails}>
            <div className="row mb-3">
              <label htmlFor="queryAcctCode" className="col-md-3 col-form-label divider">
                Acct Code
              </label>
              <div className="col-md ps-1">
                {/* The account code is the join key to the serials, add-ons, provisioning runs. */}
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  id="queryAcctCode"
                  name="queryAcctCode"
                  value={editFormData.queryAcctCode}
                  disabled
                  readOnly
                />
              </div>
            </div>
            <div className="row mb-3">
              <label htmlFor="queryAcctName" className="col-md-3 col-form-label divider">
                Client Name
              </label>
              <div className="col-md ps-1">
                <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  id="queryAcctName"
                  name="queryAcctName"
                  value={editFormData.queryAcctName ?? ''}
                  minLength={2}
                  maxLength={50}
                  required
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, queryAcctName: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="alert alert-light border rounded-0 py-1 mb-2" style={{ fontSize: 11 }}>
              Renaming applies to all {data.branchCount || 0} branch
              {data.branchCount === 1 ? '' : 'es'} and also updates the client database
              (SYSDEFAULTS) and the company record. Saving an unchanged name does nothing.
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={
                  isLoading ||
                  !editFormData.queryAcctName ||
                  editFormData.queryAcctName.trim() === (data.psCompanyName ?? '').trim()
                }
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => setClientModal(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Serial Modal */}
      <CModal alignment="center" visible={serialModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Serial No</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateSerialsDetails}>
            <div className="row mb-3">
              <div className="col-md">
                <div className="row">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Serial No
                  </label>
                  <div className="col-md ps-1">
                    <select
                      className="form-select form-select-sm rounded-0"
                      aria-label="Default select example"
                      style={{
                        appearance: 'none',
                      }}
                      id="querySerialNo"
                      name="querySerialNo"
                      value={editFormData.querySerialNo}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, querySerialNo: e.target.value })
                      }
                      disabled={
                        (!editFormData.queryAcctCode ||
                          !editFormData.queryBranchCode ||
                          data.psSerialNo) &&
                        data.psSerialNo.length > 15
                      }
                    >
                      <option value={data.psSerialNo}>{data.psSerialNo}</option>
                      {[serialNo].map((serial, index) => (
                        <option key={index} value={serial.serialId}>
                          {serial.serialId}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
              <div className="col-md">
                <div className="row">
                  <label htmlFor="nonregistered" className="col-md-3 col-form-label"></label>
                  {/* Is Active and Archived sit together. */}
                  <div className="col-md ps-1 d-flex gap-3">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={editFormData.isActive}
                        name="blocked"
                        id="blocked"
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, isActive: e.target.checked })
                        }
                      />
                      {/* form-check-label */}
                      <label
                        className={
                          editFormData.isActive
                            ? 'form-check-label text-success fw-bold'
                            : 'form-check-label text-danger fw-bold'
                        }
                        htmlFor="blocked"
                      >
                        {editFormData.isActive ? 'Is Active' : 'Not Active'}
                      </label>
                    </div>
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={editFormData.archived}
                        name="archived"
                        id="archived"
                        onChange={(e) =>
                          setEditFormData({ ...editFormData, archived: e.target.checked })
                        }
                      />
                      <label
                        className={
                          editFormData.archived
                            ? 'form-check-label text-danger fw-bold'
                            : 'form-check-label fw-bold'
                        }
                        htmlFor="archived"
                      >
                        {editFormData.archived ? 'Archived' : 'Not Archived'}
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            {/* Both flags here are company level. */}
            <div
              className={`alert ${
                !editFormData.isActive || editFormData.archived
                  ? 'alert-warning'
                  : 'alert-light border'
              } rounded-0 py-1 mb-3`}
              style={{ fontSize: 11 }}
            >
              <CIcon icon={cilWarning} size="sm" className="me-2" />
              <strong>
                Applies to all {data.branchCount || 0} branch
                {data.branchCount === 1 ? '' : 'es'}.
              </strong>{' '}
              {editFormData.isActive
                ? 'Every branch will be activated, including any that are currently switched off.'
                : 'Every branch will be deactivated — the whole client loses access, not just this branch.'}{' '}
              {editFormData.archived !== data.companyArchived &&
                (editFormData.archived
                  ? 'Every branch will also be archived. '
                  : 'Every branch will also be un-archived. ')}
              Archiving is separate from Is Active. To change one branch only, use the Branch Level
              tab.
            </div>
            <div className="row mb-3">
              <div className="col-md">
                <div className="row">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Expiry
                  </label>
                  <div className="col-md ps-1">
                    <DatePicker
                      className="form-control form-control-sm rounded-0"
                      selected={editFormData.queryExpiryDate}
                      dateFormat="dd/MM/yyyy"
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      onChange={(date) => handleDate(date)}
                      required
                    />

                    {/* WHAT THIS SAVE WILL RESET. */}
                    {branchesOffCompanyDate().length > 0 && (
                      <div className="callout-note mt-2">
                        <strong>
                          {branchesOffCompanyDate().length} branch(es) are on their own expiry and
                          will be reset to this date:
                        </strong>
                        <span className="d-block mt-1">
                          {branchesOffCompanyDate()
                            .map(
                              (b) =>
                                `${b.branchName || `Branch ${b.branchCode}`} (${
                                  b.licenceExpiry
                                    ? moment(b.licenceExpiry).format('DD/MM/YYYY')
                                    : 'no date'
                                })`,
                            )
                            .join(', ')}
                        </span>
                        <span className="d-block mt-1">
                          Set a branch&apos;s own date on its Branch Level tab instead.
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="col-md">
                <div className="row">
                  <label htmlFor="branchCode" className="col-3 col-form-label divider">
                    Days
                  </label>
                  <div className="col-md ps-1">
                    <input
                      type="number"
                      name="queryDays"
                      id="queryDays"
                      value={editFormData.queryDays}
                      className="form-control form-control-sm rounded-0"
                      onChange={handleDay}
                    />
                  </div>
                </div>
              </div>
            </div>
            <hr />
            {/* Temporary expiry — a short grace extension before the client pays. */}
            <label className="col-form-label divider fw-semibold p-0 mb-1">
              Temporary Extension
            </label>
            <div className="row mb-2">
              <div className="col-md">
                <div className="row">
                  <label htmlFor="tempDate" className="col-md-3 col-form-label divider">
                    Temp Expiry
                  </label>
                  <div className="col-md ps-1">
                    <DatePicker
                      className="form-control form-control-sm rounded-0"
                      selected={tempDate}
                      dateFormat="dd/MM/yyyy"
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      minDate={new Date()}
                      onChange={(date) => handleTempDate(date)}
                    />
                  </div>
                </div>
              </div>
              <div className="col-md">
                <div className="row">
                  <label htmlFor="tempDays" className="col-3 col-form-label divider">
                    Days
                  </label>
                  <div className="col-md ps-1">
                    <input
                      type="number"
                      name="tempDays"
                      id="tempDays"
                      min={1}
                      value={tempDays}
                      className="form-control form-control-sm rounded-0"
                      onChange={handleTempDay}
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex align-items-center gap-2 mb-1">
              <span className="text-muted" style={{ fontSize: 12 }}>
                {Number(tempDays) > 0 ? (
                  <>
                    → new temp expiry:{' '}
                    <span className="fw-bold text-body">
                      {moment().add(Number(tempDays), 'days').format('DD/MM/YYYY')}
                    </span>
                  </>
                ) : (
                  'enter a date or days'
                )}
              </span>
              <button
                type="button"
                className="btn filter-btn btn-sm rounded-0 ms-auto"
                disabled={isLoading || !tempDays || Number(tempDays) <= 0}
                onClick={UpdateTemporaryDate}
              >
                {isLoading ? (
                  <span
                    className="spinner-border spinner-border-sm"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  'Extend temporarily'
                )}
              </button>
            </div>
            <div className="form-text" style={{ fontSize: 11 }}>
              A short grace period before payment — applied to all branches.
              {data.psTemporaryActivateExpiryDate
                ? ` Current temporary expiry: ${moment(data.psTemporaryActivateExpiryDate).format(
                    'DD/MM/YYYY',
                  )}.`
                : ' No temporary extension set.'}
            </div>
            <hr />
            <div className="d-flex justify-content-end gap-2">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0"
                style={{ width: '4rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setSerialModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* User CALS Modal */}
      <CModal alignment="center" visible={userCALSModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update User CALS</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateUserCals}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                User CALS
              </label>
              <div className="col-md ps-1">
                <input
                  type="number"
                  name="queryUserCount"
                  id="queryUserCount"
                  value={editFormData.queryUserCount}
                  className="form-control form-control-sm rounded-0"
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, queryUserCount: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setUserCALSModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* BedCount Modal */}
      <CModal alignment="center" visible={psBedCountModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Bed Count</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateBedCount}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Bed Count
              </label>
              <div className="col-md ps-1">
                <input
                  type="number"
                  name="psBedCount"
                  id="psBedCount"
                  value={editFormData.psBedCount}
                  className="form-control form-control-sm rounded-0"
                  onChange={(e) => setEditFormData({ ...editFormData, psBedCount: e.target.value })}
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setPsBedCountModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* GL Modal */}
      <CModal alignment="center" visible={psGLModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update GL</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateGL}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                GL
              </label>
              <div className="col-md ps-1">
                <input
                  type="text"
                  name="psGL"
                  id="psGL"
                  list="GLdatalistOptions"
                  value={editFormData.psGL}
                  className="form-control form-control-sm rounded-0"
                  onChange={(e) => setEditFormData({ ...editFormData, psGL: e.target.value })}
                />
                <datalist id="GLdatalistOptions">
                  <option value={''}></option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </datalist>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setPsGLModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Branch CALS Modal */}
      <CModal alignment="center" visible={branchCALSModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Branch CALS</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateBranchCals}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Branch CALS
              </label>
              <div className="col-md ps-1">
                <input
                  type="number"
                  name="queryBranchCount"
                  id="queryBranchCount"
                  value={editFormData.queryBranchCount}
                  className="form-control form-control-sm rounded-0"
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, queryBranchCount: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={data.editModalInterface === 0}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setBranchCALSModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Stock Take CALS */}
      <CModal alignment="center" visible={stockTakeCALSModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Stock Takes CALS</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div
              className="alert alert-danger d-flex align-items-center mx-0 mb-2 rounded-0"
              role="alert"
            >
              <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
              <span>{error}</span>
            </div>
          )}
          <form autoComplete="off" onSubmit={UpdateStockTakeCals}>
            <div className="row mb-3">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Stock Take CALS
              </label>
              <div className="col-md ps-1">
                <input
                  type="number"
                  name="queryStockTakeCals"
                  id="queryStockTakeCals"
                  value={editFormData.queryStockTakeCals}
                  className="form-control form-control-sm rounded-0"
                  required
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, queryStockTakeCals: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="row mb-3">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Stock Dates
              </label>
              <div className="col-md ps-1">
                <div className="row">
                  <div className="col-6">
                    <DatePicker
                      className="form-control form-control-sm rounded-0"
                      selected={editFormData.queryStockTakeStartDate}
                      dateFormat="dd/MM/yyyy"
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      onChange={(date) =>
                        setEditFormData({ ...editFormData, queryStockTakeStartDate: date })
                      }
                      required
                    />
                  </div>
                  <div className="col-6">
                    <div className="row">
                      <label htmlFor="branchCode" className="col-3 col-form-label divider">
                        To
                      </label>
                      <div className="col ps-0">
                        <DatePicker
                          className="form-control form-control-sm rounded-0"
                          selected={editFormData.queryStockTakeEndDate}
                          dateFormat="dd/MM/yyyy"
                          peekNextMonth
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          onChange={(date) =>
                            setEditFormData({ ...editFormData, queryStockTakeEndDate: date })
                          }
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={data.editModalInterface === 0}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setStockTakeCALSModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Add Ons — grants are per branch, so every change picks a scope and an optional expiry */}
      <CModal alignment="center" visible={addOnsModal} backdrop="static" size="lg">
        <CModalHeader>
          <CModalTitle>Update Add Ons</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateAddsOn}>
            {error && (
              <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
                <span> {error} </span>
              </div>
            )}

            {/* Current grants, with what they cover and when they lapse. */}
            <label className="col-form-label divider fw-semibold p-0 mb-1">Current Add Ons</label>
            {(data.addOnCoverage ?? []).length === 0 ? (
              <div className="text-muted mb-3" style={{ fontSize: 11 }}>
                None granted yet.
              </div>
            ) : (
              <table className="table table-sm mb-3" style={{ fontSize: 11 }}>
                <thead>
                  <tr>
                    <th>Add On</th>
                    <th>Coverage</th>
                    <th>Expiry</th>
                    <th className="text-end">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.addOnCoverage.map((a) => (
                    // Highlight the row the expiry panel below is currently editing.
                    <tr
                      key={a.addonId}
                      className={expiryEdit?.addonId === a.addonId ? 'table-active' : ''}
                    >
                      <td className="fw-bold align-middle">
                        {a.addonName}
                        {a.fullyExpired && <span className="badge bg-danger ms-2">Expired</span>}
                        {!a.fullyExpired && a.branchesExpired > 0 && (
                          <span className="badge bg-warning text-dark ms-2">
                            {a.branchesExpired} expired
                          </span>
                        )}
                      </td>
                      <td className="align-middle">
                        {a.allBranches
                          ? `all ${a.branchesTotal}`
                          : `${a.branchesGranted} of ${a.branchesTotal}`}
                        {a.onThisBranch ? '' : ' (not this branch)'}
                      </td>
                      <td className="align-middle">
                        {a.mixedExpiry
                          ? 'mixed'
                          : a.expiryDate
                          ? moment(a.expiryDate).format('DD/MM/YYYY')
                          : 'never'}
                      </td>
                      {/* Fixed-width buttons so every row's actions line up. */}
                      <td className="text-end align-middle text-nowrap">
                        <button
                          type="button"
                          className={`btn btn-sm rounded-0 me-2 ${
                            expiryEdit?.addonId === a.addonId
                              ? 'btn-secondary'
                              : 'btn-outline-secondary'
                          }`}
                          style={addOnActionStyle}
                          disabled={isLoading}
                          title="Change or extend the expiry date"
                          onClick={() =>
                            expiryEdit?.addonId === a.addonId
                              ? setExpiryEdit(null)
                              : openExpiryEdit(a)
                          }
                        >
                          <CIcon icon={cilCalendar} size="sm" className="me-1" />
                          Date
                        </button>
                        <div
                          className="btn-group btn-group-sm"
                          role="group"
                          aria-label={`Remove ${a.addonName}`}
                        >
                          <button
                            type="button"
                            className="btn btn-outline-danger rounded-0"
                            style={addOnActionStyle}
                            disabled={isLoading || !a.onThisBranch}
                            title={
                              a.onThisBranch
                                ? `Remove from branch ${data.branchCode} only`
                                : 'This branch does not hold this add-on'
                            }
                            onClick={() => DeleteAddsOn(a.addonId, false)}
                          >
                            <CIcon icon={cilTrash} size="sm" className="me-1" />
                            Branch
                          </button>
                          <button
                            type="button"
                            className="btn btn-outline-danger rounded-0"
                            style={addOnActionStyle}
                            disabled={isLoading}
                            title="Remove from every branch"
                            onClick={() => DeleteAddsOn(a.addonId, true)}
                          >
                            <CIcon icon={cilTrash} size="sm" className="me-1" />
                            All
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* Expiry editor for an add-on already granted. */}
            {expiryEdit && (
              <div className="border rounded-0 p-2 mb-3 bg-light">
                <div className="d-flex justify-content-between align-items-center mb-2">
                  <span className="fw-bold" style={{ fontSize: 11 }}>
                    Change expiry — {expiryEdit.addonName}
                  </span>
                  <span className="text-muted" style={{ fontSize: 10 }}>
                    currently{' '}
                    {expiryEdit.mixedExpiry
                      ? `mixed across branches${
                          expiryEdit.earliestExpiry
                            ? `, earliest ${moment(expiryEdit.earliestExpiry).format('DD/MM/YYYY')}`
                            : ''
                        }`
                      : expiryEdit.expiryDate
                      ? moment(expiryEdit.expiryDate).format('DD/MM/YYYY')
                      : 'never expires'}
                  </span>
                </div>
                {/* All three controls on one line, each with a plain stacked label. */}
                <div className="row g-2 align-items-end">
                  <div className="col-md-4">
                    <label htmlFor="extendDate" className="form-label mb-1 d-block">
                      New expiry
                    </label>
                    <DatePicker
                      id="extendDate"
                      className="form-control form-control-sm rounded-0"
                      // The datepicker's own wrapper is inline-block.
                      wrapperClassName="w-100"
                      selected={extendDate}
                      dateFormat="dd/MM/yyyy"
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      minDate={new Date()}
                      placeholderText="pick a date"
                      onChange={(date) => onExtendDate(date)}
                    />
                  </div>
                  <div className="col-md-2">
                    <label htmlFor="extendDays" className="form-label mb-1 d-block">
                      or Days
                    </label>
                    <input
                      id="extendDays"
                      type="number"
                      min={1}
                      value={extendDays}
                      placeholder="0"
                      className="form-control form-control-sm rounded-0"
                      onChange={onExtendDays}
                    />
                  </div>
                  <div className="col-md-4">
                    <label htmlFor="extendScope" className="form-label mb-1 d-block">
                      Apply to
                    </label>
                    <select
                      id="extendScope"
                      className="form-select form-select-sm rounded-0"
                      value={extendScope}
                      onChange={(e) => setExtendScope(e.target.value)}
                    >
                      <option value="all">All branches holding it</option>
                      <option value="branch">This branch only — {data.branchCode}</option>
                    </select>
                  </div>
                  <div className="col-md-2 d-flex gap-1">
                    <button
                      type="button"
                      className="btn btn-sm add-btn rounded-0 flex-fill"
                      disabled={isLoading || (!extendDate && !(Number(extendDays) > 0))}
                      onClick={SaveAddOnExpiry}
                    >
                      {isLoading ? (
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        ></span>
                      ) : (
                        'Save'
                      )}
                    </button>
                    <button
                      type="button"
                      className="btn btn-sm cancel-btn rounded-0"
                      title="Cancel"
                      onClick={() => setExpiryEdit(null)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
                <div className="mt-2" style={{ fontSize: 10 }}>
                  {Number(extendDays) > 0 ? (
                    expiryEdit.mixedExpiry ? (
                      <span className="text-body">
                        Each branch moves forward{' '}
                        <span className="fw-bold">{extendDays} day(s)</span> from its own expiry, so
                        branches on different dates stay that way.
                      </span>
                    ) : (
                      <span className="text-body">
                        → new expiry{' '}
                        <span className="fw-bold">{moment(extendDate).format('DD/MM/YYYY')}</span>
                        <span className="text-muted">
                          {' '}
                          ({extendDays} day(s) from{' '}
                          {extendBaseline(expiryEdit).isSame(moment().startOf('day'))
                            ? 'today — the current expiry has already passed'
                            : 'the current expiry'}
                          )
                        </span>
                      </span>
                    )
                  ) : extendDate ? (
                    <span className="text-body">
                      → new expiry{' '}
                      <span className="fw-bold">{moment(extendDate).format('DD/MM/YYYY')}</span>
                      {/* Pulling a date back is allowed. */}
                      {shortensBy() > 0 && (
                        <span className="text-danger">
                          {' '}
                          — {shortensBy()} day(s) EARLIER than now, so {expiryEdit.addonName} stops
                          sooner
                        </span>
                      )}
                    </span>
                  ) : (
                    <span className="text-muted">Pick a date or enter a number of days.</span>
                  )}
                </div>
              </div>
            )}

            <hr />
            <label className="col-form-label divider fw-semibold p-0 mb-1">Grant Add Ons</label>
            <div className="row mb-2">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Add Ons
              </label>
              <div className="col-md ps-1">
                <Multiselect
                  closeIcon={''}
                  className="rounded-0"
                  options={addOns}
                  selectedValues={editFormData.AddOnsArray} // starts empty — see the Change handler
                  onSelect={onAddOnPick}
                  onRemove={onAddOnPick}
                  displayValue="addonName"
                  showCheckbox
                />
              </div>
            </div>
            <div className="row mb-2">
              <label className="col-md-3 col-form-label divider">Apply to</label>
              <div className="col-md ps-1">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="addOnScope"
                    id="addOnScopeAll"
                    checked={addOnScope === 'all'}
                    onChange={() => setAddOnScope('all')}
                  />
                  <label className="form-check-label" htmlFor="addOnScopeAll">
                    All {data.branchCount || 0} branch{data.branchCount === 1 ? '' : 'es'}
                  </label>
                </div>
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="radio"
                    name="addOnScope"
                    id="addOnScopeBranch"
                    checked={addOnScope === 'branch'}
                    onChange={() => setAddOnScope('branch')}
                  />
                  <label className="form-check-label" htmlFor="addOnScopeBranch">
                    This branch only — {data.branchCode} ({data.psBranchName})
                  </label>
                </div>
              </div>
            </div>
            <div className="row mb-2">
              <label htmlFor="addOnExpiry" className="col-md-3 col-form-label divider">
                Expires
              </label>
              <div className="col-md ps-1">
                <DatePicker
                  className="form-control form-control-sm rounded-0"
                  wrapperClassName="w-100"
                  selected={addOnExpiry}
                  dateFormat="dd/MM/yyyy"
                  peekNextMonth
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  minDate={new Date()}
                  placeholderText="never expires"
                  isClearable
                  onChange={(date) => setAddOnExpiry(date)}
                />
                <div className="form-text" style={{ fontSize: 11 }}>
                  Leave blank to never expire. Once past, the add-on stops being licensed and the
                  feature switches off — re-granting with a later date turns it back on.
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={
                  isLoading ||
                  !editFormData.selectedAdons ||
                  editFormData.selectedAdons.length === 0
                }
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setAddOnsModal(false)
                  setError('')
                  setAddOnScope('all')
                  setAddOnExpiry(null)
                  setExpiryEdit(null)
                  setEditFormData({
                    ...editFormData,
                    queryAddOns: [],
                    AddOnsArray: [],
                    selectedAdons: [],
                  })
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Is Active + Archived — branch level (this branch only) */}
      <CModal alignment="center" visible={branchStatusModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Update Branch Status</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
              <span> {error} </span>
            </div>
          )}
          <form autoComplete="off" onSubmit={SaveBranchStatus}>
            <div className="row mb-2">
              <label htmlFor="branchActiveEdit" className="col-md-3 col-form-label divider">
                Is Active
              </label>
              <div className="col-md ps-1">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={branchStatusForm.isActive}
                    name="branchActiveEdit"
                    id="branchActiveEdit"
                    onChange={(e) =>
                      setBranchStatusForm({ ...branchStatusForm, isActive: e.target.checked })
                    }
                  />
                  <label
                    className={
                      branchStatusForm.isActive
                        ? 'form-check-label text-success fw-bold'
                        : 'form-check-label text-danger fw-bold'
                    }
                    htmlFor="branchActiveEdit"
                  >
                    {branchStatusForm.isActive ? 'Is Active' : 'Not Active'}
                  </label>
                </div>
              </div>
            </div>
            <div className="row mb-1">
              <label htmlFor="branchArchivedEdit" className="col-md-3 col-form-label divider">
                Archived
              </label>
              <div className="col-md ps-1">
                <div className="form-check">
                  <input
                    className="form-check-input"
                    type="checkbox"
                    checked={branchStatusForm.archived}
                    name="branchArchivedEdit"
                    id="branchArchivedEdit"
                    onChange={(e) =>
                      setBranchStatusForm({ ...branchStatusForm, archived: e.target.checked })
                    }
                  />
                  <label
                    className={
                      branchStatusForm.archived
                        ? 'form-check-label text-danger fw-bold'
                        : 'form-check-label fw-bold'
                    }
                    htmlFor="branchArchivedEdit"
                  >
                    {branchStatusForm.archived ? 'Archived' : 'Not Archived'}
                  </label>
                </div>
              </div>
            </div>
            <div
              className="alert alert-light border rounded-0 py-1 mb-2 mt-2"
              style={{ fontSize: 11 }}
            >
              Applies to branch <strong>{data.branchCode}</strong> ({data.psBranchName}) only —
              other branches are unaffected. Is Active also sets ENABLED on this branch in the
              client&apos;s database. Archived is separate from Is Active.
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={
                  isLoading ||
                  (branchStatusForm.isActive === data.psActivated &&
                    branchStatusForm.archived === data.archived)
                }
              >
                {isLoading ? (
                  <span
                    className="spinner-border spinner-border-sm m-auto"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  'Edit'
                )}
              </button>
              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setBranchStatusModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Company Settings Modal — every branch, by construction */}
      <CModal alignment="center" visible={companySettingsModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Company Settings</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
              <span> {error} </span>
            </div>
          )}
          <form autoComplete="off" onSubmit={SaveCompanySettings}>
            {COMPANY_SETTING_FIELDS.map((f) => (
              <div className="row mb-2" key={f.key}>
                <label htmlFor={`edit-${f.key}`} className="col-md-5 col-form-label divider">
                  {f.label}
                </label>
                <div className="col-md ps-1 align-self-center">
                  <div className="form-check">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={companySettingsForm[f.key]}
                      name={`edit-${f.key}`}
                      id={`edit-${f.key}`}
                      disabled={companySettings?.[f.key] === null}
                      onChange={(e) =>
                        setCompanySettingsForm({
                          ...companySettingsForm,
                          [f.key]: e.target.checked,
                        })
                      }
                    />
                    <label
                      className={
                        companySettingsForm[f.key]
                          ? 'form-check-label text-success fw-bold'
                          : 'form-check-label fw-bold'
                      }
                      htmlFor={`edit-${f.key}`}
                    >
                      {companySettingsForm[f.key] ? 'On' : 'Off'}
                      <span className="text-muted fw-normal"> ({f.column})</span>
                    </label>
                  </div>
                  {companySettings?.[f.key] === null && (
                    <div className="text-muted" style={{ fontSize: 11 }}>
                      This column is not present in the client&apos;s database.
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div
              className="alert alert-light border rounded-0 py-1 mb-2 mt-2"
              style={{ fontSize: 11 }}
            >
              Applies to <strong>the whole company</strong> — every branch. These live in the
              client&apos;s own database (SYSDEFAULTS) and on its hosting server (CompanyDetails),
              not in central licensing, so the change is written straight there.
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={isLoading || !companySettingsChanged()}
              >
                {isLoading ? (
                  <span
                    className="spinner-border spinner-border-sm m-auto"
                    role="status"
                    aria-hidden="true"
                  ></span>
                ) : (
                  'Edit'
                )}
              </button>
              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setCompanySettingsModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Module Modals */}
      <CModal visible={isClientModal} alignment="center" backdrop="static" scrollable>
        <CModalHeader>
          <CModalTitle>Client Modules</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
              <span> {error} </span>
            </div>
          )}
          <form autoComplete="off" onSubmit={UpdatePackage}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Client Modules
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
                          onChange={(e) =>
                            setEditFormData({ ...editFormData, packageCode: e.target.value })
                          }
                        />
                        <label className="form-check-label" htmlFor="desktop">
                          {module.description}
                        </label>
                      </span>
                    ))}
                </span>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
              >
                {isLoading ? (
                  <>
                    <span
                      className="spinner-border spinner-border-sm m-auto"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  </>
                ) : (
                  'Edit'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setIsClientModal(false)
                  setError('')
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
    </>
  )
}

export default UpdateClient
