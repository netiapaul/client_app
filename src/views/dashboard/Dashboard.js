import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import Moment from 'react-moment'
import { Link } from 'react-router-dom'
const axios = require('axios')

const Dashboard = () => {
  //  "material-table": "^2.0.3",
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [rowId, setRowId] = useState('')
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
        render: (rowData) => <span>{rowData.psPickCpu + '/' + rowData.psPickBios}</span>,
      },
      { title: 'Company', field: 'psPickCompany' },
    ],
    clients: [],
  })

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

  useEffect(() => {
    getClients()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-start">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">Customer Clients</h6>
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
              columns={data.column}
              tableRef={data.tableRef}
              icons={tableIcons}
              options={{
                ...tableOptions,
                paging: false,
                sorting: true,
                // rowStyle: (rowData) => ({
                //   backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                // }),
              }}
              components={{
                Toolbar: (props) => (
                  <div className="bg-white">
                    <MTableToolbar {...props} />
                  </div>
                ),
              }}
              data={data.clients}
              title=""
            />
          )}
        </div>
      </div>
    </>
  )
}

export default Dashboard
