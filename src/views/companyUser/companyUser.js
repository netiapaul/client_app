import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Drawer from '@mui/material/Drawer'
import { FaCaretRight } from 'react-icons/fa'
import PhoneInput from 'react-phone-input-2'
import { CModal, CModalHeader, CModalTitle, CModalBody, CModalFooter } from '@coreui/react'

const axios = require('axios')

const CompanyUsers = () => {
  //  "material-table": "^2.0.3",
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [visible, setVisible] = useState(false)
  const [deleteModal, setDeleteModal] = useState(false)
  const [companyRowId, setCompanyRowId] = useState('')
  const [userRowId, setUserRowId] = useState('')
  const [dataBases, setDataBases] = useState([])
  const [clients, setClients] = useState([])
  const [formData, setFormData] = useState({
    username: '',
    fullusername: '',
    cellnumber: '',
    cellname: '',
    cellcountry: '',
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
  let column1 = [
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
    { title: 'Company Name', field: 'companyName' },
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
  let column2 = [
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
  const Getdatabase = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/SetUpUser/Getdatabase`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: '*/*',
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
            Accept: '*/*',
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
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      setData({ ...data, user: response.data })
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
            Accept: '*/*',
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
            Accept: '*/*',
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
            Accept: '*/*',
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
      const response = await axios.get('http://102.37.102.247:5023/api/Clients/GetClients', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: '*/*',
          'Content-Type': 'application/json',
        },
      })
      setClients(response.data)
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
  useEffect(() => {
    GetCompany()
    Getdatabase()
    getClients()
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
                          })
                          setRowDetails({
                            selectedRow: [],
                            companyDetailId: 0,
                          })
                        }}
                      >
                        close
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
                columns={column1}
                tableRef={data.tableRef}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: data.user?.length <= 20 ? false : true,
                  sorting: true,
                  rowStyle: (rowData) => ({
                    backgroundColor: companyRowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  }),
                }}
                isLoading={isLoading}
                onRowClick={(e, selectedRow) => {
                  setCompanyRowId(selectedRow.tableData.id)
                  setRowDetails({
                    selectedRow: selectedRow,
                    companyDetailId: selectedRow.companyDetailId,
                  })
                  GetCompanyUsers(selectedRow.companyDetailId)
                  console.log(selectedRow)
                }}
                components={{
                  Toolbar: (props) => (
                    <div className="d-flex flex-row justify-content-between py-0">
                      <p
                        className="align-self-end mb-2 flex-fill mb-2 fw-bold"
                        style={{ fontSize: '10px' }}
                      >
                        Company DataBase
                      </p>

                      <button
                        type="button"
                        style={{ width: '5rem' }}
                        className="btn btn-sm new-btn rounded-0 align-self-end mb-2 "
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
                        className="btn btn-sm delete-btn rounded-0 align-self-end mb-2  ms-2"
                        disabled={rowDetails.selectedRow?.length <= 0}
                        onClick={() => setDeleteModal(true)}
                      >
                        Delete
                      </button>

                      <MTableToolbar className="px-0" {...props} />
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
          <div className="card rounded-0 h-100">
            <div className="card-body">
              <MaterialTable
                columns={column2}
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
                    <div className="d-flex flex-row justify-content-between py-0">
                      <p
                        className="align-self-end mb-2 flex-fill mb-2 fw-bold"
                        style={{ fontSize: '10px' }}
                      >
                        DataBase Users
                      </p>

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

                      <MTableToolbar className="px-0" {...props} />
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
      </div>
      <CModal visible={visible} alignment="center" backdrop="static">
        <CModalHeader>
          <CModalTitle>Add Company DB</CModalTitle>
        </CModalHeader>
        <form autoComplete="off" onSubmit={CreateCompany}>
          <CModalBody>
            <div className="row mb-3">
              <label htmlFor="companyName" className="col-md-4 col-form-label divider">
                Company Name
              </label>
              <div className="col-md">
                <select
                  className="form-select form-select-sm rounded-0"
                  id="companyName"
                  value={DBFormData.cuscode}
                  onChange={(e) => {
                    setDBFormData({
                      ...DBFormData,
                      companyName: clients.filter(
                        (client) => client.psCusCode === e.target.value,
                      )[0]?.psCompanyName,
                      cuscode: e.target.value,
                    })
                  }}
                  required
                >
                  <option value={''}></option>
                  {clients.map((item, key) => (
                    <option value={item.psCusCode} key={key}>
                      {item.psCompanyName}
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
    </>
  )
}

export default CompanyUsers
