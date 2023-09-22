import React, { useState, useEffect } from 'react'
// import MaterialTable, { MTableToolbar } from 'material-table'
// import { tableIcons, tableOptions } from '../../utils/helpers'
// import Moment from 'react-moment'
// import Drawer from '@mui/material/Drawer'
// import { Link } from 'react-router-dom'
// import { CForm, CCol, CFormSelect, CFormInput, CRow, CFormLabel, CButton } from '@coreui/react'
const axios = require('axios')

const Dashboard = () => {
  //  "material-table": "^2.0.3",
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  //   const [rowId, setRowId] = useState('')
  const [cusData, setCusData] = useState({
    psCusCode: '',
    psCompanyName: '',
  })
  const [formData, setFormData] = useState({
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
  const [customers, setCustomer] = useState([])

  const getClients = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      setCustomer(response.data)
      //   setData({ ...data, clients: response.data })
      setIsLoading(false)
      console.log(response.data)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const CreateBranch = async (userData) => {
    setIsLoading(true)
    setError('')
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
        },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )
      setFormData({
        name: '',
        enabled: true,
        mainbranch: false,
        acct: true,
        showallcustomertrans: true,
        showallcustomer: true,
      })
      setIsLoading(false)
      console.log(response.data)
    } catch (error) {
      console.log(error)
      setError(error?.response?.data?.message)
      //   setError(`${error?.response?.status}: ${error?.response?.data?.message}`)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const handleCustomers = (e) => {
    setCusData({
      psCusCode: e.target.value,
      psCompanyName: customers.filter((cus) => cus?.psCusCode === e.target?.value)[0]
        ?.psCompanyName,
    })
  }
  const handleSubmit = (e) => {
    e.preventDefault()
    const data = {
      psCusCode: cusData?.psCusCode,
      branchcode: formData?.branchcode,
      //   branchcode: `BR00${formData?.branchcode}`,
      //   bcode: Number(formData?.bcode),
      bcode: Number(formData?.branchcode),
      name: formData?.name,
      phoneNumber: formData?.phoneNumber,
      email: formData?.email,
      enabled: formData?.enabled,
      mainbranch: formData?.mainbranch,
      acct: formData?.acct,
      showallcustomertrans: formData?.showallcustomertrans,
      showallcustomer: formData?.showallcustomer,
    }
    CreateBranch(data)
    console.log(data)
  }

  useEffect(() => {
    getClients()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-start">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">Branches</h6>
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
          <div className="card rounded-0">
            <div className="card-body">
              <form
                className="row g-3 needs-validation was-validated"
                noValidate=""
                onSubmit={handleSubmit}
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
                          onChange={handleCustomers}
                          placeholder="search..."
                          required
                        />
                        <datalist id="datalistOptions">
                          <option value={''}></option>
                          {customers.map((customer, index) => (
                            <option key={index} value={customer.psCusCode}>
                              {/* {customer.psCusCode} */}
                              {customer.psCompanyName}
                            </option>
                          ))}
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
                          value={formData.branchcode}
                          onChange={(e) => setFormData({ ...formData, branchcode: e.target.value })}
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
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
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
                    Phone
                  </label>
                  <div className="col-md">
                    <input
                      type="tel"
                      className="form-control form-control-sm rounded-0"
                      id="phoneNumber"
                      name="phoneNumber"
                      value={formData.phoneNumber}
                      pattern="[0-9]{10}"
                      maxLength={10}
                      onChange={(e) => setFormData({ ...formData, phoneNumber: e.target.value })}
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
                      checked={formData.enabled}
                      name="enabled"
                      id="enabled"
                      disabled
                      //   required
                      //   onChange={this.function.handleChange}
                    />
                    <label className="form-check-label ms-2" htmlFor="enabled">
                      Branch Enabled
                    </label>
                  </div>
                </div>
                {/* <div className="row mb-2">
                  <label
                    htmlFor="name"
                    className="col-md-3 col-form-label"
                    style={{ fontSize: '10px' }}
                  ></label>
                  <div className="col-md">
                    <input
                      className="form-check-input"
                      type="checkbox"
                      checked={formData.mainbranch}
                      name="mainbranch"
                      id="mainbranch"
                      disabled
                      //   onChange={this.function.handleChange}
                      //   required
                    />
                    <label className="form-check-label ms-2" htmlFor="mainbranch">
                      Is Main Branch
                    </label>
                  </div>
                </div> */}
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
                      checked={formData.acct}
                      name="acct"
                      id="acct"
                      disabled
                      //   onChange={this.function.handleChange}
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
                      checked={formData.showallcustomertrans}
                      name="showallcustomertrans"
                      id="showallcustomertrans"
                      disabled
                      //   onChange={this.function.handleChange}
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
                      checked={formData.showallcustomer}
                      name="showallcustomer"
                      id="showallcustomer"
                      disabled
                      //   onChange={this.function.handleChange}
                    />
                    <label className="form-check-label ms-2" htmlFor="showallcustomer">
                      Show All Customers Setup
                    </label>
                  </div>
                </div>
                <div className="d-flex justify-content-end">
                  <button
                    type="submit"
                    style={{ width: '5rem' }}
                    className="btn btn-primary add-btn btn-sm rounded-0"
                  >
                    {isLoading ? (
                      <>
                        <span
                          className="spinner-border spinner-border-sm"
                          role="status"
                          aria-hidden="true"
                        ></span>
                      </>
                    ) : (
                      'Submit'
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
        <div className="col-md"></div>
      </div>
    </>
  )
}

export default Dashboard
