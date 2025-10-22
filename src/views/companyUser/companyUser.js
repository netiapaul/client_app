import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Drawer from '@mui/material/Drawer'
import { FaCaretRight } from 'react-icons/fa'
import PhoneInput from 'react-phone-input-2'
import moment from 'moment'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'
import DatePicker from 'react-datepicker'

const axios = require('axios')

const CompanyUsers = () => {
  //  "material-table": "^2.0.3",
  const today = new Date()
  const futureDate = new Date(today)
  const [filter, setFilter] = useState({
    startDate: new Date(),
    endDate: new Date(futureDate.setDate(today.getDate() + 3650)),
    forcloundch: '',
    expirystatus: 0,
  })
  const [error, setError] = useState('')
  const [isClientModal, setIsClientModal] = useState(false)
  const [cloudModules, setCloudModules] = useState([])
  const [modulesSelected, setModulesSelected] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [isBranchModalVisible, setIsBranchModalVisible] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [companyRowId, setCompanyRowId] = useState('')
  const [serial, setSerial] = useState('')
  // const [serialNo, setSerialNo] = useState([])
  const [userRowId, setUserRowId] = useState('')
  const [BranchRowId, setBranchRowId] = useState('')
  const [dataBases, setDataBases] = useState([])
  const [clients, setClients] = useState([])
  const [ErrorArray, setErrorArray] = useState([])
  const [branches, setBranches] = useState([])
  const [formData, setFormData] = useState({
    username: '',
    fullusername: '',
    cellnumber: '',
    cellname: '',
    cellcountry: '',
    expiryDate: new Date(),
    trialAcct: false,
  })
  const [cusData, setCusData] = useState({
    psCusCode: '',
    psCompanyName: '',
  })
  const [branchformData, setBranchFormData] = useState({
    bcode: '',
    branchcode: '',
    name: '',
    email: '',
    phoneNumber: '',
    psSerialNo: '',
    userCount: 0,
    activeDate: new Date(),
    expiryDate: new Date(),
    enabled: true,
    mainbranch: false,
    acct: true,
    showallcustomertrans: true,
    showallcustomer: true,
  })
  const [DBFormData, setDBFormData] = useState({
    companyName: '',
    cuscode: '',
    clientCode: '',
  })
  const [rowDetails, setRowDetails] = useState({
    selectedRow: [],
    companyDetailId: 0,
  })
  const [data, setData] = useState({
    tableRef: React.createRef(),
    company: [],
    user: [],
    clients: [],
  })
  let DbColumn = [
    {
      title: '',
      field: 'icon',
      render: (rowData) => (companyRowId === rowData.tableData.id ? <FaCaretRight /> : ''),
      cellStyle: {
        width: '1%',
        textAlign: 'center',
      },
    },
    {
      title: 'ID',
      field: 'companyDetailId',
      render: (rowData) => (
        <span className="text-decoration-underline text-primary">{rowData.companyDetailId}</span>
      ),

      cellStyle: {
        width: '1%',
      },
    },
    {
      title: 'Company Name',
      field: 'companyName',
      cellStyle: {
        minWidth: 150,
      },
    },
    { title: 'Database', field: 'clientCode' },
    // {
    //   title: 'Active',
    //   field: 'psActivated',
    //   render: (rowData) => (
    //     <div className={rowData.psActivated === '1' ? 'Active-r' : 'not-active-r'}></div>
    //   ),
    //   cellStyle: {
    //     width: '1%',
    //   },
    // },
  ]
  let UserColumn = [
    {
      title: '',
      field: 'icon',
      render: (rowData) => (userRowId === rowData.tableData.id ? <FaCaretRight /> : ''),
      cellStyle: {
        width: '1%',
        textAlign: 'center',
      },
    },
    {
      title: 'ID',
      field: 'uid',
      render: (rowData) => (
        <span className="text-decoration-underline text-primary">{rowData.uid}</span>
      ),

      cellStyle: {
        width: '1%',
      },
    },
    { title: 'UserName', field: 'username' },
    { title: 'Full Username', field: 'fullusername' },
    { title: 'Cell Number', field: 'cellnumber' },
    {
      title: 'Blocked ',
      field: 'blocked',
      render: (rowData) => (
        <input
          type="checkbox"
          id="sel"
          name="sel"
          className="text-center"
          checked={rowData.blocked}
          readOnly
        />
      ),
      cellStyle: {
        width: '1%',
        textAlign: 'center',
      },
      headerStyle: {
        backgroundColor: '#f3f6f9',
      },
    },
  ]
  let BranchColumn = [
    {
      title: '',
      field: 'icon',
      render: (rowData) => (BranchRowId === rowData.tableData.id ? <FaCaretRight /> : ''),
      cellStyle: {
        width: '1%',
        textAlign: 'center',
      },
    },
    {
      title: 'Bcode',
      field: 'bcode',
      // render: (rowData) => (
      //   <span className="text-decoration-underline text-primary">{rowData.uid}</span>
      // ),

      cellStyle: {
        width: '1%',
      },
    },
    { title: 'Branch Code', field: 'branchcode' },
    { title: 'Branch Name', field: 'brancH_NAME' },
    {
      title: 'isMain',
      field: 'mainbranch',
      render: (rowData) => (
        <input
          type="checkbox"
          id="sel"
          name="sel"
          className="text-center"
          checked={rowData.mainbranch}
          readOnly
        />
      ),
    },
    {
      title: 'Enabled',
      field: 'enabled',
      render: (rowData) => <div className={rowData.enabled ? 'Active-r' : 'not-active-r'}></div>,
      cellStyle: {
        width: '1%',
      },
    },
  ]
  const handlePhone = (value, country, e, formattedValue) => {
    const target = e.target
    const name = target.name
    setFormData({
      ...formData,
      [name]: value,
      cellcountry: country.name,
      cellname: country.name,
      // contact_cellcountry: country.name,
      // contact_cellname: country.dialCode,
      // contact_cellnumber: e.target.value,
      // Edit_contact_cellcountry: country.name,
      // Edit_contact_cellname: country.dialCode,
      // Edit_contact_cellnumber: e.target.value,
    })
    // console.log(value, '2542234')
    // console.log(formattedValue, '+254 223 4')
    // console.log(value)
    // console.log(country)
  }
  const Getdatabase = async (cus_code) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/Getdatabase?cus_code=${cus_code}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setDataBases(response.data)
      setIsLoading(false)
      console.log(response)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const GetCompany = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/GetCompany`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setData({ ...data, company: response.data })
      setRowDetails({
        selectedRow: [],
        companyDetailId: 0,
      })
      setIsLoading(false)
      setUserRowId('')
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const GetBranches = async (clientcode) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetBranches?clientcode=${clientcode}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setBranches(response.data)
      setUserRowId('')
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const GetCompanyUsers = async (companyid) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/GetCompanyUsers?companyid=${companyid}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setData({ ...data, user: response.data })
      setIsLoading(false)
      setUserRowId('')
      setBranchRowId('')
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const AddCompanyUser = async (userData) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/AddCompanyUser`,
        {
          username: userData.username,
          fullusername: userData.fullusername,
          cellname: userData.cellname,
          cellnumber: userData.cellnumber,
          cellcountry: userData.cellcountry,
        },
        {
          params: {
            companyid: userData.companyid,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      console.log(response)
      setData({ ...data, user: response.data })
      setIsDrawerOpen(false)
      setFormData({
        username: '',
        fullusername: '',
        cellnumber: '',
        cellname: '',
        cellcountry: '',
      })
      // setData({ ...data, user: response.data })
      setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.request?.response}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const CreateNewCompany = async (userData) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/CreateCompany`,
        {
          companyName: userData?.companyName,
          clientCode: userData?.clientCode,
          cuscode: userData?.cuscode,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      console.log(response)
      setData({ ...data, company: response.data })
      setVisible(false)
      setDBFormData({
        companyName: '',
        clientCode: '',
        cuscode: '',
      })
      // setData({ ...data, user: response.data })
      setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.request?.response}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const DeleteCompany = async (userData) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.delete(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/DeleteCompany`,
        {
          params: {
            companyid: userData.companyid,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      console.log(response)
      setData({ ...data, company: response.data })
      setDeleteModal(false)
      setRowDetails({
        selectedRow: [],
        companyDetailId: 0,
      })
      // setData({ ...data, user: response.data })
      setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.request?.response}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const getClients = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        {
          params: {
            forcloundch: true,
            startDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.startDate)),
            endDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.endDate)),
            expirystatus: filter?.expirystatus,
          },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      const array = response.data ?? []
      setClients(
        array.filter(
          (item, index, self) =>
            index === self.findIndex((obj) => obj.psCusCode === item.psCusCode),
        ),
      )
      // setClients(response.data)
      setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  /**
   * TODO: CREATE COMPANY DB
   */
  const CreateCompany = (e) => {
    e.preventDefault()
    const data = {
      companyName: DBFormData?.companyName,
      cuscode: DBFormData?.cuscode,
      clientCode: DBFormData?.clientCode,
    }
    CreateNewCompany(data)
    // console.log(data)
  }
  /**
   * TODO: CREATE USER
   */
  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      username: formData.username,
      fullusername: formData.fullusername,
      cellname: formData.cellname,
      cellnumber: formData.cellnumber,
      cellcountry: formData.cellcountry,
      expiryDate: formData.expiryDate,
      trialAcct: formData.trialAcct,
      companyid: rowDetails.companyDetailId,
    }
    AddCompanyUser(data)
    // console.log(data)
  }
  /**
   * TODO: HANDLE DELETE COMPANY
   */
  const handleDeleteCompany = () => {
    const data = {
      companyid: rowDetails.companyDetailId,
    }
    DeleteCompany(data)
    // console.log(data)
  }
  const CreateBranch = async (userData) => {
    setIsLoading(true)
    setError('')
    setErrorArray([])
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/CreateBranch?cuscode=${userData?.psCusCode}`,
        {
          bcode: userData?.bcode,
          branchcode: userData?.branchcode,
          branchName: userData?.name,
          enabled: userData?.enabled,
          mainbranch: userData?.mainbranch,
          acct: userData?.acct,
          showallcustomer: userData?.showallcustomer,
          showallcustomertrans: userData?.showallcustomertrans,
          phoneNumber: userData?.phoneNumber,
          email: userData?.email,
          borderpartwhole: 'W',
          lockpartwholeborder: true,
          lockpartwholebtrans: true,
          btranspartwhole: 'W',
          activeDate: moment(branchformData.activeDate).format('DD/MM/YYYY'),
          expiryDate: moment(branchformData.expiryDate).format('DD/MM/YYYY'),
          userCount: branchformData.userCount,
          psSerialNo: userData.psSerialNo,
          cloudModules: userData.modulesSelected,
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setBranchFormData({
        bcode: '',
        branchcode: '',
        name: '',
        email: '',
        phoneNumber: '',
        enabled: true,
        mainbranch: false,
        acct: true,
        showallcustomertrans: true,
        showallcustomer: true,
      })
      GetBranches(rowDetails.clientCode)
      setBranchRowId('')
      setIsBranchModalVisible(false)
      setIsLoading(false)
      console.log(response.data)
    } catch (error) {
      console.log(error)
      // GetBranches(rowDetails.clientCode)
      setError(error.response.data.messge || error.response.data.message)
      // setErrorArray(
      //   Object?.keys(error.response.data?.errors)?.map(
      //     (key, value) => error.response.data.errors[key],
      //   ) ?? [],
      // )
      //   setError(`${error?.response?.status}: ${error?.response?.data?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 15000)
  }
  const handleBranchSubmit = (e) => {
    e.preventDefault()
    const data = {
      psCusCode: cusData?.psCusCode,
      branchcode: `BR00${branchformData?.branchcode}`,
      //   branchcode: `BR00${formData?.branchcode}`,
      //   bcode: Number(formData?.bcode),
      bcode: Number(branchformData?.branchcode),
      name: branchformData?.name,
      phoneNumber: branchformData?.phoneNumber,
      email: branchformData?.email,
      enabled: branchformData?.enabled,
      mainbranch: branchformData?.mainbranch,
      acct: branchformData?.acct,
      showallcustomertrans: branchformData?.showallcustomertrans,
      showallcustomer: branchformData?.showallcustomer,
      // psSerialNo: branchformData?.psSerialNo,
      psSerialNo: serial,
      modulesSelected: modulesSelected,
    }
    console.log(data)
    CreateBranch(data)
  }
  const GetSerialNumbers = async () => {
    setIsLoading({ isLoading: true })
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setSerial(result?.serialId)
        setBranchFormData({ ...branchformData, psSerialNo: result?.serialId })
        setIsLoading(false)
      } else {
        const result = await response.json()
        setError(result.message)
        setIsLoading(false)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      console.log(error)
    }
  }
  const CloudModules = async () => {
    setIsLoading(true)
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/CloudModules`, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setIsClientModal(true)
        setIsBranchModalVisible(false)
        setCloudModules(result)
        setError(result.message)
        setIsLoading(false)
        console.log(result)
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

  const onSelectionChange = (rows) => {
    setModulesSelected(rows.map((item) => item?.moduleCode))
    console.log(rows)
  }
  const handleClientModules = () => {
    CloudModules()
  }

  const handleCompany = (e) => {
    setDBFormData({
      ...DBFormData,
      companyName: clients.filter((client) => client.psCusCode === e.target.value)[0]
        ?.psCompanyName,
      cuscode: e.target.value,
    })

    Getdatabase(e.target.value)
  }

  useEffect(() => {
    GetSerialNumbers()
    GetCompany()
    Getdatabase('')
    getClients()
    // CloudModules()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">Company Users</h6>
          </div>
          <div className="">
            <React.Fragment key={'right'}>
              <Drawer
                anchor={'right'}
                open={isDrawerOpen}
                PaperProps={{ style: { width: '30rem' } }}
              >
                <div className="container-fluid h-100">
                  <h6 className="offcanvas-title my-2 py-2" id="filtersLabel">
                    New User
                  </h6>
                  <hr className="my-1" />
                  <form autoComplete="off" onSubmit={handleSubmit}>
                    <div className="row my-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        UserName
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="username"
                          name="username"
                          value={formData.username}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              username: e.target.value,
                            })
                          }
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Full Name
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="fullusername"
                          name="fullusername"
                          value={formData.fullusername}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fullusername: e.target.value,
                            })
                          }
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Phone No
                      </label>
                      <div className="col-md">
                        <PhoneInput
                          country={'ke'}
                          value={formData.cellnumber}
                          inputClass="form-control form-control-sm rounded-0"
                          inputProps={{
                            id: 'cellnumber',
                            name: 'cellnumber',
                            required: true,
                            autoComplete: false,
                          }}
                          inputStyle={{
                            width: '100%',
                            fontSize: '12px',
                            lineHeight: '1.5',
                            height: ' calc(1.5em + 0.5rem + 2px)',
                          }}
                          id="cellnumber"
                          name="cellnumber"
                          masks={{ ke: '... ... ...' }}
                          onChange={handlePhone}
                          required
                        />
                      </div>
                    </div>
                    {/* <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Expiry Date
                      </label>
                      <div className="col-md">
                        <DatePicker
                          className="form-control form-control-sm rounded-0"
                          selected={formData.expiryDate}
                          dateFormat="dd/MM/yyyy"
                          peekNextMonth
                          showMonthDropdown
                          showYearDropdown
                          dropdownMode="select"
                          onChange={(date) => {
                            setFormData({ ...formData, expiryDate: date })
                          }}
                          required
                        />
                      </div>
                    </div> */}
                    <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Password
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="username"
                          name="username"
                          value={formData.username}
                          readOnly
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              username: e.target.value,
                            })
                          }
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    {/* <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Trial Account
                      </label>
                      <div className="col-md">
                        <div className="form-check">
                          <input
                            className="form-check-input"
                            type="checkbox"
                            checked={formData.trialAcct}
                            name="trialAcct"
                            id="trialAcct"
                            onChange={(e) => {
                              setFormData({ ...formData, trialAcct: e.target.checked })
                            }}
                          />
                        </div>
                      </div>
                    </div> */}
                    <hr className="mb-3" />
                    <div className="d-flex justify-content-end">
                      <button
                        type="submit"
                        style={{ width: '5rem' }}
                        className="btn add-btn btn-sm rounded-0 me-1"
                        disabled={isLoading}
                        // onClick={() => setIsDrawerOpen(false)}
                        // onClick={() => setIsDrawerOpen(false)}
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
                      <button
                        type="button"
                        style={{ width: '5rem' }}
                        className="btn delete-btn btn-sm rounded-0 ms-1"
                        onClick={() => {
                          setIsDrawerOpen(false)
                          setFormData({
                            username: '',
                            fullusername: '',
                            cellnumber: '',
                            cellname: '',
                            cellcountry: '',
                            expiryDate: '',
                            trialAcct: false,
                          })
                          // setRowDetails({
                          //   selectedRow: [],
                          //   companyDetailId: '',
                          // })
                          // setCompanyRowId('')
                        }}
                      >
                        Close
                      </button>
                    </div>
                  </form>
                </div>
              </Drawer>
            </React.Fragment>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      {error && (
        <div
          className="alert alert-danger d-flex align-items-center mx-0 mb-2 rounded-0 p-1"
          role="alert"
        >
          <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
          <span>{error}</span>
        </div>
      )}
      <div className="row">
        <div className="col-md">
          <div className="card rounded-0 h-100">
            <div className="card-body">
              <MaterialTable
                columns={DbColumn}
                tableRef={data.tableRef}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: data.user?.length <= 20 ? false : true,
                  sorting: true,
                  maxBodyHeight: 500,
                  overflowY: 'auto',
                  rowStyle: (rowData) => ({
                    backgroundColor: companyRowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  }),
                }}
                isLoading={isLoading}
                onRowClick={(e, selectedRow) => {
                  setCompanyRowId(selectedRow.tableData.id)
                  setCusData({
                    psCusCode: selectedRow?.cuscode,
                    psCompanyName: selectedRow?.companyName,
                  })
                  setRowDetails({
                    selectedRow: selectedRow,
                    companyDetailId: selectedRow.companyDetailId,
                    clientCode: selectedRow.clientCode,
                  })
                  GetCompanyUsers(selectedRow.companyDetailId)
                  GetBranches(selectedRow.clientCode)
                  console.log(selectedRow)
                }}
                components={{
                  Toolbar: (props) => (
                    <div className="d-flex flex-row justify-content-between mb-2">
                      <div className="align-self-end mb-1 d-flex flex-row">
                        <h6
                          className="align-self-end d-flex flex-row m-0 fw-bold"
                          style={{ fontSize: '12px' }}
                        >
                          Company DataBase
                        </h6>
                      </div>

                      <MTableToolbar className="px-0" {...props} />

                      <div className="d-flex gap-1">
                        <button
                          type="button"
                          style={{ width: '5rem' }}
                          className="btn btn-sm new-btn rounded-0 align-self-end mb-2"
                          onClick={() => {
                            setVisible(true)
                            setUserRowId('')
                            setCompanyRowId('')
                            setRowDetails({
                              selectedRow: [],
                              companyDetailId: '',
                            })
                          }}
                        >
                          New
                        </button>
                        <button
                          type="button"
                          style={{ width: '5rem' }}
                          className="btn btn-sm delete-btn rounded-0 align-self-end mb-2"
                          disabled={rowDetails.selectedRow?.length <= 0}
                          onClick={() => setDeleteModal(true)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ),
                }}
                data={data.company}
                title=""
              />
            </div>
          </div>
        </div>
        <div className="col-md-7">
          <div className="row">
            <div className="col-12">
              <div className="card rounded-0 h-100">
                <div className="card-body">
                  <MaterialTable
                    columns={UserColumn}
                    tableRef={data.tableRef}
                    icons={tableIcons}
                    options={{
                      ...tableOptions,
                      search: true,
                      paging: data.user?.length <= 20 ? false : true,
                      sorting: true,
                      rowStyle: (rowData) => ({
                        backgroundColor: userRowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                      }),
                    }}
                    onRowClick={(e, selectedRow) => {
                      setUserRowId(selectedRow.tableData.id)
                      console.log(selectedRow)
                    }}
                    components={{
                      Toolbar: (props) => (
                        <div className="d-flex flex-row justify-content-between mb-2">
                          <div className="align-self-end mb-1 d-flex flex-row">
                            <h6
                              className="align-self-end d-flex flex-row m-0 fw-bold"
                              style={{ fontSize: '12px' }}
                            >
                              DataBase Users
                            </h6>
                          </div>

                          <MTableToolbar className="px-0" {...props} />
                          <button
                            type="button"
                            style={{ width: '5rem' }}
                            className="btn btn-sm new-btn rounded-0 align-self-end mb-2 "
                            disabled={rowDetails.selectedRow?.length <= 0}
                            onClick={() => {
                              setIsDrawerOpen(true)
                              setFormData({
                                username: '',
                                fullusername: '',
                                cellnumber: '',
                                cellname: '',
                                cellcountry: '',
                              })
                            }}
                          >
                            {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
                            New
                          </button>
                        </div>
                      ),
                    }}
                    isLoading={isLoading}
                    data={data.user}
                    title=""
                  />
                </div>
              </div>
            </div>
            <div className="col-12 mt-2">
              <div className="card rounded-0">
                <div className="card-body">
                  <MaterialTable
                    columns={BranchColumn}
                    tableRef={data.tableRef}
                    icons={tableIcons}
                    options={{
                      ...tableOptions,
                      search: true,
                      paging: data.user?.length <= 20 ? false : true,
                      sorting: true,
                      rowStyle: (rowData) => ({
                        backgroundColor: BranchRowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                      }),
                    }}
                    onRowClick={(e, selectedRow) => {
                      setBranchRowId(selectedRow.tableData.id)
                      console.log(selectedRow)
                    }}
                    components={{
                      Toolbar: (props) => (
                        <div className="d-flex flex-row justify-content-between mb-2">
                          <div className="align-self-end mb-1 d-flex flex-row">
                            <h6
                              className="align-self-end d-flex flex-row m-0 fw-bold"
                              style={{ fontSize: '12px' }}
                            >
                              Branches
                            </h6>
                          </div>

                          <MTableToolbar className="px-0" {...props} />
                          <button
                            type="button"
                            style={{ width: '5rem' }}
                            className="btn btn-sm new-btn rounded-0 align-self-end mb-2 "
                            disabled={rowDetails.selectedRow?.length <= 0}
                            onClick={() => {
                              setIsBranchModalVisible(true)
                              setBranchFormData({
                                bcode: '',
                                branchcode: '',
                                name: '',
                                email: '',
                                phoneNumber: '',
                                enabled: true,
                                mainbranch: false,
                                acct: true,
                                showallcustomertrans: true,
                                showallcustomer: true,
                              })
                            }}
                          >
                            {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
                            New
                          </button>
                        </div>
                      ),
                    }}
                    isLoading={isLoading}
                    data={branches}
                    title=""
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      <CModal visible={visible} alignment="center" backdrop="static">
        <CModalHeader>
          <CModalTitle>Add Company DB</CModalTitle>
        </CModalHeader>
        <form autoComplete="off" onSubmit={CreateCompany}>
          <CModalBody>
            {ErrorArray.length > 0 && (
              <div className="alert alert-danger mb-1 p-2" role="alert">
                <ul className="m-0">
                  {ErrorArray.map((err, index) => (
                    <li key={index}>{err}</li>
                  ))}
                </ul>
              </div>
            )}
            <div className="row mb-3">
              <label htmlFor="companyName" className="col-md-4 col-form-label divider">
                Company Name
              </label>
              <div className="col-md">
                <select
                  className="form-select form-select-sm rounded-0"
                  id="companyName"
                  value={DBFormData.cuscode}
                  // onChange={(e) => {
                  //   setDBFormData({
                  //     ...DBFormData,
                  //     companyName: clients.filter(
                  //       (client) => client.psCusCode === e.target.value,
                  //     )[0]?.psCompanyName,
                  //     cuscode: e.target.value,
                  //   })
                  // }}
                  onChange={handleCompany}
                  required
                >
                  <option value={''}></option>
                  {clients.map((item, key) => (
                    <option value={item.psCusCode} key={key}>
                      {item.psCusCode} - {item.psCompanyName}
                    </option>
                  ))}
                </select>
                {/* <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  id="companyName"
                  value={DBFormData.companyName}
                  onChange={(e) => {
                    setDBFormData({ ...DBFormData, companyName: e.target.value })
                  }}
                  required
                /> */}
              </div>
            </div>
            <div className="row">
              <label htmlFor="companyName" className="col-md-4 col-form-label divider">
                Company DB
              </label>
              <div className="col-md">
                <select
                  className="form-select form-select-sm rounded-0"
                  id="companyName"
                  value={DBFormData.clientCode}
                  onChange={(e) => {
                    setDBFormData({ ...DBFormData, clientCode: e.target.value })
                  }}
                  required
                >
                  <option value={''}></option>
                  {dataBases.map((item, key) => (
                    <option value={item.clientCode} key={key}>
                      {item.clientCode}
                    </option>
                  ))}
                </select>
                {/* <input
                  type="text"
                  className="form-control form-control-sm rounded-0"
                  list="datalistOptions"
                  id="companyName"
                  value={DBFormData.clientCode}
                  onChange={(e) => {
                    setDBFormData({ ...DBFormData, clientCode: e.target.value })
                  }}
                  required
                />
                <datalist id="datalistOptions">
                  <option value={''}></option>
                  {dataBases.map((item, key) => (
                    <option value={item.clientCode} key={key}>
                      {item.clientCode}
                    </option>
                  ))}
                </datalist> */}
              </div>
            </div>
          </CModalBody>
          <CModalFooter>
            <div className="d-flex justify-content-end">
              <button
                type="submit"
                className="btn update-btn btn-sm rounded-0 me-2"
                style={{ width: '5rem' }}
                // onClick={this.GenerateCnote}
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
                  'Save'
                )}
              </button>

              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm reverse-btn rounded-0"
                onClick={() => {
                  setVisible(false)
                  setDBFormData({ companyName: '', clientCode: '' })
                }}
              >
                Cancel
              </button>
            </div>
          </CModalFooter>
        </form>
      </CModal>
      <CModal visible={isBranchModalVisible} alignment="center" backdrop="static" scrollable>
        <CModalHeader>
          <CModalTitle>Add Branches</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div
              className="alert alert-danger d-flex align-items-center mx-0 mb-2 rounded-0 p-1"
              role="alert"
            >
              <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
              <span>{error}</span>
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
          <form
            className="row needs-validation was-validated"
            noValidate=""
            onSubmit={handleBranchSubmit}
          >
            <div className="row my-3">
              <label htmlFor="queryCompanyName" className="col-md-3 col-form-label divider">
                Customers
              </label>
              <div className="col-md">
                <div className="row">
                  <div className="col-md-3 pe-0">
                    <input
                      className="form-control form-control-sm rounded-0"
                      id="queryCompanyName"
                      name="queryCompanyName"
                      list="datalistOptions"
                      value={cusData.psCusCode}
                      // onChange={handleCustomers}
                      placeholder="search..."
                      required
                      readOnly
                    />
                    <datalist id="datalistOptions">
                      <option value={''}></option>
                      {/* {customers.map((customer, index) => (
                        <option key={index} value={customer.psCusCode}>
                          {customer.psCompanyName}
                        </option>
                      ))} */}
                    </datalist>

                    {/* <div className="invalid-feedback">Please select a valid state.</div> */}
                  </div>
                  <div className="col-md ps-0">
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-0"
                      id="queryCompanyName"
                      name="queryCompanyName"
                      value={cusData.psCompanyName}
                      onChange={(e) => console.log(e.target.value)}
                      readOnly
                      required
                    />
                    <div className="invalid-feedback">Please select a valid Customer.</div>
                  </div>
                </div>
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Branch
              </label>
              <div className="col-md">
                <div className="row">
                  <div className="col-md-3 pe-0">
                    <input
                      type="number"
                      className="form-control form-control-sm rounded-0"
                      id="branchcode"
                      name="branchcode"
                      value={branchformData.branchcode}
                      onChange={(e) =>
                        setBranchFormData({ ...branchformData, branchcode: e.target.value })
                      }
                      min={1}
                      //   pattern="/^BR00/"
                      //   onChange={this.function.handleChange}
                      // onKeyDown={this.handleEnter}
                      required
                    />
                    {/* <div className="valid-feedback">
                          String must start with <em>BR00</em>
                        </div> */}
                  </div>
                  <div className="col-md ps-0">
                    <input
                      type="text"
                      className="form-control form-control-sm rounded-0"
                      id="name"
                      name="name"
                      value={branchformData.name}
                      onChange={(e) =>
                        setBranchFormData({ ...branchformData, name: e.target.value })
                      }
                      //   onChange={this.function.handleChange}
                      // onKeyDown={this.handleEnter}
                      required
                    />
                  </div>
                </div>
                {/* <div id="branchcode" className="form-text">
                      The Branch code will be automatically set to i.e <b>BR0023</b>
                    </div> */}
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Email
              </label>
              <div className="col-md">
                <input
                  type="email"
                  className="form-control form-control-sm rounded-0"
                  id="email"
                  name="email"
                  value={branchformData.email}
                  onChange={(e) => setBranchFormData({ ...branchformData, email: e.target.value })}
                  //   onChange={this.function.handleChange}
                  // onKeyDown={this.handleEnter}
                />
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Serial No
              </label>
              <div className="col-md">
                {/* <select
                  className="form-select form-select-sm rounded-0"
                  aria-label="Default select example"
                  style={{
                    appearance: 'none',
                  }}
                  id="psSerialNo"
                  name="psSerialNo"
                  value={branchformData.psSerialNo}
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
                  className="form-control form-control-sm rounded-0"
                  id="psSerialNo"
                  name="psSerialNo"
                  // value={branchformData.psSerialNo}
                  value={serial}
                  onChange={(e) =>
                    setBranchFormData({ ...branchformData, psSerialNo: e.target.value })
                  }
                  disabled
                  required
                  //   onChange={this.function.handleChange}
                  // onKeyDown={this.handleEnter}
                />
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Active Date
              </label>
              <div className="col-md">
                <DatePicker
                  className="form-control form-control-sm rounded-0"
                  selected={branchformData.activeDate}
                  dateFormat="dd/MM/yyyy"
                  peekNextMonth
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  onChange={(date) => {
                    setBranchFormData({ ...branchformData, activeDate: date })
                  }}
                  required
                />
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Expiry Date
              </label>
              <div className="col-md">
                <DatePicker
                  className="form-control form-control-sm rounded-0"
                  selected={branchformData.expiryDate}
                  dateFormat="dd/MM/yyyy"
                  peekNextMonth
                  showMonthDropdown
                  showYearDropdown
                  dropdownMode="select"
                  onChange={(date) => {
                    setBranchFormData({ ...branchformData, expiryDate: date })
                  }}
                  required
                />
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                User Count
              </label>
              <div className="col-md">
                <input
                  type="number"
                  className="form-control form-control-sm rounded-0"
                  id="userCount"
                  name="userCount"
                  value={branchformData.userCount}
                  onChange={(e) =>
                    setBranchFormData({ ...branchformData, userCount: e.target.value })
                  }
                  //   onChange={this.function.handleChange}
                  // onKeyDown={this.handleEnter}
                  required
                />
              </div>
            </div>
            <div className="row mb-3">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label divider"
                style={{ fontSize: '10px' }}
              >
                Phone
              </label>
              <div className="col-md">
                <input
                  type="tel"
                  className="form-control form-control-sm rounded-0"
                  id="phoneNumber"
                  name="phoneNumber"
                  value={branchformData.phoneNumber}
                  pattern="[0-9]{10}"
                  maxLength={10}
                  onChange={(e) =>
                    setBranchFormData({ ...branchformData, phoneNumber: e.target.value })
                  }
                  //   onChange={this.function.handleChange}
                  // onKeyDown={this.handleEnter}
                  required
                />
              </div>
            </div>
            <div className="row mb-2">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label"
                style={{ fontSize: '10px' }}
              >
                {/* Name */}
              </label>
              <div className="col-md">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={branchformData.enabled}
                  value={branchformData.enabled}
                  name="enabled"
                  id="enabled"
                  onChange={(e) => {
                    setBranchFormData({ ...branchformData, enabled: e.target.checked })
                    console.log(e.target.checked)
                  }}
                />
                <label className="form-check-label ms-2" htmlFor="enabled">
                  Branch Enabled
                </label>
              </div>
            </div>
            <div className="row mb-2">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label"
                style={{ fontSize: '10px' }}
              >
                {/* Name */}
              </label>
              <div className="col-md">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={branchformData.acct}
                  name="acct"
                  id="acct"
                  onChange={(e) => setBranchFormData({ ...branchformData, acct: e.target.checked })}
                />
                <label className="form-check-label ms-2" htmlFor="acct">
                  Branch Accounts Enabled
                </label>
              </div>
            </div>
            <div className="row mb-2">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label"
                style={{ fontSize: '10px' }}
              >
                {/* Name */}
              </label>
              <div className="col-md">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={branchformData.showallcustomertrans}
                  name="showallcustomertrans"
                  id="showallcustomertrans"
                  onChange={(e) =>
                    setBranchFormData({ ...branchformData, showallcustomertrans: e.target.checked })
                  }
                />
                <label className="form-check-label ms-2" htmlFor="showallcustomertrans">
                  Show All Customer Transactions
                </label>
              </div>
            </div>
            <div className="row mb-2">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label"
                style={{ fontSize: '10px' }}
              >
                {/* Name */}
              </label>
              <div className="col-md">
                <input
                  className="form-check-input"
                  type="checkbox"
                  checked={branchformData.showallcustomer}
                  name="showallcustomer"
                  id="showallcustomer"
                  // disabled
                  onChange={(e) =>
                    setBranchFormData({ ...branchformData, showallcustomer: e.target.checked })
                  }
                />
                <label className="form-check-label ms-2" htmlFor="showallcustomer">
                  Show All Customers Setup
                </label>
              </div>
            </div>
            <div className="row mb-2">
              <label
                htmlFor="name"
                className="col-md-3 col-form-label"
                style={{ fontSize: '10px' }}
              >
                {/* Name */}
              </label>
              <div className="col-md">
                <button
                  type="button"
                  className="btn btn-sm filter-btn rounded-0"
                  // onClick={() => {
                  //   setIsClientModal(true)
                  //   setIsBranchModalVisible(false)
                  // }}
                  onClick={handleClientModules}
                >
                  Client Modules
                </button>
              </div>
            </div>
            <hr className="mb-2" />
            <div className="d-flex justify-content-end">
              <button
                type="submit"
                className="btn update-btn btn-sm rounded-0 me-2"
                style={{ width: '5rem' }}
                // onClick={this.GenerateCnote}
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
                  'Save'
                )}
              </button>

              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm reverse-btn rounded-0"
                onClick={() => {
                  setIsBranchModalVisible(false)
                  // setCusData({
                  //   psCusCode: '',
                  //   psCompanyName: '',
                  // })
                  setBranchFormData({
                    bcode: '',
                    branchcode: '',
                    name: '',
                    email: '',
                    phoneNumber: '',
                    enabled: true,
                    mainbranch: false,
                    acct: true,
                    showallcustomertrans: true,
                    showallcustomer: true,
                  })
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
      <CModal alignment="center" visible={deleteModal} backdrop="static">
        <CModalHeader>
          <CModalTitle className="fw-bold" id="filtersLabel" style={{ fontSize: '14px' }}>
            {/* Error */}
            {/* <h6 className="alert-title mb-3">{modalTitle} Record</h6> */}
            Delete Record
          </CModalTitle>
        </CModalHeader>
        <CModalBody>
          <div className="container-fluid">
            <p className="alert-text m-0">Are you sure you want to delete this record?</p>
          </div>
        </CModalBody>
        <CModalFooter>
          <div className="d-flex justify-content-end">
            <button
              type="submit"
              className="btn update-btn btn-sm rounded-0 me-2 fw-bold"
              style={{ width: '4rem' }}
              onClick={handleDeleteCompany}
            >
              Ok
            </button>
            <button
              type="button"
              className="btn btn-sm reverse-btn rounded-0 fw-bold"
              style={{ width: '4rem' }}
              onClick={() => {
                setDeleteModal(false)
                setRowDetails({
                  selectedRow: [],
                  companyDetailId: 0,
                })
              }}
            >
              Cancel
            </button>
          </div>
        </CModalFooter>
      </CModal>
      {/* Module Modals */}
      <CModal visible={isClientModal} alignment="center" backdrop="static" scrollable size="lg">
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
                  width: '1%',
                },
              },
              {
                title: 'Module',
                field: 'moduleName',
                cellStyle: {
                  width: 150,
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
              maxBodyHeight: 400,
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
              onClick={() => {
                setIsClientModal(false)
                setIsBranchModalVisible(true)
              }}
            >
              Select
            </button>

            <button
              type="button"
              style={{ width: '4rem' }}
              className="btn btn-sm cancel-btn float-end rounded-0"
              onClick={() => {
                setIsClientModal(false)
                setIsBranchModalVisible(true)
                setModulesSelected([])
                // CloudModules()
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

export default CompanyUsers
