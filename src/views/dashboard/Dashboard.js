import React, { useState, useEffect } from 'react'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
import { useNavigate } from 'react-router-dom'
const axios = require('axios')

const Dashboard = () => {
  //  "material-table": "^2.0.3",
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rowId, setRowId] = useState('')
  const navigate = useNavigate()
  const [data, setData] = useState({
    tableRef: React.createRef(),
    column: [
      {
        title: '',
        field: 'icon',
        render: (rowData) =>
          rowId === rowData.tableData.id ? (
            <i className="fa fa-caret-right" aria-hidden="true"></i>
          ) : (
            ''
          ),
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
      { title: 'Acct', field: 'psCusCode' },
      { title: 'AcctName', field: 'psCompanyName' },
      {
        title: 'Bcode',
        field: 'psPickBcode',
        cellStyle: {
          width: '1%',
        },
      },
      { title: 'Branch', field: 'psBranchName' },
      { title: 'Serial No', field: 'psSerialNo' },
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
      },
      {
        title: 'CPU/BIOS',
        field: 'psPickBios',
        render: (rowData) => <span>{rowData.psPickCPU + '/' + rowData.psPickBios}</span>,
      },
      { title: 'Company', field: 'psPickCompany' },
    ],
    clients: [],
  })

  const getClients = async (type) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        {
          params: { forcloundch: type },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      setData({ ...data, clients: response.data })
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

  const queryClients = (data) => {
    setTitle(data)
  }

  useEffect(() => {
    getClients(title)
  }, [title])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">
              Customer Clients:{' '}
              {title === ''
                ? 'All Clients'
                : title === 'true'
                ? 'Cloud Clients'
                : 'Desktop Clients'}
            </h6>
          </div>
          <div className="d-flex flex-row">
            <span className="d-flex flex-row gap-3">
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
            </span>
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
            columns={data.column}
            tableRef={data.tableRef}
            icons={tableIcons}
            options={{
              ...tableOptions,
              search: true,
              paging: data.clients.length <= 20 ? false : true,
              sorting: true,
              // rowStyle: (rowData) => ({
              //   backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
              // }),
            }}
            isLoading={isLoading}
            data={data.clients}
            title=""
          />
        </div>
      </div>
    </>
  )
}

export default Dashboard
