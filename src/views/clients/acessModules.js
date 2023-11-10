import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
import { CModal, CModalBody, CModalHeader, CModalTitle } from '@coreui/react'
const axios = require('axios')

function AcessModules() {
  const [error, setError] = useState('')
  const [packageRowId, setPackageRowId] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatePackageModal, setIsCreatePackageModal] = useState(false)
  const [packages, setPackages] = useState([])
  const [clients, setClients] = useState([])
  const [packageID, setPackageID] = useState('')
  const [packagecode, setPackageCode] = useState('')
  const [selectedPackages, setSelectedPackages] = useState([])
  const [packageDetails, setPackageDetails] = useState([])
  const [modulesToAssign, setModulesToAssign] = useState([])
  const [modulesToRemove, setModulesToRemove] = useState([])
  const [packageformData, setPackageFormData] = useState({
    packageNum: '',
    description: '',
    isActive: true,
  })

  const GetPackages = async () => {
    setIsLoading(true)
    setError('')
    setPackageCode('')
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Clients/Packages`, {
        method: 'GET', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${token}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      if (response.ok) {
        const result = await response.json()
        setPackages(result)
        setPackageRowId('')
        setPackageCode('')
        setSelectedPackages([])
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      console.log(error)
    }
  }
  const GetPackagesDetails = async (id) => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Packages/PackagesDetails?id=${id}`,
        {
          method: 'GET', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${token}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setPackageDetails(result)
        // setPackageRowId('')
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      // setError(error)
      console.log(error)
    }
  }
  const DeletePackages = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Packages/DeletePackages?id=${packageID}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const result = await response.json()
        setPackages(result)
        setPackageID('')
        setPackageRowId('')
        setSelectedPackages([])
        setPackageDetails([])
        setIsLoading(false)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      // setError(error)
      console.log(error)
    }
  }
  const handleSubmitPackaged = (e) => {
    e.preventDefault()
    CreatePackages()
  }
  const CreatePackages = async () => {
    setIsLoading(true)
    setError('')
    try {
      let response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Packages/CreatePackages`,
        {
          method: 'POST', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            // id: 0,
            packageNum: packageformData.packageNum,
            description: packageformData.description,
            isActive: packageformData.isActive,
          }),
        },
      )
      if (response.ok) {
        const result = await response.json()
        setIsLoading(false)
        setIsCreatePackageModal(false)
        setPackages(result)
        setPackageFormData({
          packageNum: '',
          description: '',
          isActive: true,
        })
        setPackageRowId('')
        setSelectedPackages([])
        console.log(result)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      // setError(error)
      console.log(error)
    }
  }
  const AddModules = async () => {
    setIsLoading(true)
    setError('')
    try {
      let response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Packages/AddModules`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // id: 0,
          packagecode: packagecode,
          moduleCodes: modulesToAssign,
        }),
      })
      if (response.ok) {
        const result = await response.json()
        setIsLoading(false)
        setPackageDetails(result)
        setModulesToAssign([])
        setIsCreatePackageModal(false)
        setPackageFormData({
          packageNum: '',
          description: '',
          isActive: true,
        })
        console.log(result)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      // setError(error)
      console.log(error)
    }
  }
  const RemoveModules = async () => {
    setIsLoading(true)
    setError('')
    try {
      let response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Packages/RemoveModules`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          // id: 0,
          packagecode: packagecode,
          moduleCodes: modulesToRemove,
        }),
      })
      if (response.ok) {
        const result = await response.json()
        setIsLoading(false)
        setPackageDetails(result)
        setModulesToRemove([])
        setIsCreatePackageModal(false)
        setPackageFormData({
          packageNum: '',
          description: '',
          isActive: true,
        })
        console.log(result)
      } else {
        const result = await response.json()
        setIsLoading(false)
        setError(result.message)
        console.log(result)
      }
    } catch (error) {
      setIsLoading(false)
      setError('An error occured processing your current request!')
      // setError(error)
      console.log(error)
    }
  }

  const getClients = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(`http://102.37.102.247:5023/api/Clients/GetClients`, {
        params: { forcloundch: 'true' },
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
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

  useEffect(() => {
    getClients()
    GetPackages()
    setPackageDetails([])
    setModulesToAssign([])
    setModulesToRemove([])
    setPackageCode('')
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
      {error && (
        <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
          <span> {error} </span>
        </div>
      )}
      <div className="row">
        {/* <div className="col-md-5">
          <div className="card rounded-0 h-100">
            <div className="card-body">
              <MaterialTable
                columns={[
                  {
                    title: '',
                    field: 'icon',
                    // render: (rowData) =>
                    //   rowId === rowData.tableData.id ? (
                    //     <i className="fa fa-caret-right" aria-hidden="true"></i>
                    //   ) : (
                    //     ''
                    //   ),
                    cellStyle: {
                      width: '1%',
                      textAlign: 'center',
                    },
                  },
                  // {
                  //   title: 'ID',
                  //   field: 'id',
                  //   cellStyle: {
                  //     width: '1%',
                  //   },
                  // },
                  {
                    title: 'CustomerID',
                    field: 'psCusCode',
                    cellStyle: {
                      width: '10%',
                    },
                  },
                  {
                    title: 'CustomerName',
                    field: 'psCompanyName',
                    cellStyle: {
                      minWidth: 180,
                    },
                  },
                  {
                    title: 'Branch',
                    field: 'psBranchName',
                    cellStyle: {
                      minWidth: 120,
                    },
                  },

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
                ]}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: false,
                  sorting: true,
                  maxBodyHeight: 200,
                  overflowY: 'auto',
                  // rowStyle: (rowData) => ({
                  //   backgroundColor: rowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  // }),
                }}
                isLoading={isLoading}
                data={clients}
                title=""
              />
            </div>
          </div>
        </div> */}

        <div className="col-md-3">
          <div className="card rounded-0 h-100">
            <div className="card-body">
              <MaterialTable
                columns={[
                  {
                    title: '',
                    field: 'icon',
                    render: (rowData) =>
                      packageRowId === rowData.tableData.id ? (
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
                    title: 'Code',
                    field: 'packageNum',
                    cellStyle: {
                      width: '1%',
                    },
                  },
                  {
                    title: 'Description',
                    field: 'description',
                  },
                  {
                    title: 'Active',
                    field: 'isActive',
                    render: (rowData) => (
                      <div className={rowData.isActive ? 'Active-r' : 'not-active-r'}></div>
                    ),
                    cellStyle: {
                      width: '1%',
                    },
                  },
                ]}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: false,
                  sorting: true,
                  rowStyle: (rowData) => ({
                    backgroundColor: packageRowId === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                  }),
                }}
                onRowClick={(e, selectedRow) => {
                  setPackageRowId(selectedRow.tableData.id)
                  GetPackagesDetails(selectedRow?.id)
                  setPackageID(selectedRow?.id)
                  setPackageCode(selectedRow?.packageNum)
                  setSelectedPackages(selectedRow)
                  console.log(selectedRow)
                }}
                // components={{
                //   Toolbar: (props) => (
                //     <div className="d-flex flex-row justify-content-end mb-2">
                //       <button
                //         type="button"
                //         style={{ width: '4rem' }}
                //         className="btn btn-sm add-btn ms-3 rounded-0"
                //         onClick={() => {
                //           setIsCreatePackageModal(true)
                //           setError('')
                //         }}
                //       >
                //         Create
                //       </button>
                //       <button
                //         type="button"
                //         style={{ width: '4rem' }}
                //         className="btn btn-sm delete-btn ms-3 rounded-0"
                //         disabled={selectedPackages.length <= 0}
                //         onClick={() => DeletePackages()}
                //       >
                //         Delete
                //       </button>
                //     </div>
                //   ),
                // }}
                isLoading={isLoading}
                data={packages}
                title=""
              />
            </div>
          </div>
        </div>
        <div className="col-md">
          <div className="card rounded-0 h-100">
            <div className="card-body">
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
                      minWidth: 120,
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
                // onSelectionChange={(rows) => {
                //   setModulesToRemove(rows.map((item) => item?.moduleCode))
                //   console.log(rows)
                // }}
                icons={tableIcons}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: false,
                  sorting: true,
                  maxBodyHeight: 300,
                  overflowY: 'auto',
                  // selection: true,
                  // showSelectAllCheckbox: true,
                }}
                // components={{
                //   Toolbar: (props) => (
                //     <div
                //       className="d-flex flex-row justify-content-between"
                //       style={{ paddingTop: '1px' }}
                //     >
                //       <div className="align-self-end mb-1 d-flex flex-row">
                //         <h6
                //           className="align-self-end d-flex flex-row m-0 fw-bold"
                //           style={{ fontSize: '12px' }}
                //         >
                //           Assigned Modules
                //         </h6>
                //       </div>
                //       <div className="align-self-end mb-2">
                //         <button
                //           type="button"
                //           // style={{ width: '4rem' }}
                //           className="btn btn-sm delete-btn rounded-0"
                //           disabled={modulesToRemove.length <= 0}
                //           onClick={RemoveModules}
                //         >
                //           Un-Assign
                //         </button>
                //       </div>
                //       <MTableToolbar {...props} />
                //     </div>
                //   ),
                // }}
                isLoading={isLoading}
                data={packageDetails?.assignedModulesList}
                title="Assigned Modules"
              />
            </div>
          </div>
        </div>
        <div className="col-md">
          <div className="card rounded-0 h-100">
            <div className="card-body">
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
                      minWidth: 120,
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
                // onSelectionChange={(rows) => {
                //   setModulesToAssign(rows.map((item) => item?.moduleCode))
                //   console.log(rows)
                // }}
                options={{
                  ...tableOptions,
                  search: true,
                  paging: false,
                  sorting: true,
                  // selection: true,
                  maxBodyHeight: 300,
                  overflowY: 'auto',
                  // showSelectAllCheckbox: true,
                }}
                // components={{
                //   Toolbar: (props) => (
                //     <div
                //       className="d-flex flex-row justify-content-between"
                //       style={{ paddingTop: '1px' }}
                //     >
                //       <div className="align-self-end mb-1 d-flex flex-row">
                //         <h6
                //           className="align-self-end d-flex flex-row m-0 fw-bold"
                //           style={{ fontSize: '12px' }}
                //         >
                //           Un-Assigned Modules
                //         </h6>
                //       </div>
                //       <div className="align-self-end mb-2">
                //         <button
                //           type="button"
                //           // style={{ width: '4rem' }}
                //           className="btn btn-sm add-btn rounded-0"
                //           disabled={modulesToAssign.length <= 0}
                //           onClick={AddModules}
                //         >
                //           Assign
                //         </button>
                //       </div>
                //       <MTableToolbar {...props} />
                //     </div>
                //   ),
                // }}
                isLoading={isLoading}
                data={packageDetails?.unAssignedModulesList}
                title="Un-Assigned Modules"
              />
            </div>
          </div>
        </div>
      </div>
      {/* Create Package Modal */}
      <CModal alignment="center" visible={isCreatePackageModal} backdrop="static">
        <CModalHeader>
          <CModalTitle>Create Packages</CModalTitle>
        </CModalHeader>
        <CModalBody>
          {error && (
            <div className="alert alert-danger align-items-center rounded-0 py-1" role="alert">
              <span> {error} </span>
            </div>
          )}
          <form autoComplete="off" onSubmit={handleSubmitPackaged}>
            <div className="row mb-3">
              <label htmlFor="packageNum" className="col-md-3 col-form-label divider">
                Package Num
              </label>
              <div className="col-md ps-1">
                <input
                  type="text"
                  name="packageNum"
                  id="packageNum"
                  value={packageformData.packageNum}
                  className="form-control form-control-sm rounded-0"
                  // required
                  disabled
                  onChange={(e) =>
                    setPackageFormData({ ...packageformData, packageNum: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="row mb-3">
              <label htmlFor="description" className="col-md-3 col-form-label divider">
                Description
              </label>
              <div className="col-md ps-1">
                <input
                  type="text"
                  name="description"
                  id="description"
                  value={packageformData.description}
                  className="form-control form-control-sm rounded-0"
                  required
                  onChange={(e) =>
                    setPackageFormData({ ...packageformData, description: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="d-flex justify-content-end mt-3">
              <button
                type="submit"
                className="btn add-btn btn-sm rounded-0 me-1"
                style={{ width: '4rem' }}
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
                  'Update'
                )}
              </button>

              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm cancel-btn float-end rounded-0"
                onClick={() => {
                  setIsCreatePackageModal(false)
                  // setError('')
                  setPackageFormData({
                    packageNum: '',
                    description: '',
                    isActive: true,
                  })
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        </CModalBody>
      </CModal>
    </>
  )
}

export default AcessModules
