import React, { useState, useEffect } from 'react'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Drawer from '@mui/material/Drawer'
import { FaCaretRight } from 'react-icons/fa'
import PhoneInput from 'react-phone-input-2'

const axios = require('axios')

const CompanyUsers = () => {
  //  "material-table": "^2.0.3",
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [companyRowId, setCompanyRowId] = useState('')
  const [userRowId, setUserRowId] = useState('')
  const [formData, setFormData] = useState({
    username: '',
    fullusername: '',
    cellnumber: '',
    cellname: '',
    cellcountry: '',
  })
  const [rowDetails, setRowDetails] = useState({
    selectedRow: [],
    companyDetailId: 0,
  })
  const [data, setData] = useState({
    tableRef: React.createRef(),
    company: [],
    user: [],
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
    { title: 'Client Code', field: 'clientCode' },
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

  useEffect(() => {
    GetCompany()
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
              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm new-btn rounded-0"
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
                isLoading={isLoading}
                data={data.user}
                title=""
              />
            </div>
          </div>
        </div>
      </div>
    </>
  )
}

export default CompanyUsers
