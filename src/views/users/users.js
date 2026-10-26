import React, { useState, useEffect } from 'react'
import { getToken, hasModule } from '../../utils/session'
import { MODULES } from '../../utils/permissions'
import { toast } from 'react-toastify'
import MaterialTable, { MTableToolbar } from 'material-table'
import { tableIcons, tableOptions, themedRowStyle } from '../../utils/helpers'
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
  const [groups, setGroups] = useState([])
  const [formData, setFormData] = useState({
    fullNames: '',
    email: '',
    phoneNumber: '',
    role: '',
    password: '',
    groupIds: [],
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

  // Button-level permissions (the screen itself is gated by ViewUsers via the route/nav).
  // Approver status is no longer managed here — it's a group in Access Control.
  const canManageUsers = hasModule(MODULES.ManageUsers)
  const canDeleteUsers = hasModule(MODULES.DeleteUsers)

  // Admin reset for a locked-out user who lost their authenticator (server enforces Admin role).
  const reset2fa = (rowData) => {
    swal({
      title: `Reset 2FA for ${rowData.name}?`,
      text: 'They will then sign in with just their password and can re-enroll. Use only when a user has lost their authenticator device.',
      icon: 'warning',
      buttons: true,
      dangerMode: true,
    }).then(async (ok) => {
      if (!ok) return
      try {
        await axios.post(
          `${process.env.REACT_APP_URL_CONFIG}/api/TwoFactor/Reset/${Number(rowData.id)}`,
          {},
          { headers: { Authorization: `Bearer ${getToken()}` } },
        )
        toast.success(`Two-factor authentication reset for ${rowData.name}.`, { theme: 'colored' })
      } catch (e) {
        toast.error(e.response?.data?.message || 'Could not reset 2FA', { theme: 'colored' })
      }
    })
  }

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
      title: '#',
      field: 'counter',
      sorting: false,
      render: (rowData) => rowData.tableData.id + 1,
      cellStyle: {
        width: '1%',
        textAlign: 'center',
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
    {
      title: 'Approver',
      field: 'canApprove',
      sorting: false,
      render: (rowData) =>
        rowData.canApprove ? (
          <span
            className="badge"
            style={{ background: '#2eb85c', color: '#fff', fontSize: 9, fontWeight: 600 }}
            title="Can approve change requests (admin, or a member of a group granting Approve changes). Manage via Access Control + group membership."
          >
            Approver
          </span>
        ) : (
          <span className="text-muted" style={{ fontSize: 10 }}>
            —
          </span>
        ),
      cellStyle: { width: '1%', textAlign: 'center' },
    },
    {
      title: '2FA',
      field: 'twoFactor',
      sorting: false,
      render: (rowData) =>
        canManageUsers ? (
          <button
            className="btn btn-sm delete-btn rounded-0"
            style={{ fontSize: 10, padding: '1px 6px' }}
            onClick={(e) => {
              e.stopPropagation()
              reset2fa(rowData)
            }}
            title="Reset this user's two-factor authentication (for lockouts)"
          >
            Reset
          </button>
        ) : (
          ''
        ),
      cellStyle: { width: '1%', textAlign: 'center' },
    },
  ]

  const GetUsers = async () => {
    setIsLoading(true)
    setError('')
    try {
      const response = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Users/GetUsers`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
          // Authorization: `Bearer ${getToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      setData({ ...data, users: response.data })
      setIsLoading(false)
    } catch (error) {
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
          Authorization: `Bearer ${getToken()}`,
          // Authorization: `Bearer ${getToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
      })
      setRoles(response.data)
      setIsLoading(false)
    } catch (error) {
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
          Authorization: `Bearer ${getToken()}`,
          // Authorization: `Bearer ${getToken()}`,
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.fullNames,
          email: formData.email,
          phoneNumber: formData.phoneNumber,
          role: formData.role,
          password: formData.password,
          groupIds: formData.groupIds || [],
        }),
      })
      if (response.ok) {
        await response.json()
        setFormData({
          fullNames: '',
          email: '',
          phoneNumber: '',
          role: '',
          password: '',
          groupIds: [],
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
        setIsDrawerOpen(false)
        setIsLoading(false)
      }
    } catch (error) {
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
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            name: formData.fullNames,
            email: formData.email,
            phoneNumber: formData.phoneNumber,
            role: formData.role,
            password: formData.password,
            groupIds: formData.groupIds || [],
          }),
        },
      )
      if (response.ok) {
        await response.json()
        setFormData({
          fullNames: '',
          email: '',
          phoneNumber: '',
          role: '',
          password: '',
          groupIds: [],
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
        setIsDrawerOpen(false)
        setIsLoading(false)
      }
    } catch (error) {
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
            Authorization: `Bearer ${getToken()}`,
            // Authorization: `Bearer ${getToken()}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
          },
        },
      )
      if (response.ok) {
        await response.json()
        setDelLoading(false)
        setSelectedRow([])
        setRowID('')
        GetUsers()
      } else {
        const data = await response.json()
        setError(data.message)
        setDelLoading(false)
      }
    } catch (error) {
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
  }

  // Access groups available to assign on the form (only if the user can manage users).
  const GetGroups = async () => {
    try {
      const response = await axios.get(`${process.env.REACT_APP_URL_CONFIG}/api/Users/Groups`, {
        headers: { Authorization: `Bearer ${getToken()}`, Accept: 'application/json' },
      })
      setGroups(response.data || [])
    } catch (e) {
      // Groups are optional on this screen; ignore if the user can't fetch them.
    }
  }

  useEffect(() => {
    GetUsers()
    GetRoles()
    if (canManageUsers) GetGroups()
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
              {canManageUsers && (
                <button
                  type="button"
                  style={{ width: '4rem' }}
                  className="btn btn-sm new-btn me-1 top-btn rounded-0"
                  onClick={() => {
                    setIsDrawerOpen(true)
                    setSelectedRow([])
                    setRowID('')
                    setToEdit(false)
                    setFormData({
                      fullNames: '',
                      email: '',
                      phoneNumber: '',
                      role: '',
                      password: '',
                      groupIds: [],
                    })
                  }}
                >
                  {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
                  New
                </button>
              )}

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
                        {toEdit && (
                          <div className="text-muted" style={{ fontSize: 9, fontWeight: 400 }}>
                            leave blank to keep current
                          </div>
                        )}
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
                          placeholder={toEdit ? '••••••••' : ''}
                          title="At least 6 characters"
                          required={!toEdit}
                          // onChange={this.function.handleChange}
                        />
                      </div>
                    </div>
                    {groups.length > 0 && (
                      <div className="row mb-3">
                        <label className="col-md-4 col-form-label divider">Access Groups</label>
                        <div className="col-md">
                          {groups.map((g) => (
                            <div className="form-check" key={g.id}>
                              <input
                                className="form-check-input"
                                type="checkbox"
                                id={`grp-${g.id}`}
                                checked={(formData.groupIds || []).includes(g.id)}
                                onChange={(e) => {
                                  const set = new Set(formData.groupIds || [])
                                  if (e.target.checked) set.add(g.id)
                                  else set.delete(g.id)
                                  setFormData({ ...formData, groupIds: Array.from(set) })
                                }}
                              />
                              <label
                                className="form-check-label"
                                htmlFor={`grp-${g.id}`}
                                style={{ fontSize: 11 }}
                                title={g.description || ''}
                              >
                                {g.name}
                              </label>
                            </div>
                          ))}
                          <div className="text-muted" style={{ fontSize: 10 }}>
                            A user can belong to several groups; their access is the combination.
                          </div>
                        </div>
                      </div>
                    )}
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
            {canManageUsers && (
              <button
                type="button"
                style={{ width: '4rem' }}
                className="btn btn-sm edit-btn me-1 top-btn rounded-0"
                disabled={selectedRow.length <= 0}
                onClick={() => {
                  setIsDrawerOpen(true)
                  setFormData({
                    ...formData,
                    fullNames: selectedRow.name,
                    email: selectedRow.email,
                    phoneNumber: selectedRow.phoneNumber,
                    role: selectedRow.role,
                    groupIds: selectedRow.groupIds || [],
                  })
                }}
              >
                {/* <i className="fa fa-plus-circle" style={{ marginRight: 5 }}></i> */}
                Edit
              </button>
            )}
            {canDeleteUsers && (
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
            )}
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
                rowStyle: (rowData) => themedRowStyle(rowID === rowData.tableData.id),
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
