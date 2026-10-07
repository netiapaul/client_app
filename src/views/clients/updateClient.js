import React, { useState, useEffect } from 'react'
import { getToken } from '../../utils/session'
import { useParams, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
// import MaterialTable from 'material-table'
// import { tableIcons, tableOptions } from '../../utils/helpers'
import moment from 'moment'
import Moment from 'react-moment'
import Multiselect from 'multiselect-react-dropdown'
import Chip from '@mui/material/Chip'
import SearchableSelect from '../../components/SearchableSelect'
import { toast } from 'react-toastify'
import { useBreadcrumbLabel } from '../../context/BreadcrumbContext'
// "homepage": ".",
const axios = require('axios')
const UpdateClient = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const { setLabel } = useBreadcrumbLabel()
  // const [bcode, SetBcode] = useState('')
  const [error, setError] = useState('')
  const [totalUsers, setTotalUSers] = useState(0)
  const [clientModal, setClientModal] = useState(false)
  const [isClientModal, setIsClientModal] = useState(false)
  const [serialModal, setSerialModal] = useState(false)
  const [tempDays, setTempDays] = useState('') // temporary-expiry extension (days)
  const [tempDate, setTempDate] = useState(null) // ...or pick the temp expiry date directly
  const [userCALSModal, setUserCALSModal] = useState(false)
  const [branchCALSModal, setBranchCALSModal] = useState(false)
  const [stockTakeCALSModal, setStockTakeCALSModal] = useState(false)
  const [psBedCountModal, setPsBedCountModal] = useState(false)
  const [psGLModal, setPsGLModal] = useState(false)
  const [addOnsModal, setAddOnsModal] = useState(false)
  // const [cloudModules, setCloudModules] = useState([])
  // const [modulesSelected, setModulesSelected] = useState([])
  const [packages, setPackages] = useState([])
  const [isLoading, setIsLoading] = useState(false)
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
  })
  const [editFormData, setEditFormData] = useState({
    /*** Change Details ***/
    queryAcctCode: '',
    queryAcctName: '',
    queryBranchCode: '',
    queryBranchName: '',
    /*2*/
    querySerialNo: '',
    queryExpiryDate: '',
    queryDays: '',
    psBedCount: '',
    psGL: false,
    isActive: false,
    applyToAllBranches: false,
    /*3*/
    queryUserCount: '',
    /*4*/
    queryBranchCount: '',
    /*5*/
    queryStockTakeCals: '',
    queryStockTakeStartDate: '',
    queryStockTakeEndDate: '',
    /*6*/
    queryAddOns: [],
    AddOnsArray: [],
    selectedAdons: '',
    packageCode: '',
  })
  const [customers, setCustomers] = useState([])
  const [serialNo, setSerialNo] = useState([])
  const [customerMembers, setCustomerMembers] = useState([])
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
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
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
          moduleAccess: result?.moduleAccess,
          psPickCpu: result?.clientDetails.psPickCPU,
          psPickBios: result?.clientDetails.psPickBios,
          psPickHdd: result?.clientDetails.psPickHDD,
          psPickCompany: result?.clientDetails.psPickCompany,
          psPickBcode: result?.clientDetails.psPickBcode,
          pickDate: result?.clientDetails.pickDate,
          packageCode: result?.clientDetails.packageCode,
          packageName: result?.clientDetails.packageName,
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
              : // : moment(result?.clientDetails?.psActivateExpiryDate).format('DD/MM/YYYY'),
                new Date(result?.clientDetails?.psActivateExpiryDate),
          isActive: result?.clientDetails.psActivated === '1' ? true : false,
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
          //       selectedList.forEach((item) => {
          //   data.push(item.addonId)
          // })
          // {editFormData.AddOnsArray: result?.clientAddOn.forEach((item) => {
          //   data.push(item.addonId)
          // }),
          AddOnsArray: result?.clientAddOn?.filter((item) => item !== null).map((item) => item),
          selectedAdons: result?.clientAddOn
            ?.filter((item) => item !== null)
            .map((item) => item.addonId),
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
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
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
  const getCustomers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetCustomers`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setCustomers(result)
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
  const GetSerialNumbers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
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
    } finally {
      setTimeout(() => setError(''), 10000)
    }
  }
  const getCustomerMembers = async (query) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetCustomerMembers?cusCode=${query}`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setCustomerMembers(result)
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
  //
  const handleAccounthange = (e) => {
    setEditFormData({
      ...editFormData,
      queryAcctCode: e.target.value,
      queryAcctName: customers.filter((customer) => customer.cusCode === e.target.value)[0]
        ?.cusName,
    })
    if (e.target.value !== '' || e.target.value !== null) {
      getCustomerMembers(e.target.value)
    } else {
      return false
    }
  }
  const handleBranchChange = (e) => {
    setEditFormData({
      ...editFormData,
      queryBranchCode: e.target.value,
      queryBranchName: customerMembers.filter(
        (customerMember) => customerMember.branchCode === e.target.value,
      )[0]?.branchName,
    })
    // SetBcode(
    //   customerMembers.filter((customerMember) => customerMember.branchCode === data.branchCode)[0]
    //     ?.bcode,
    // )
  }
  const UpdateClientDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateClientDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            cusCode: editFormData.queryAcctCode,
            companyName: editFormData.queryAcctName,
            branchCode: editFormData.queryBranchCode,
            branchName: editFormData.queryBranchName,
          }),
        },
      )
      if (response.ok) {
        await response.json()
        setClientModal(false)
        setIsLoading(false)
        setEditFormData({
          queryAcctCode: '',
          queryAcctName: '',
          queryBranchCode: '',
          queryBranchName: '',
        })
        GetClientDetails(id)
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
  const UpdateSerialsDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateSerialDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serialNo: editFormData.querySerialNo,
            isActive: editFormData.isActive,
            // psBedCount: editFormData.psBedCount,
            // psGL: editFormData.psGL,
            cusCode: data.psCusCode,
            branchCode: data.branchCode,
            expiryDate: moment(editFormData.queryExpiryDate).format('DD/MM/YYYY'),
            applyToAllBranches: editFormData.applyToAllBranches,
          }),
        },
      )
      if (response.ok) {
        const body = await response.json()
        // Gated by approval: the change wasn't applied — it's awaiting an approver.
        if (body?.pendingApproval) {
          setSerialModal(false)
          setIsLoading(false)
          toast.info(body.message || 'Submitted for approval — approvers have been notified.', {
            position: toast.POSITION.BOTTOM_LEFT,
            theme: 'colored',
            autoClose: 8000,
          })
          return
        }
        setSerialModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          ...editFormData,
          queryDays: '',
        })
        GetClientDetails(id)
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
      if (response.ok) {
        await response.json()
        setSerialModal(false)
        setIsLoading(false)
        setTempDays('')
        setTempDate(null)
        GetClientDetails(id)
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
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setUserCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryUserCount: '',
        })
        GetClientDetails(id)
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
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setBranchCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryBranchCount: '',
        })
        GetClientDetails(id)
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
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setPsBedCountModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          psBedCount: '',
        })
        GetClientDetails(id)
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
  const UpdateGL = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateGL?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}&psGL=${editFormData.psGL}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setPsGLModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          psGL: '',
        })
        GetClientDetails(id)
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
  const UpdateStockTakeCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateStockTakeCals?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
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
      if (response.ok) {
        await response.json()
        setStockTakeCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryStockTakeCals: '',
          queryStockTakeStartDate: '',
          queryStockTakeEndDate: '',
        })
        GetClientDetails(id)
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
  const UpdateAddsOn = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateAddsOn?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            psCusCode: data.psCusCode,
            branchCode: data.branchCode,
            addonId: editFormData.selectedAdons,
            // addonId: editFormData?.selectedAdons?.split(',').filter(function (entry) {
            //   return entry.trim() !== ''
            // }),
          }),
        },
      )
      if (response.ok) {
        await response.json()
        setAddOnsModal(false)
        setIsLoading(false)
        setEditFormData({
          ...editFormData,
          AddOnsArray: [],
          selectedAdons: '',
        })
        GetClientDetails(id)
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
  const UpdatePackage = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdatePackage?id=${id}&packagecode=${editFormData.packageCode}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setIsLoading(false)
        setIsClientModal(false)
        setEditFormData({
          ...editFormData,
          packageCode: '',
        })
        GetClientDetails(id)
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
  const DeleteAddsOn = async (addonId) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/RemoveAddons?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}&cusCode=${data.psCusCode}&branchCode=${data.branchCode}&addonId=${addonId}`,
        {
          method: 'DELETE', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        // setAddOnsModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        GetClientDetails(id)
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
  const UpdateDetails = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        navigate('/dashboard')
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
  // const UpdateClientModules = async (userData) => {
  //   setIsLoading(true)
  //   setError('')
  //   try {
  //     const response = await fetch(
  //       `${process.env.REACT_APP_URL_CONFIG}/api/Clients/UpdateClientModules?id=${id}&modulecode=${userData.modulecode}&status=${userData.status}`,
  //       {
  //         method: 'POST', // *GET, POST, PUT, DELETE, etc.
  //         headers: {
  //           Authorization: `Bearer ${getToken()}`,
  //           // Authorization: `Bearer ${token}`,
  //           Accept: 'application/json',
  //           'Content-Type': 'application/json',
  //         },
  //       },
  //     )
  //     if (response.ok) {
  //       const result = await response.json()
  //       setIsClientModal(false)
  //       setIsLoading(false)
  //       console.log(result)
  //       // navigate('/dashboard')
  //     } else {
  //       const result = await response.json()
  //       setIsLoading(false)
  //       setError(result.message)
  //       console.log(result)
  //     }
  //   } catch (error) {
  //     setIsLoading(false)
  //     console.log(error)
  //   }
  // }

  const handleDay = (e) => {
    const date = new Date()

    setEditFormData({
      ...editFormData,
      queryDays: e.target.value,
      queryExpiryDate: e.target.value
        ? new Date(date.setDate(date.getDate() + Number(e.target.value)))
        : new Date(),
    })
    // console.log(data.psActivateExpiryDate.replace(/[\\/]/g, '-').split('-').reverse().join('-'))
    // console.log(res.setDate(res.getDate() + Number(e.target.value)))
    // console.log(new Date(res.setDate(res.getDate() + Number(e.target.value))))
    // console.log(finalDate)
  }

  const handleDate = (date) => {
    let diffDate = new Date().getTime() - date.getTime()
    let conv = Math.abs(diffDate)
    setEditFormData({
      ...editFormData,
      queryExpiryDate: date,
      queryDays: Math.round(conv / (1000 * 60 * 60 * 24)),
    })
    // console.log(new Date(moment(date).format('DD/MM/YYYY')))
  }

  // Temporary-extension date <-> days, mirroring the expiry entry above. The backend sets the temp
  // expiry to TODAY + days, so days are counted as whole calendar days to keep the picked date exact.
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

  const OnAddOnSelect = (selectedList, selectedItem) => {
    let data = []
    selectedList.forEach((item) => {
      data.push(item.addonId)
    })

    setEditFormData({
      ...editFormData,
      AddOnsArray: selectedList,
      selectedAdons: data,
      // selectedAdons: data.join(','),
    })
  }
  const OnAddOnRemove = (selectedList, selectedItem) => {
    let data = []
    selectedList.forEach((item) => {
      data.push(item.addonId)
    })

    setEditFormData({
      ...editFormData,
      AddOnsArray: selectedList,
      selectedAdons: data.join(','),
    })
    // console.log(data)
  }

  // const CloudModules = async () => {
  //   setIsLoading(true)
  //   try {
  //     const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/CloudModules`, {
  //       method: 'GET', // *GET, POST, PUT, DELETE, etc.
  //       headers: {
  //         Authorization: `Bearer ${getToken()}`,
  //         Accept: 'application/json',
  //         'Content-Type': 'application/json',
  //       },
  //     })
  //     if (response.ok) {
  //       const result = await response.json()
  //       setCloudModules(result)
  //       setError(result.message)
  //       setIsLoading(false)
  //       console.log(result)
  //     } else {
  //       const result = await response.json()
  //       setIsLoading(false)
  //       console.log(result)
  //     }
  //   } catch (error) {
  //     setIsLoading(false)
  //     console.log(error)
  //   }
  // }

  // const onSelectionChange = (rows) => {
  //   setModulesSelected(rows.map((item) => item?.moduleCode))
  //   console.log(rows)
  // }

  // const handleAccess = (rowData) => {
  //   const data = {
  //     modulecode: rowData.moduleCode,
  //     status: rowData.access === true ? false : true,
  //   }
  //   console.log(data)
  //   UpdateClientModules(data)
  // }

  useEffect(() => {
    getCustomers()
    GetSerialNumbers()
    GetAddOns()
    GetPackages()
    // CloudModules()
    GetRegions()
    GetClientDetails()
    GetAllUsersInCompany()
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
              {/* <div className="vr fw-bold mx-2"></div> */}
              {/* <h6 className="m-0">{id}</h6> */}
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
      <div className="row g-2">
        <div className="col-md">
          <div className="card h-100 rounded-0">
            <div className="card-body">
              <div className="d-flex justify-content-between">
                <div className="d-flex justify-content-between">
                  <p className="mb-0 fw-bold align-self-end" style={{ fontSize: '11px' }}>
                    Client Details
                  </p>
                </div>

                <div className="d-flex">
                  {/* <div className="vr fw-bold mx-2"></div> */}
                  <p className="m-0 fw-bold" style={{ fontSize: '11px' }}>
                    Status:{' '}
                    <span className={data.psActivated ? 'text-success' : 'text-danger'}>
                      {data.psActivated ? 'Active' : 'Not Active'}
                    </span>
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
                <div className="row mb-1">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Branch
                  </label>
                  <div className="col-md ps-1">
                    <div className="row">
                      <div className="col pe-0">
                        <input
                          type="text"
                          name="branchCode"
                          id="branchCode"
                          value={data.branchCode}
                          className="form-control form-control-sm rounded-0 fw-medium"
                          disabled
                          readOnly
                        />
                      </div>
                      <div className="col-8 ps-0">
                        <input
                          type="text"
                          name="psBranchName"
                          id="psBranchName"
                          value={data.psBranchName}
                          className="form-control form-control-sm rounded-0 fw-medium"
                          readOnly
                          disabled
                        />
                      </div>
                    </div>
                  </div>
                </div>
                <div className="d-flex justify-content-end">
                  <p
                    className="my-1 fw-bold"
                    role="button"
                    style={{ fontSize: '10px', color: '#c58c4f' }}
                    onClick={() => setClientModal(true)}
                    // onClick={() => setData({ ...data, editModal: true, editModalInterface: 1 })}
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
                              // packageCode
                              // packageName
                              checked={module.packageNum === data.packageCode}
                              onChange={() => {}}
                              disabled
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
                <div className="d-flex justify-content-end">
                  <p
                    className="my-1 fw-bold"
                    role="button"
                    style={{ fontSize: '10px', color: '#c58c4f' }}
                    onClick={() => setIsClientModal(true)}
                    // onClick={() => setData({ ...data, editModal: true, editModalInterface: 6 })}
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
                          // readOnly
                        />
                      </div>
                      <div className="col-6">
                        <div className="row">
                          <label htmlFor="blocked" className="col-3 col-form-label">
                            {/* Item Name */}
                          </label>
                          <div className="col ps-0">
                            <div className="form-check">
                              <input
                                className="form-check-input"
                                type="checkbox"
                                checked={data.psActivated}
                                name="blocked"
                                id="blocked"
                                // disabled
                                readOnly
                              />
                              <label
                                className={
                                  data.psActivated
                                    ? 'form-check-label text-success fw-bold'
                                    : 'form-check-label text-danger fw-bold'
                                }
                                htmlFor="blocked"
                              >
                                {data.psActivated ? 'Is Active' : 'Not Active'}
                              </label>
                            </div>
                          </div>
                        </div>
                      </div>
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
                        {/* <DatePicker
                          className="form-control form-control-sm rounded-0"
                          selected={data.psActivateExpiryDate}
                          dateFormat="dd/MM/yyyy"
                          peekNextMonth
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          minDate={new Date()}
                          onChange={(date) => setData({ ...data, psActivateExpiryDate: date })}
                          readOnly
                          disabled
                        /> */}
                        <input
                          type="text"
                          name="psActivateExpiryDate"
                          id="psActivateExpiryDate"
                          // value={data.psActivateExpiryDate}
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
                                // onClick={() => setData({ ...data, editModal: true, editModalInterface: 3 })}
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
                                // onClick={() => setData({ ...data, editModal: true, editModalInterface: 4 })}
                              >
                                Change
                              </p>
                            </div>
                          </div>
                          {/* <div className="col">
                            <div className="row">
                              <label
                                htmlFor="branchCode"
                                className="col-md-5 col-form-label divider"
                              >
                                Stock Take CALS
                              </label>
                              <div className="col-md ps-1">
                                <input
                                  type="text"
                                  name="psStockTakeCals"
                                  id="psStockTakeCals"
                                  value={data.psStockTakeCals}
                                  className="form-control form-control-sm rounded-0"
                                  disabled
                                  readOnly
                                />
                              </div>
                            </div>
                          </div> */}
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
                                // onClick={() => setData({ ...data, editModal: true, editModalInterface: 3 })}
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
                                // onClick={() => setData({ ...data, editModal: true, editModalInterface: 4 })}
                              >
                                Change
                              </p>
                            </div>
                          </div>
                          {/* <div className="col">
                            <div className="row">
                              <label
                                htmlFor="branchCode"
                                className="col-md-5 col-form-label divider"
                              >
                                Stock Take CALS
                              </label>
                              <div className="col-md ps-1">
                                <input
                                  type="text"
                                  name="psStockTakeCals"
                                  id="psStockTakeCals"
                                  value={data.psStockTakeCals}
                                  className="form-control form-control-sm rounded-0"
                                  disabled
                                  readOnly
                                />
                              </div>
                            </div>
                          </div> */}
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
                            {/* <DatePicker
                              className="form-control form-control-sm rounded-0"
                              selected={data.psStockTakeStartDate}
                              dateFormat="dd/MM/yyyy"
                              peekNextMonth
                              showMonthDropdown
                              showYearDropdown
                              dropdownMode="select"
                              disabled
                              readOnly
                            /> */}
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
                            {/* <DatePicker
                              className="form-control form-control-sm rounded-0"
                              selected={data.stockTakeEndDate}
                              dateFormat="dd/MM/yyyy"
                              peekNextMonth
                              showMonthDropdown
                              showYearDropdown
                              dropdownMode="select"
                              disabled
                              readOnly
                            /> */}
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
                    // onClick={() => setData({ ...data, editModal: true, editModalInterface: 5 })}
                  >
                    Change
                  </p>
                </div>
                <hr className="mb-3 mt-1" />
                <div className="row mb-1">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Add Ons
                  </label>
                  <div className="col-md ps-1">
                    <ul className="list-group list-group-flush">
                      {data.addons
                        ?.filter((item) => item !== null)
                        .map((addOn, index) => (
                          // <Chip
                          //   size="small"
                          //   className="chip col"
                          //   key={index}
                          //   label={addOn.addonName}
                          // />
                          <li className="list-group-item py-1" key={index}>
                            <input
                              className="form-check-input me-1"
                              type="checkbox"
                              checked
                              // value=""
                              id={addOn.addonName}
                              readOnly
                              onChange={() => {}}
                            />
                            <label
                              className="form-check-label stretched-link fw-bold"
                              htmlFor={addOn.addonName}
                            >
                              {addOn.addonName}
                            </label>
                          </li>
                        ))}
                    </ul>
                    {/* <div className="d-flex">
                      {data.addons.map((addOn, index) => (
                        <Chip
                          size="small"
                          className="chip col"
                          key={index}
                          label={addOn.addonName}
                        />
                      ))}
                    </div> */}
                  </div>
                </div>
                <div className="d-flex justify-content-end">
                  <p
                    className="my-1 fw-bold"
                    role="button"
                    style={{ fontSize: '10px', color: '#c58c4f' }}
                    onClick={() => setAddOnsModal(true)}
                    // onClick={() => setData({ ...data, editModal: true, editModalInterface: 6 })}
                  >
                    Change
                  </p>
                </div>
                <hr className="my-3" />
                {/* <hr className="mb-3 mt-1" /> */}
              </form>
            </div>
          </div>
        </div>
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
                {/* <hr className="my-1" /> */}
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
          <CModalTitle>Update Client Details</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateClientDetails}>
            <div className="row mb-3">
              <label htmlFor="queryAcctCode" className="col-md col-form-label divider">
                Account
              </label>
              <div className="col-md-10">
                <div className="row">
                  <div className="col-4 pe-0">
                    <input
                      className="form-control form-control-sm rounded-0"
                      list="customerOptions"
                      id="queryAcctCode"
                      name="queryAcctCode"
                      value={editFormData.queryAcctCode}
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      title={editFormData.queryAcctCode}
                      placeholder="search..."
                      onChange={handleAccounthange}
                    />
                    <datalist id="customerOptions">
                      <option value="">select</option>
                      {customers.map((customer, index) => (
                        <option key={index} value={customer.cusCode}>
                          {customer.cusName}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col ps-0">
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-0"
                      id="queryAcctName"
                      name="queryAcctName"
                      value={editFormData.queryAcctName}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, queryAcctName: e.target.name })
                      }
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <label htmlFor="querySuppID" className="col-md col-form-label divider">
                Branch
              </label>
              <div className="col-md-10">
                <div className="row">
                  <div className="col-4 pe-0">
                    <input
                      className="form-control form-control-sm rounded-0"
                      list="customerMembersOptions"
                      id="queryBranchCode"
                      name="queryBranchCode"
                      value={editFormData.queryBranchCode}
                      data-bs-toggle="tooltip"
                      data-bs-placement="top"
                      placeholder="search..."
                      title={editFormData.queryBranchCode}
                      disabled={editFormData.customerMembers <= 0}
                      onChange={handleBranchChange}
                    />
                    <datalist id="customerMembersOptions">
                      <option value="">select</option>
                      {customerMembers.map((customerMember, index) => (
                        <option key={index} value={customerMember.branchCode}>
                          {customerMember.branchName}
                        </option>
                      ))}
                    </datalist>
                  </div>
                  <div className="col ps-0">
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-0"
                      id="queryBranchName"
                      name="queryBranchName"
                      value={editFormData.queryBranchName}
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, queryBranchName: e.target.value })
                      }
                      disabled
                    />
                  </div>
                </div>
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
                    {/* <input
                      type="text"
                      className="form-control form-control-sm rounded-0"
                      name="querySerialNo"
                      id="querySerialNo"
                      value={editFormData.querySerialNo}
                      readOnly
                      onChange={(e) =>
                        setEditFormData({ ...editFormData, querySerialNo: e.target.value })
                      }
                    /> */}
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
                  <label htmlFor="nonregistered" className="col-md-3 col-form-label">
                    {/* Item Name */}
                  </label>
                  <div className="col-md ps-1">
                    <div className="form-check">
                      <input
                        className="form-check-input"
                        type="checkbox"
                        checked={editFormData.isActive}
                        // checked={editFormData.isActive === '1'}
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
                  </div>
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <div className="col-md">
                <div className="row">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Expiry
                  </label>
                  <div className="col-md ps-1">
                    {/* <input
                      type="date"
                      name="queryExpiryDate"
                      className="form-control form-control-sm rounded-0"
                      id="queryExpiryDate"
                      value={editFormData.queryExpiryDate}
                    /> */}
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
                    {/* <DatePicker
                      className="form-control form-control-sm rounded-0"
                      selected={editFormData.queryExpiryDate}
                      dateFormat="dd/MM/yyyy"
                      peekNextMonth
                      showMonthDropdown
                      showYearDropdown
                      dropdownMode="select"
                      minDate={new Date()}
                      onChange={(date) => handleDate(date)}
                    /> */}
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
            {/* Temporary expiry — a short grace extension before the client pays.
                Same date-or-days entry as the Expiry above. */}
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
                    {/* <input
                          type="text"
                          name="psStockTakeStartDate"
                          id="psStockTakeStartDate"
                          value={data.psStockTakeStartDate}
                          className="form-control form-control-sm rounded-0"
                          readOnly
                          disabled
                        /> */}
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
                        {/* <input
                              type="text"
                              name="stockTakeEndDate"
                              id="stockTakeEndDate"
                              value={data.stockTakeEndDate}
                              className="form-control form-control-sm rounded-0"
                              readOnly
                              disabled
                            /> */}
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
      {/* Client Modal */}
      <CModal alignment="center" visible={addOnsModal} backdrop="static">
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
            <div className="hstack gap-2 mb-3 ">
              {data.addons
                ?.filter((item) => item !== null)
                .map((addOn, index) => (
                  <Chip
                    className="chip ms-auto"
                    size="small"
                    key={index}
                    label={addOn.addonName}
                    onDelete={() => DeleteAddsOn(addOn.addonId)}
                  />
                ))}
            </div>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Add Ons
              </label>
              <div className="col-md ps-1">
                <Multiselect
                  closeIcon={''}
                  className="rounded-0"
                  // hideSelectedList
                  options={addOns} // Options to display in the dropdown
                  selectedValues={editFormData.AddOnsArray} // Preselected value to persist in dropdown
                  onSelect={OnAddOnSelect} // Function will trigger on select event
                  onRemove={OnAddOnRemove} // Function will trigger on remove event
                  displayValue="addonName" // Property name to display in the dropdown options
                  showCheckbox
                  // hideSelectedList={true}
                  disablePreSelectedValues
                  required
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
                disabled={!editFormData.AddOnsArray}
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
                  setEditFormData({
                    ...editFormData,
                    queryAddOns: [],
                    AddOnsArray: [],
                    selectedAdons: '',
                  })
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
                          // onChange={() => {}}editFormData
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
