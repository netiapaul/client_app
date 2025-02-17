import React, { useState, useEffect } from 'react'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions } from '../../utils/helpers'
// import Moment from 'react-moment'
// import { Link } from 'react-router-dom'
import Drawer from '@mui/material/Drawer'
import swal from 'sweetalert'
const axios = require('axios')

const Users = () => {
  //  "material-table": "^2.0.3",
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [error, setError] = useState('')
  // const [controllerError, setControllerError] = useState([])
  const [roles, setRoles] = useState([])
  const [formData, setFormData] = useState({
    fullNames: '',
    email: '',
    phoneNumber: '',
    role: '',
    password: '',
  })
  const [isLoading, setIsLoading] = useState(false)
  const [delLoading, setDelLoading] = useState(false)
  const [rowID, setRowID] = useState('')
  const [toEdit, setToEdit] = useState(false)
  const [selectedRow, setSelectedRow] = useState([])
  const [data, setData] = useState({
    tableRef: React.createRef(),
    users: [],
  })
  let column = [
    {
      title: '',
      field: 'icon',
      render: (rowData) =>
        rowID === rowData.tableData.id ? (
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
        <span className="text-decoration-underline text-primary">{rowData.id}</span>
        // <Link className="text-decoration-underline" to={`/client/${rowData.id}`}>
        //   {rowData.id}
        // </Link>
      ),

      cellStyle: {
        width: '1%',
      },
    },
    { title: 'Name', field: 'name' },
    { title: 'Email', field: 'email' },
    { title: 'Phone No', field: 'phoneNumber' },
    { title: 'Role', field: 'role' },
    {
      title: 'Active',
      field: 'isActive',
      render: (rowData) => <div className={rowData.isActive ? 'Active-r' : 'not-active-r'}></div>,
      cellStyle: {
        width: '1%',
      },
    },
  ]

  const GetUsers = async () => {
    setIsLoading(true)
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
      setData({ ...data, users: response.data })
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
  const GetRoles = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Users/GetRoles`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      setRoles(response.data)
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
  const CreateUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(`${process.env.REACT_APP_URL_CONFIG}/api/Users/CreateUser`, {
        method: 'POST', // *GET, POST, PUT, DELETE, etc.
        headers: {
          Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.fullNames,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          role: formData.role,
          password: formData.password,
        }),
      })
      if (response.ok) {
        const data = await response.json()
        console.log(data)
        setFormData({
          fullNames: '',
          email: '',
          phoneNumber: '',
          role: '',
          password: '',
        })
        setIsLoading(false)
        setSelectedRow([])
        setRowID('')
        setToEdit(false)
        setIsDrawerOpen(false)
        GetUsers()
      } else {
        const data = await response.json()
        setError(data.message)
        // setControllerError(Object.keys(data.errors).map((key, value) => data.errors[key]))
        console.log(data)
        setIsDrawerOpen(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.log(error)
      setError(data.message)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const UpdateUser = async (e) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Users/UpdateUser?id=${Number(
          selectedRow.id,
        )}&email=${selectedRow.email}`,
        {
          method: 'PUT', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.fullNames,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            role: formData.role,
            password: formData.password,
          }),
        },
      )
      if (response.ok) {
        const data = await response.json()
        console.log(data)
        setFormData({
          fullNames: '',
          email: '',
          phoneNumber: '',
          role: '',
          password: '',
        })
        setIsLoading(false)
        setSelectedRow([])
        setRowID('')
        setToEdit(false)
        setIsDrawerOpen(false)
        GetUsers()
      } else {
        const data = await response.json()
        setError(data.message)
        // setControllerError(Object.keys(data.errors).map((key, value) => data.errors[key]))
        console.log(data)
        setIsDrawerOpen(false)
        setIsLoading(false)
      }
    } catch (error) {
      console.log(error)
      setError(data.message)
      setIsLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const DeleteUser = async () => {
    setDelLoading(true)
    setError('')
    try {
      const response = await fetch(
        `${process.env.REACT_APP_URL_CONFIG}/api/Users/DeleteUser?id=${Number(
          selectedRow.id,
        )}&email=${selectedRow.email}`,
        {
          method: 'DELETE', // *GET, POST, PUT, DELETE, etc.
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            // Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        const data = await response.json()
        console.log(data)
        setDelLoading(false)
        setSelectedRow([])
        setRowID('')
        GetUsers()
      } else {
        const data = await response.json()
        setError(data.message)
        console.log(data)
        setDelLoading(false)
      }
    } catch (error) {
      console.log(error)
      setError(`${error?.code}: ${error?.message}`)
      setDelLoading(false)
    }
    return setTimeout(() => {
      setError('')
    }, 8000)
  }
  const handleRowClick = (evt, rowData) => {
    setRowID(rowData.tableData.id)
    setSelectedRow(rowData)
    setToEdit(true)
    console.log(rowData)
  }

  useEffect(() => {
    GetUsers()
    GetRoles()
  }, [])

  return (
    <>
      <hr className="my-2" />
      <div className="container-fluid bg-light p-0">
        <div className="d-flex justify-content-between">
          <div className="flex-fill d-flex align-items-center">
            <h6 className="m-0">Users</h6>
          </div>
          <div className="">
            <React.Fragment key={'right'}>
              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm new-btn me-1 top-btn rounded-0"
                onClick={() => {
                  setIsDrawerOpen(true)
                  setSelectedRow([])
                  setRowID('')
                  setToEdit(false)
                }}
              >
                {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
                New
              </button>

              <Drawer
                // sx={{ width: 540, bgcolor: '#C58C4F' }}
                anchor={'right'}
                open={isDrawerOpen}
                PaperProps={{ style: { width: '30rem' } }}
              >
                <h6 className="offcanvas-title my-2 px-2" id="filtersLabel">
                  {toEdit ? 'Edit User' : 'New User'}
                </h6>
                <hr className="my-1" />
                <div className="container">
                  <form autoComplete="off" onSubmit={toEdit ? UpdateUser : CreateUser}>
                    <div className="row my-3">
                      <label htmlFor="fullNames" className="col-md-4 col-form-label divider">
                        Full Names
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="fullNames"
                          name="fullNames"
                          value={formData.fullNames}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              fullNames: e.target.value,
                            })
                          }
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="email" className="col-md-4 col-form-label divider">
                        Email
                      </label>
                      <div className="col-md">
                        <input
                          type="email"
                          className="form-control form-control-sm rounded-0"
                          id="email"
                          name="email"
                          value={formData.email}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              email: e.target.value,
                            })
                          }
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="phoneNumber" className="col-md-4 col-form-label divider">
                        Phone No
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="phoneNumber"
                          name="phoneNumber"
                          value={formData.phoneNumber}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              phoneNumber: e.target.value,
                            })
                          }
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="fullNames" className="col-md-4 col-form-label divider">
                        Roles
                      </label>
                      <div className="col-md">
                        <select
                          className="form-select form-select-sm rounded-0"
                          id="role"
                          name="role"
                          // disabled={!queryParams.byQueryUserName}
                          value={formData.role}
                          aria-label="role"
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              role: e.target.value,
                            })
                          }
                          required
                        >
                          <option value={''}></option>
                          {roles.map((role, index) => (
                            <option key={index} value={role.name}>
                              {role.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <div className="row mb-3">
                      <label htmlFor="password" className="col-md-4 col-form-label divider">
                        Password
                      </label>
                      <div className="col-md">
                        <input
                          type="text"
                          className="form-control form-control-sm rounded-0"
                          id="password"
                          name="password"
                          value={formData.password}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              password: e.target.value,
                            })
                          }
                          pattern="[-@.\/#&+\w\s]{6,20}"
                          minLength={6}
                          // pattern="[a-zA-Z0-9]{6,20}"
                          title="Please enter the 6-digit password"
                          required
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    <div className="d-flex justify-content-end">
                      <button
                        type="submit"
                        className="btn add-btn rounded-0 me-1"
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
                        ) : toEdit ? (
                          'Update'
                        ) : (
                          'Create'
                        )}
                      </button>
                      <button
                        type="button"
                        className="btn delete-btn rounded-0 ms-1"
                        onClick={() => {
                          setIsDrawerOpen(false)
                          setSelectedRow([])
                          setRowID('')
                          setToEdit(false)
                        }}
                      >
                        close
                      </button>
                    </div>
                  </form>
                </div>
              </Drawer>
            </React.Fragment>
            <button
              type="button"
              style={{ width: '4rem' }}
              className="btn btn-sm edit-btn me-1 top-btn rounded-0"
              disabled={selectedRow.length <= 0}
              onClick={() => {
                setIsDrawerOpen(true)
                console.log(selectedRow)
                setFormData({
                  ...formData,
                  fullNames: selectedRow.name,
                  email: selectedRow.email,
                  phoneNumber: selectedRow.phoneNumber,
                  role: selectedRow.role,
                })
              }}
            >
              {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
              Edit
            </button>
            <button
              className="btn btn-sm delete-btn top-btn rounded-0"
              style={{ width: '4rem' }}
              disabled={selectedRow.length <= 0}
              onClick={() =>
                swal({
                  title: 'Are you sure?',
                  text: 'Once deleted, you will not be able to recover',
                  icon: 'warning',
                  buttons: true,
                  dangerMode: true,
                }).then((willDelete) => {
                  if (willDelete) {
                    DeleteUser()
                    // alert('I am Headed to greatness With Kinjoz')
                  } else {
                    return
                  }
                })
              }
            >
              {delLoading ? (
                <span
                  className="spinner-border text-denter spinner-border-sm"
                  role="status"
                  aria-hidden="true"
                ></span>
              ) : (
                'Delete'
              )}
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

      {/* {controllerError.length > 0 && (
        <div className="alert alert-danger mb-1" role="alert">
          <ul className="m-0">
            {controllerError.map((err, index) => (
              <li key={index}>{err}</li>
            ))}
          </ul>
        </div>
      )} */}
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
              tableRef={data.tableRef}
              icons={tableIcons}
              options={{
                ...tableOptions,
                paging: false,
                sorting: true,
                rowStyle: (rowData) => ({
                  backgroundColor: rowID === rowData.tableData.id ? '#d8d8d8' : '#FFF',
                }),
              }}
              //  setSelectedRow(selectedRow)
              onRowClick={(evt, selectedRow) => handleRowClick(evt, selectedRow)}
              components={{
                Toolbar: (props) => (
                  <div className="bg-white">
                    <MTableToolbar {...props} />
                  </div>
                ),
              }}
              data={data.users}
              title=""
            />
          )}
        </div>
      </div>
    </>
  )
}

export default Users
