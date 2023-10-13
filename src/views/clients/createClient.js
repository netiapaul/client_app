import React, { useState, useEffect } from 'react'
import DatePicker from 'react-datepicker'
import { useNavigate } from 'react-router-dom'
import moment from 'moment'

const axios = require('axios')

function CreateClient() {
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [ErrorArray, setErrorArray] = useState([])
  const [customers, setCustomers] = useState([])
  const [serialNo, setSerialNo] = useState([])
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
    psPickBcode: 1,
  })
  const handleSubmit = (e) => {
    e.preventDefault()
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
    }
    console.log(data)
    CreateClient(data)
  }
  const CreateClient = async (userData) => {
    setIsLoading(true)
    setError('')
    setErrorArray([])
    try {
      const response = await axios.post(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/CreateClient`,
        {
          psCusCode: userData.psCusCode,
          psCompanyName: userData.psCompanyName,
          branchCode: userData.branchCode,
          psBranchName: userData.psBranchName,
          psSerialNo: userData.psSerialNo,
          psActivated: userData.psActivated,
          psBedCount: userData.psBedCount,
          psGL: userData.psGL,
          psUserCount: userData.psUserCount,
          psBranchCount: userData.psBranchCount,
          psStockTakeCals: userData.psStockTakeCals,
          PsActivateDate: userData.PsActivateDate,
          psActivateExpiryDate: userData.psActivateExpiryDate,
          psStockTakeStartDate: userData.psStockTakeStartDate,
          stockTakeEndDate: userData.stockTakeEndDate,
          psPickCpu: userData.psPickCpu,
          psPickBios: userData.psPickBios,
          psPickHdd: userData.psPickHdd,
          psPickCompany: userData.psPickCompany,
          psPickBcode: userData.psPickBcode,
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
        psCusCode: '',
        psCompanyName: '',
        branchCode: '',
        psBranchName: '',
        psSerialNo: '',
        psActivated: false,
        psBedCount: '',
        psGL: '',
        psUserCount: 0,
        psBranchCount: 0,
        psStockTakeCals: 0,
        psActivateExpiryDate: '',
        psStockTakeStartDate: '',
        stockTakeEndDate: '',
      })
      setErrorArray([])
      setIsLoading(false)
      console.log(response.data)
      navigate('/dashboard')
    } catch (error) {
      console.log(error)
      setIsLoading(false)
      setError(error.response.data.messge || error.response.data.message)
      setErrorArray(
        Object.keys(error.response.data.errors).map(
          (key, value) => error.response.data.errors[key],
        ),
      )
    }
    return setTimeout(() => {
      setError('')
    }, 15000)
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
    setIsLoading({ isLoading: true })
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetSerialNumbers`,
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
        // setSerialNo(result)
        // setFormData({ ...formData, psSerialNo: result[0]?.serialId || '' })
        setFormData({ ...formData, psSerialNo: result?.serialId })
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

  useEffect(() => {
    GetSerialNumbers()
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
        <div className="alert alert-danger align-items-center rounded-0" role="alert">
          <i className="fa fa-exclamation-triangle fa-fade me-3" aria-hidden="true"></i>
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
                  Status: <span className="text-success">Active</span>
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
                  <div className="row">
                    <div className="col pe-0">
                      <input
                        type="text"
                        className="form-control form-control-sm rounded-0"
                        list="customerlistOptions"
                        id="psCusCode"
                        name="psCusCode"
                        value={formData.psCusCode}
                        onChange={(e) => setFormData({ ...formData, psCusCode: e.target.value })}
                        required
                      />
                      <datalist id="customerlistOptions">
                        {/* <option value="">select</option>
                        <option value="">select</option>
                        <option value="">select</option> */}
                        {customers.map((customer, index) => (
                          <option key={index} value={customer.cusCode}>
                            {customer.cusName}
                          </option>
                        ))}
                      </datalist>
                    </div>
                    <div className="col-8 ps-0">
                      <input
                        type="text"
                        name="psCompanyName"
                        id="psCompanyName"
                        value={formData.psCompanyName}
                        className="form-control form-control-sm rounded-0"
                        onChange={(e) =>
                          setFormData({ ...formData, psCompanyName: e.target.value })
                        }
                      />
                    </div>
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
                        disabled
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
                            minDate={new Date()}
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
    </>
  )
}

export default CreateClient
