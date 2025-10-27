import React, { useState, useEffect } from 'react'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
import Drawer from '@mui/material/Drawer'
import DatePicker from 'react-datepicker'

const axios = require('axios')

const Dashboard = () => {
  //  "material-table": "^2.0.3",
  // const [title, setTitle] = useState('')
  const today = new Date()
  const futureDate = new Date(today)
  let tableRef = React.createRef()
  const [error, setError] = useState('')
  const [filter, setFilter] = useState({
    startDate: new Date(),
    endDate: new Date(futureDate.setDate(today.getDate() + 3650)),
    forcloundch: '',
    expirystatus: 0,
  })
  const [isLoading, setIsLoading] = useState(false)
  const [isDrawerOpened, setIsDrawerOpened] = useState(false)
  const [selectedRow, setSelectedRow] = useState({})
  const [summary, setSummary] = useState([])
  const navigate = useNavigate()
  const [data, setData] = useState([])

  async function getClients() {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        {
          params: {
            startDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.startDate)),
            endDate: new Intl.DateTimeFormat('en-GB').format(new Date(filter?.endDate)),
            forcloundch: filter?.forcloundch,
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
      setData(response.data)
      setIsLoading(false)
      setIsDrawerOpened(false)
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setIsLoading(false)
      setIsDrawerOpened(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }

  const handleChange = (e) => {
    const { name, value } = e.target
    setFilter((prevState) => {
      return {
        ...prevState,
        [name]: value,
      }
    })
  }

  const handleSelectedQueries = () => {
    getClients()
  }

  const handleRowClick = (e, rowData) => {
    setSelectedRow({ ...rowData })
    setSummary(data.filter((cus) => cus.psCusCode === rowData?.psCusCode))
    console.log(data.filter((cus) => cus.psCusCode === rowData?.psCusCode))
  }

  useEffect(() => {
    getClients()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">
              Customer Clients:{' '}
              {filter.forcloundch === ''
                ? 'All Clients'
                : filter.forcloundch === 'true'
                ? 'Cloud Clients'
                : 'Desktop Clients'}
            </h6>
          </div>
          <div className="d-flex flex-row">
            <React.Fragment>
              <button
                type="button"
                style={{ width: '5rem' }}
                className="btn btn-sm filter-btn rounded-0"
                onClick={() => setIsDrawerOpened(true)}
              >
                Filters
              </button>
              <Drawer
                anchor={'right'}
                open={isDrawerOpened}
                PaperProps={{ style: { width: '30rem' } }}
              >
                <h6 className="offcanvas-title my-2 px-2" id="filtersLabel">
                  Filter Options
                </h6>
                <hr className="my-1" />
                <div className="container">
                  <div className="row my-2">
                    <label className="col-form-label col-3 divider">Date</label>
                    <div className="col">
                      <div className="row">
                        <div className="col-md-6 ">
                          <div className="row">
                            <label
                              htmlFor="startDate"
                              className="form-label col-3 align-self-center mb-0"
                            >
                              From:
                            </label>
                            <div className="col">
                              <DatePicker
                                selected={filter?.startDate}
                                placeholderText="DD/MM/YYYY"
                                className="form-control form-control-sm rounded-0"
                                id="startDate"
                                name="startDate"
                                dateFormat="dd/MM/yyyy"
                                onChange={(date) => {
                                  setFilter({ ...filter, startDate: date })
                                }}
                              />
                            </div>
                          </div>
                        </div>
                        <div className="col-md-6">
                          <div className="row">
                            <label
                              htmlFor="endDate"
                              className="form-label col-3 align-self-center mb-0"
                            >
                              To:
                            </label>
                            <div className="col">
                              <DatePicker
                                selected={filter?.endDate}
                                placeholderText="DD/MM/YYYY"
                                className="form-control form-control-sm rounded-0"
                                id="endDate"
                                name="endDate"
                                dateFormat="dd/MM/yyyy"
                                onChange={(date) => {
                                  setFilter({ ...filter, endDate: date })
                                }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="row my-2">
                    <label htmlFor="forcloundch" className="col-md-3 col-form-label divider">
                      Client Type
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        aria-label="Default select example"
                        id="forcloundch"
                        name="forcloundch"
                        value={filter?.forcloundch}
                        onChange={handleChange}
                        // onChange={this.function.handleChange}
                      >
                        <option value={''}>Both</option>
                        <option value={'true'}>Cloud</option>
                        <option value={'false'}>Desktop</option>
                      </select>
                    </div>
                  </div>
                  <div className="row my-2">
                    <label htmlFor="expirystatus" className="col-md-3 col-form-label divider">
                      Expiry Status
                    </label>
                    <div className="col-md">
                      <select
                        className="form-select form-select-sm rounded-0"
                        aria-label="Default select example"
                        id="expirystatus"
                        name="expirystatus"
                        value={filter?.expirystatus}
                        onChange={handleChange}
                        // onChange={this.function.handleChange}
                      >
                        <option value={'0'}>All</option>
                        <option value={'1'}>Expired</option>
                        <option value={'2'}>Active</option>
                      </select>
                    </div>
                  </div>
                  <hr />
                  <div className="d-flex justify-content-end gap-2">
                    <button
                      className="btn add-btn top-btn rounded-0"
                      onClick={handleSelectedQueries}
                    >
                      Select
                    </button>
                    <button
                      className="btn delete-btn top-btn rounded-0"
                      onClick={() => setIsDrawerOpened(false)}
                    >
                      close
                    </button>
                  </div>
                </div>
              </Drawer>
            </React.Fragment>
            {/* <span className="d-flex flex-row gap-3">
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="desktop"
                  value={title}
                  checked={title === 'false'}
                  onChange={() => setTitle('false')}
                />
                <label className="form-check-label fw-semibold" htmlFor="desktop">
                  Desktop
                </label>
              </span>
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="cloud"
                  value={title}
                  checked={title === 'true'}
                  // onChange={() => console.log('true')}
                  onChange={() => setTitle('true')}
                />
                <label className="form-check-label fw-semibold" htmlFor="cloud">
                  Cloud
                </label>
              </span>
              <span className="form-check">
                <input
                  className="form-check-input"
                  type="radio"
                  name="clientType"
                  id="both"
                  value={title}
                  checked={title === ''}
                  onChange={() => setTitle('')}
                />
                <label className="form-check-label fw-semibold" htmlFor="both">
                  Both
                </label>
              </span>
            </span> */}
            {/* <button
              className="btn btn-sm filter-btn dropdown-toggle rounded-0"
              type="button"
              data-bs-toggle="dropdown"
              aria-expanded="false"
            >
              Client Type
            </button>
            <ul className="dropdown-menu">
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('')}
                style={{ fontSize: '12px' }}
              >
                Both
              </li>
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('true')}
                style={{ fontSize: '12px' }}
              >
                Cloud
              </li>
              <li
                className="dropdown-item"
                role="button"
                onClick={() => queryClients('false')}
                style={{ fontSize: '12px' }}
              >
                Desktop
              </li>
            </ul> */}
            <button
              type="button"
              style={{ width: '5rem' }}
              className="btn btn-sm add-btn ms-3 rounded-0"
              onClick={() => navigate('/client/create-client')}
            >
              Create
            </button>
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
        <div className="card-body">
          <MaterialTable
            columns={[
              {
                title: '',
                field: 'icon',
                render: (rowData) => (selectedRow?.psCusCode === rowData.psCusCode ? '>' : ''),
                cellStyle: {
                  width: '1%',
                  textAlign: 'center',
                },
              },
              {
                title: 'ID',
                field: 'id',
                render: (rowData) => (
                  <Link className="text-decoration-underline" to={`/client/${rowData.id}`}>
                    {rowData.id}
                  </Link>
                ),

                cellStyle: {
                  width: '1%',
                },
              },
              { title: 'Package', field: 'packageName' },
              { title: 'Acct', field: 'psCusCode' },
              {
                title: 'AcctName',
                field: 'psCompanyName',
                cellStyle: {
                  minWidth: 230,
                },
              },
              {
                title: 'Bcode',
                field: 'psPickBcode',
                cellStyle: {
                  width: '1%',
                },
              },
              {
                title: 'Branch',
                field: 'psBranchName',
                cellStyle: {
                  minWidth: 160,
                },
              },
              { title: 'BranchUsers', field: 'psUserCount' },
              { title: 'CompanyUsers', field: 'companyUsers' },
              {
                title: 'Serial No',
                field: 'psSerialNo',
                cellStyle: {
                  minWidth: 150,
                },
              },
              {
                title: 'Active',
                field: 'psActivated',
                render: (rowData) => (
                  <div className={rowData.psActivated === '1' ? 'Active-r' : 'not-active-r'}></div>
                ),
                cellStyle: {
                  width: '1%',
                },
              },
              {
                title: 'Expiry',
                field: 'psActivateExpiryDate',
                render: (rowData) =>
                  !rowData?.psActivateExpiryDate ? (
                    ''
                  ) : (
                    <Moment format="DD/MM/YYYY">{rowData?.psActivateExpiryDate}</Moment>
                  ),
                cellStyle: {
                  width: '1%',
                },
              },
              {
                title: 'TemporaryExpiry',
                field: 'psTemporaryActivateExpiryDate',
                render: (rowData) =>
                  !rowData?.psTemporaryActivateExpiryDate ? (
                    ''
                  ) : (
                    <Moment format="DD/MM/YYYY">{rowData?.psTemporaryActivateExpiryDate}</Moment>
                  ),
                cellStyle: {
                  width: '1%',
                },
              },
              {
                title: 'CPU/BIOS',
                field: 'psPickBios',
                render: (rowData) => <span>{rowData.psPickCPU + '/' + rowData.psPickBios}</span>,
              },
              {
                title: 'Company',
                field: 'psPickCompany',
                cellStyle: {
                  minWidth: 200,
                },
              },
            ]}
            tableRef={tableRef}
            icons={tableIcons}
            options={{
              ...tableOptions,
              search: true,
              paging: data.length <= 30 ? false : true,
              sorting: true,
              rowStyle: (rowData) => ({
                backgroundColor:
                  // selectedRow?.tableData?.id === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  selectedRow?.psCusCode === rowData.psCusCode ? '#d8d8d8' : '#FFF',
                fontWeight: selectedRow?.psCusCode === rowData.psCusCode ? '600' : '400',
              }),
            }}
            isLoading={isLoading}
            onRowClick={(e, selectedRow) => handleRowClick(e, selectedRow)}
            data={data}
            title=""
          />
        </div>
      </div>
    </>
  )
}

export default Dashboard
