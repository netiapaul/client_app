import React, { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import DatePicker from 'react-datepicker'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
import moment from 'moment'
import Moment from 'react-moment'
import Multiselect from 'multiselect-react-dropdown'
import Chip from '@mui/material/Chip'
const axios = require('axios')
// "homepage": ".",
const UpdateClient = () => {
  const { id } = useParams()
  const navigate = useNavigate()
  const [error, setError] = useState('')
  const [bcode, SetBcode] = useState('')
  const [clientModal, setClientModal] = useState(false)
  const [serialModal, setSerialModal] = useState(false)
  const [userCALSModal, setUserCALSModal] = useState(false)
  const [branchCALSModal, setBranchCALSModal] = useState(false)
  const [stockTakeCALSModal, setStockTakeCALSModal] = useState(false)
  const [addOnsModal, setAddOnsModal] = useState(false)
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
    psActivated: false,
    psStockTakeStartDate: '',
    stockTakeEndDate: '',
    addons: [],
    psBranchCount: '',
    psUserCount: '',
    psPickCpu: '',
    psPickBios: '',
    psPickCompany: '',
    psPickBcode: '',
    psPickHdd: '',
    pickDate: '',
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
    isActive: false,
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
  })
  const [customers, setCustomers] = useState([])
  const [serialNo, setSerialNo] = useState([])
  const [customerMembers, setCustomerMembers] = useState([])
  const [addOns, setAddOns] = useState([])

  const GetClientDetails = async (id) => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/GetClientDetails?id=${id}`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setIsLoading(false)
        setData({
          ...data,
          psCusCode: !result?.clientDetails.psCusCode ? '' : result?.clientDetails.psCusCode,
          psCompanyName: result?.clientDetails.psCompanyName,
          branchCode: !result?.clientDetails.branchCode ? '' : result?.clientDetails.branchCode,
          // branchCode: result?.branchCode,

          psBranchName: result?.clientDetails.psBranchName,
          psActivateExpiryDate: !result?.clientDetails.psActivateExpiryDate
            ? ''
            : new Date(result?.clientDetails.psActivateExpiryDate),
          //  moment(result?.psActivateExpiryDate).format('DD/MM/YYYY')
          psSerialNo: result?.clientDetails.psSerialNo,
          psStockTakeCals: result?.clientDetails.psStockTakeCals,
          psStockTakeStartDate: !result?.clientDetails.psStockTakeStartDate
            ? ''
            : new Date(result?.clientDetails.psStockTakeStartDate),
          stockTakeEndDate: !result?.clientDetails.stockTakeEndDate
            ? ''
            : new Date(result?.clientDetails.stockTakeEndDate),
          psUserCount: result?.clientDetails.psUserCount,
          addons: result?.clientAddOn,
          psActivated: result?.clientDetails.psActivated === '1' ? true : false,
          psBranchCount: result?.clientDetails.psBranchCount,
          psPickCpu: result?.clientDetails.psPickCpu,
          psPickBios: result?.clientDetails.psPickBios,
          psPickHdd: result?.clientDetails.psPickHdd,
          psPickCompany: result?.clientDetails.psPickCompany,
          psPickBcode: result?.clientDetails.psPickBcode,
          pickDate: result?.clientDetails.pickDate,
        })
        setEditFormData({
          ...editFormData,
          queryAcctCode: result?.clientDetails.psCusCode,
          queryAcctName: result?.clientDetails.psCompanyName,
          queryBranchCode: result?.clientDetails.branchCode,
          querySerialNo: result?.clientDetails.psSerialNo,
          queryBranchName: result?.clientDetails.psBranchName,
          queryExpiryDate: !result?.clientDetails.psActivateExpiryDate
            ? ''
            : new Date(result?.clientDetails.psActivateExpiryDate),
          isActive: result?.clientDetails.psActivated === '1' ? true : false,
          queryStockTakeStartDate: !result?.psStockTakeStartDate
            ? ''
            : new Date(result?.clientDetails.psStockTakeStartDate),
          queryStockTakeEndDate: !result?.clientDetails.stockTakeEndDate
            ? ''
            : new Date(result?.clientDetails.stockTakeEndDate),
          queryUserCount: result?.clientDetails.psUserCount,
          queryAddOns: result?.clientDetails.addons,
          queryStockTakeCals: result?.clientDetails.psStockTakeCals,
          queryBranchCount: result?.clientDetails.psBranchCount,
        })
        // SetBcode(result.filter((res) => res.branchCode === data.branchCode)[0]?.bcode)
      } else {
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const getCustomers = async () => {
    setIsLoading(true)
    try {
      const response = await fetch('http://102.37.102.247:5023/api/Customers/GetCustomers', {
        headers: {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${token}`,
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setCustomers(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const GetSerialNumbers = async () => {
    setIsLoading({ isLoading: true })
    try {
      const response = await fetch('http://102.37.102.247:5023/api/Customers/GetSerialNumbers', {
        headers: {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${token}`,
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setSerialNo(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const GetAddOns = async () => {
    setIsLoading({ isLoading: true })
    try {
      const response = await fetch('http://102.37.102.247:5023/api/Logs/GetAddOns', {
        headers: {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${token}`,
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setAddOns(result)
        setError(result.message)
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const getCustomerMembers = async (query) => {
    setIsLoading({ isLoading: true })
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Customers/GetCustomerMembers?cusCode=${query}`,
        {
          headers: {
            method: 'GET', // *GET, POST, PUT, DELETE, etc.
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
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
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
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
    SetBcode(
      customerMembers.filter((customerMember) => customerMember.branchCode === data.branchCode)[0]
        ?.bcode,
    )
  }

  const UpdateClientDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateClientDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
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
        const result = await response.json()
        setClientModal(false)
        setIsLoading(false)
        setEditFormData({
          queryAcctCode: '',
          queryAcctName: '',
          queryBranchCode: '',
          queryBranchName: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateSerialsDetails = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateSerialDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            serialNo: editFormData.querySerialNo,
            isActive: editFormData.isActive,
            cusCode: data.psCusCode,
            branchCode: data.branchCode,
            expiryDate: moment(editFormData.queryExpiryDate).format('DD/MM/YYYY'),
          }),
        },
      )
      if (response.ok) {
        const result = await response.json()
        setSerialModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          ...editFormData,
          queryDays: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateUserCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateUserCals?id=${id}&cpu=${
          data.psPickCpu
        }&bios=${data.psPickBios}&hdd=${data.psPickHdd}&userCals=${Number(
          editFormData.queryUserCount,
        )}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setUserCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryUserCount: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateBranchCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateBranchCals?id=${id}&cpu=${
          data.psPickCpu
        }&bios=${data.psPickBios}&hdd=${data.psPickHdd}&branchCals=${Number(
          editFormData.queryBranchCount,
        )}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setBranchCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryBranchCount: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateStockTakeCals = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateStockTakeCals?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
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
        const result = await response.json()
        setStockTakeCALSModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          queryStockTakeCals: '',
          queryStockTakeStartDate: '',
          queryStockTakeEndDate: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateAddsOn = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateAddsOn?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            psCusCode: data.psCusCode,
            branchCode: data.branchCode,
            addonId: editFormData.selectedAdons.split(','),
          }),
        },
      )
      if (response.ok) {
        const result = await response.json()
        setAddOnsModal(false)
        // setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        setEditFormData({
          ...editFormData,
          AddOnsArray: [],
          selectedAdons: '',
        })
        console.log(result)
        GetClientDetails(id)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const UpdateDetails = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(
        `http://102.37.102.247:5023/api/Clients/UpdateDetails?id=${id}&cpu=${data.psPickCpu}&bios=${data.psPickBios}&hdd=${data.psPickHdd}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setData({ ...data, editModal: false, editModalInterface: 0 })
        setIsLoading(false)
        console.log(result)
        navigate('/dashboard')
      } else {
        const result = await response.json()
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }

  const handleDay = (e) => {
    let res =
      data.psActivateExpiryDate === '' || data.psActivateExpiryDate === null
        ? new Date()
        : new Date(data.psActivateExpiryDate)

    setEditFormData({
      ...editFormData,
      queryDays: e.target.value,
      queryExpiryDate: e.target.value
        ? new Date(res.setDate(res.getDate() + Number(e.target.value)))
        : new Date(),
    })
    // console.log(data.psActivateExpiryDate.replace(/[\\/]/g, '-').split('-').reverse().join('-'))
    console.log(res)
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
    console.log(conv)
    console.log(Math.round(conv / (1000 * 60 * 60 * 24)))
    // console.log(new Date(moment(date).format('DD/MM/YYYY')))
  }

  const OnAddOnSelect = (selectedList, selectedItem) => {
    let data = []
    selectedList.forEach((item) => {
      data.push(item.addonId)
    })

    setEditFormData({
      ...editFormData,
      AddOnsArray: selectedList,
      selectedAdons: data.join(','),
    })
    console.log(data)
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
    console.log(data)
  }

  useEffect(() => {
    GetClientDetails(id)
    getCustomers()
    GetSerialNumbers()
    GetAddOns()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light  p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <div className="d-flex d-flex align-items-center">
              <h6 className="m-0">Client ID:{''}</h6>
              {/* <div className="vr fw-bold mx-2"></div> */}
              <h6 className="m-0">{id}</h6>
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
        <div className="alert alert-danger align-items-center rounded-0" role="alert">
          <i className="fa fa-exclamation-triangle fa-fade me-3" aria-hidden="true"></i>
          <span> {data.error} </span>
        </div>
      )}
      {error && (
        <div className="alert alert-danger align-items-center rounded-0" role="alert">
          <i className="fa fa-exclamation-triangle fa-fade me-3" aria-hidden="true"></i>
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
                          className="form-control form-control-sm rounded-0"
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
                          className="form-control form-control-sm rounded-0"
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
                          className="form-control form-control-sm rounded-0"
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
                          className="form-control form-control-sm rounded-0"
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
                          className="form-control form-control-sm rounded-0"
                          disabled
                          readOnly
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
                          value={moment(data.psActivateExpiryDate).format('DD/MM/YYYY')}
                          className="form-control form-control-sm rounded-0"
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
                              className="form-control form-control-sm rounded-0"
                              readOnly
                              disabled
                            />
                          </div>
                        </div>
                      </div>
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
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    User CALS
                  </label>
                  <div className="col-md ps-1">
                    <input
                      type="text"
                      name="psUserCount"
                      id="psUserCount"
                      value={data.psUserCount}
                      className="form-control form-control-sm rounded-0"
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
                    onClick={() => setUserCALSModal(true)}
                    // onClick={() => setData({ ...data, editModal: true, editModalInterface: 3 })}
                  >
                    Change
                  </p>
                </div>
                <hr className="mb-3 mt-1" />
                <div className="row mb-1">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Branch CALS
                  </label>
                  <div className="col-md ps-1">
                    <input
                      type="text"
                      name="psBranchCount"
                      id="psBranchCount"
                      value={data.psBranchCount}
                      className="form-control form-control-sm rounded-0"
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
                <hr className="mb-3 mt-1" />
                <div className="row mb-3">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
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
                <div className="row mb-1">
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
                          selected={data.psStockTakeStartDate}
                          dateFormat="dd/MM/yyyy"
                          peekNextMonth
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          disabled
                          readOnly
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
                              selected={data.stockTakeEndDate}
                              dateFormat="dd/MM/yyyy"
                              peekNextMonth
                              showMonthDropdown
                              showYearDropdown
                              dropdownMode="select"
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
                    <div className="row ">
                      {data.addons.map((addOn, index) => (
                        <Chip className="chip col" key={index} label={addOn.addonName} />
                      ))}
                    </div>
                    {/* <input
                      type="text"
                      name="addons"
                      id="addons"
                      value={data.addons}
                      className="form-control form-control-sm rounded-0"
                      disabled
                      readOnly
                    /> */}
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
                <li className="list-group-item p-1 d-flex flex-column">
                  <span className="fw-bold ">CPU</span>
                  <span>{data.psPickCpu}</span>
                </li>
                <li className="list-group-item p-1 d-flex flex-column">
                  <span className="fw-bold ">BIOS</span>
                  <span>{data.psPickBios}</span>
                </li>
                <li className="list-group-item p-1 d-flex flex-column">
                  <span className="fw-bold ">Hard Disk</span>
                  <span>{data.psPickHdd}</span>
                </li>
                <li className="list-group-item p-1 d-flex flex-column">
                  <span className="fw-bold">Company</span>
                  <span>
                    {data.psPickCompany} - {data.psPickBcode}
                  </span>
                </li>
                <li className="list-group-item p-1 d-flex flex-column">
                  <span className="fw-bold">Last Service Date</span>
                  <span>
                    <Moment format="DD/MM/YYYY">{data.pickDate}</Moment>
                  </span>
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      {/* Client Modal */}
      <CModal
        alignment="center"
        visible={clientModal}
        backdrop="static"
        size="lg"
        onClose={() => setClientModal(false)}
      >
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
                      onChange={(e) => handleBranchChange(e)}
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
                      readOnly
                    />
                  </div>
                </div>
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
                onClick={() => setClientModal(false)}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      {/* Serial Modal */}
      <CModal
        alignment="center"
        visible={serialModal}
        backdrop="static"
        size="lg"
        onClose={() => setSerialModal(false)}
      >
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
                        !editFormData.queryAcctCode ||
                        !editFormData.queryBranchCode ||
                        data.psSerialNo
                      }
                    >
                      <option value={data.psSerialNo}>{data.psSerialNo}</option>
                      {serialNo.map((serial, index) => (
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
            <div className="row mb-1">
              <div className="col-md">
                <div className="row">
                  <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                    Expiry Date
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
                      minDate={new Date()}
                      onChange={(date) => handleDate(date)}
                    />
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
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
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
      <CModal
        alignment="center"
        visible={userCALSModal}
        backdrop="static"
        size="lg"
        onClose={() => setUserCALSModal(false)}
      >
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
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
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
      {/* Branch CALS Modal */}
      <CModal
        alignment="center"
        visible={branchCALSModal}
        backdrop="static"
        size="lg"
        onClose={() => setBranchCALSModal(false)}
      >
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
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
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
      <CModal
        alignment="center"
        visible={stockTakeCALSModal}
        backdrop="static"
        size="lg"
        onClose={() => setStockTakeCALSModal(false)}
      >
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
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
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
      <CModal
        alignment="center"
        visible={addOnsModal}
        backdrop="static"
        size="lg"
        onClose={() => setAddOnsModal(false)}
      >
        <CModalHeader>
          <CModalTitle>Update Add Ons</CModalTitle>
        </CModalHeader>
        <CModalBody>
          <form autoComplete="off" onSubmit={UpdateAddsOn}>
            <div className="row mb-1">
              <label htmlFor="branchCode" className="col-md-3 col-form-label divider">
                Add Ons
              </label>
              <div className="col-md ps-1">
                <Multiselect
                  className="rounded-0"
                  options={addOns} // Options to display in the dropdown
                  selectedValues={editFormData.AddOnsArray} // Preselected value to persist in dropdown
                  onSelect={OnAddOnSelect} // Function will trigger on select event
                  onRemove={OnAddOnRemove} // Function will trigger on remove event
                  displayValue="addonName" // Property name to display in the dropdown options
                  showCheckbox
                />
                {/* <input
                  type="text"
                  name="queryAddOns"
                  id="queryAddOns"
                  value={editFormData.queryAddOns}
                  className="form-control form-control-sm rounded-0"
                  onChange={(e) =>
                    setEditFormData({ ...editFormData, queryAddOns: e.target.value })
                  }
                /> */}
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm shadow rounded-0 me-1"
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
                className="btn btn-sm cancel-btn float-end shadow rounded-0"
                onClick={() => {
                  setAddOnsModal(false)
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
