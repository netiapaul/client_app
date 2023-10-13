import React, { useState, useEffect } from 'react'
import MaterialTable from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
const axios = require('axios')

function AcessModules() {
  const [error, setError] = useState('')
  const [data, setData] = useState([])
  const [rowId, setRowId] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const getClients = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(
        // `${process.env.REACT_APP_URL_CONFIG}/api/Clients/GetClients`,
        `http://102.37.102.247:5023/api/Clients/GetClients`,
        {
          params: { forcloundch: 'true' },
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: '*/*',
            'Content-Type': 'application/json',
          },
        },
      )

      let uniqueArray = response.data.filter((item, index, self) => {
        // Find the index of the first occurrence of the current item in the array
        let firstOccurrenceIndex = self.findIndex((obj) => obj.psCusCode === item.psCusCode)
        // Keep the item only if its index matches the first occurrence index
        return index === firstOccurrenceIndex
      })

      // setData(response.data)
      setData(uniqueArray)
      console.log(uniqueArray)
      // console.log(uniqueArray)
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
      <div className="container-fluid bg-light  p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <div className="d-flex d-flex align-items-center">
              <h6 className="m-0">Client Access Modules</h6>
            </div>
          </div>
        </div>
      </div>
      <hr className="my-2" />
      <div className="row">
        <div className="col-md-4">
          <div className="card rounded-0">
            <div className="card-body">
              <MaterialTable
                columns={[
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
                  //   {
                  //     title: 'ID',
                  //     field: 'id',
                  //     cellStyle: {
                  //       width: '1%',
                  //     },
                  //   },
                  {
                    title: 'Acct',
                    field: 'psCusCode',
                    cellStyle: {
                      width: '1%',
                    },
                  },
                  {
                    title: 'AcctName',
                    field: 'psCompanyName',
                    cellStyle: {
                      width: 200,
                    },
                  },
                  // { title: 'Branch', field: 'psBranchName' },
                  {
                    title: 'Active',
                    field: 'psActivated',
                    render: (rowData) => (
                      <div
                        className={rowData.psActivated === '1' ? 'Active-r' : 'not-active-r'}
                      ></div>
                    ),
                    cellStyle: {
                      width: '1%',
                    },
                  },
                  //   { title: 'Company', field: 'psPickCompany' },
                ]}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: data.length <= 20 ? false : true,
                  sorting: true,
                  // rowStyle: (rowData) => ({
                  //   backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  // }),
                }}
                isLoading={isLoading}
                data={data}
                title=""
              />
            </div>
          </div>
        </div>
        <div className="col-md">
          <div className="card rounded-0">
            <div className="card-body"></div>
          </div>
        </div>
        <div className="col-md">
          <div className="card rounded-0">
            <div className="card-body"></div>
          </div>
        </div>
      </div>
    </>
  )
}

export default AcessModules
