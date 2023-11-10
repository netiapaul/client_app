import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Moment from 'react-moment'
import Drawer from '@mui/material/Drawer'
const axios = require('axios')

const ActivityLogs = () => {
  //  "material-table": "^2.0.3",
  const [queryParams, setQueryParams] = useState({
    queryCompanyName: '',
    querySectionId: '',
    queryUserName: '',
    byQueryCompanyName: false,
    byQuerySectionId: false,
    byQueryUserName: false,
  })
  const [users, setUsers] = useState([])
  const [customers, setCustomers] = useState([])
  const [activityLogs, setActivityLogs] = useState([])
  const [error, setError] = useState('')
  const [rowId, setRowId] = useState(null)
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [selectedRow, setSelectedRow] = useState([])
  let column = [
    // {
    //   title: '',
    //   field: 'icon',
    //   render: (rowData) =>
    //     rowId === rowData.tableData.id ? (
    //       <i className="fa fa-caret-right" aria-hidden="true"></i>
    //     ) : (
    //       ''
    //     ),
    //   cellStyle: {
    //     width: '1%',
    //     textAlign: 'center',
    //   },
    // },
    {
      title: 'Log Id',
      field: 'logId',
      // render: (rowData) => (
      //   <Link className="text-decoration-underline" to={`/client/${rowData.logId}`}>
      //     {rowData.id}
      //   </Link>
      // ),
      cellStyle: {
        width: '10%',
        textAlign: 'center',
      },
    },
    {
      title: 'Date',
      field: 'dateCreated',
      render: (rowData) => <Moment format="DD/MM/YYYY">{rowData.dateCreated}</Moment>,
    },
    { title: 'Company', field: 'company' },
    {
      title: 'Section',
      field: 'sessionNo',
      cellStyle: {
        width: '10%',
        textAlign: 'center',
      },
    },
    // { title: 'Branch', field: 'psBranchName' },
    { title: 'Done By', field: 'username' },
  ]
  let tableRef = React.createRef()
  const GetLogs = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Logs/GetLogs?companyName=${
          queryParams.queryCompanyName
        }&sectionId=${Number(queryParams.querySectionId)}&userName=${queryParams.queryUserName}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setActivityLogs(response.data)
      setIsDrawerOpen(false)
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
  const GetUsers = async () => {
    // setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Users/GetUsers`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      setUsers(response.data)
      // setData({ ...data, users: response.data })
      // setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      // setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const GetCustomers = async () => {
    // setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Customers/GetCustomers`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setCustomers(response.data)
      // setIsLoading(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      // setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }

  const handleGetLogs = () => {
    return GetLogs()
  }
  const handleSelectedRow = (evt, rowData) => {
    console.log(rowData)
    console.log(rowData.tableData.id)
    setSelectedRow(rowData)
    setRowId(rowData.tableData.id)
  }

  useEffect(() => {
    GetUsers()
    GetCustomers()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">Activity Logs</h6>
          </div>
          <div className="">
            <React.Fragment key={'right'}>
              <button
                type="button"
                className="btn btn-sm filter-btn rounded-0"
                onClick={() => setIsDrawerOpen(true)}
              >
                <i className="fa fa-filter" style={{ marginRight: 2 }}></i> Filters
              </button>
              <Drawer
                // sx={{ width: 540, bgcolor: '#C58C4F' }}
                anchor={'right'}
                open={isDrawerOpen}
                onClose={() => setIsDrawerOpen(true)}
              >
                <h6 className="offcanvas-title my-2 px-2" id="filtersLabel">
                  Filter Options
                </h6>
                <hr className="my-1" />
                <div className="container">
                  {/* <h1>Headed to greatness with Kinjoz</h1> */}
                  <div className="row my-3">
                    <label htmlFor="queryCompanyName" className="col-md-4 col-form-label divider">
                      Company
                    </label>
                    {/* <div className="col-3 pe-md-1 d-flex align-items-center">
                      <div className="input-group">
                        <input
                          className="form-check-input rounded-0"
                          type="checkbox"
                          checked={queryParams.byQueryCompanyName}
                          name="byQueryCompanyName"
                          id="byQueryCompanyName"
                          onChange={(e) =>
                            setQueryParams({
                              ...queryParams,
                              byQueryCompanyName: e.target.checked,
                            })
                          }
                        />
                        <label className="form-check-label ms-2" htmlFor="bydate">
                          By Customer Name
                        </label>
                      </div>
                    </div> */}
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        id="queryCompanyName"
                        name="queryCompanyName"
                        value={queryParams.queryCompanyName}
                        aria-label="acctType"
                        onChange={(e) =>
                          setQueryParams({
                            ...queryParams,
                            queryCompanyName: e.target.value,
                          })
                        }
                      >
                        <option value={''}></option>
                        {customers.map((customer, index) => (
                          <option key={index} value={customer.cusName}>
                            {customer.cusName}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="row my-3">
                    <label htmlFor="querySectionId" className="col-md-4 col-form-label divider">
                      Section
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        id="querySectionId"
                        name="querySectionId"
                        value={queryParams.querySectionId}
                        // disabled={!queryParams.byQuerySectionId}
                        aria-label="querySectionId"
                        onChange={(e) =>
                          setQueryParams({
                            ...queryParams,
                            querySectionId: e.target.value,
                          })
                        }
                      >
                        <option value={''}></option>
                        <option value="1">Client Details</option>
                        <option value="2">Serial Details</option>
                        <option value="3">User CALS</option>
                        <option value="4">Branch CALS</option>
                        <option value="5">Stock Take CALS</option>
                        <option value="6">AddOns</option>
                      </select>
                    </div>
                  </div>
                  <div className="row my-3">
                    <label htmlFor="queryUserName" className="col-md-4 col-form-label divider">
                      User
                    </label>
                    {/* <div className="col-3 pe-md-1 d-flex align-items-center">
                      <div className="input-group">
                        <input
                          className="form-check-input rounded-0"
                          type="checkbox"
                          checked={queryParams.byQueryUserName}
                          name="byQueryUserName"
                          id="byQueryUserName"
                          onChange={(e) =>
                            setQueryParams({
                              ...queryParams,
                              byQueryUserName: e.target.checked,
                            })
                          }
                        />
                        <label className="form-check-label ms-2" htmlFor="byQueryUserName">
                          By UserName
                        </label>
                      </div>
                    </div> */}
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        id="queryUserName"
                        name="queryUserName"
                        // disabled={!queryParams.byQueryUserName}
                        value={queryParams.queryUserName}
                        aria-label="queryUserName"
                        onChange={(e) =>
                          setQueryParams({
                            ...queryParams,
                            queryUserName: e.target.value,
                          })
                        }
                      >
                        <option value={''}></option>
                        {users.map((user, index) => (
                          <option key={index} value={user.name}>
                            {user.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div className="d-flex justify-content-end">
                    <button
                      className="btn add-btn rounded-0 me-1"
                      onClick={handleGetLogs}
                      // onClick={() => setIsDrawerOpen(false)}
                    >
                      Select
                    </button>
                    <button
                      className="btn delete-btn rounded-0 ms-1"
                      onClick={() => setIsDrawerOpen(false)}
                    >
                      close
                    </button>
                  </div>
                </div>
              </Drawer>
            </React.Fragment>
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
      <div className="card rounded-0">
        <div className="card-body pt-0">
          {isLoading ? (
            <div className="text-center mt-2">
              <span
                className="spinner-border spinner-border-sm me-3"
                role="status"
                aria-hidden="true"
              ></span>
              <span>Loading...</span>
            </div>
          ) : (
            <MaterialTable
              columns={column}
              tableRef={tableRef}
              icons={tableIcons}
              options={{
                ...tableOptions,
                paging: false,
                sorting: true,
                rowStyle: (rowData) => ({
                  backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                }),
              }}
              components={{
                Toolbar: (props) => (
                  <div className="bg-white">
                    <MTableToolbar {...props} />
                  </div>
                ),
              }}
              data={activityLogs}
              title=""
              onRowClick={(evt, rowData) => handleSelectedRow(rowData)}
              detailPanel={(rowData) => {
                return (
                  <div className="container">
                    <div className="card border border-0 pt-0">
                      <div className="card-body">
                        <h6 className="offcanvas-title fw-bold" id="filtersLabel">
                          Activities: {rowData.logId}
                        </h6>
                        <hr className="my-1" />
                        <ul className="list-group list-group-numbered">
                          {rowData.activity.split(',').map((act, index) => (
                            <li
                              key={index}
                              className="list-group-item list-group-item-secondary rounded-0 fw-bold"
                            >
                              {act}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>
                )
              }}
            />
          )}
        </div>
      </div>
    </>
  )
}

export default ActivityLogs
