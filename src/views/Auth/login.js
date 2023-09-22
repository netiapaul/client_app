import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { loginRequest } from '../../utils/requests'
import { toast } from 'react-toastify'
const axios = require('axios')

function Login() {
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [data, setData] = useState({
    isLoading: false,
    email: '',
    password: '',
    error: '',
  })
  const handleChange = (field) => {
    return (e) => setData((name) => ({ ...name, [field]: e.target.value }))
  }
  /**
   *
   * * @Login User
   */

  async function handleAuth(e) {
    e.preventDefault()
    setData({
      ...data,
      isLoading: true,
      error: '',
    })
    loginRequest(data)
      .then((res) => {
        setData({
          ...data,
          isLoading: false,
        })
        localStorage.setItem('accessToken', res.accessToken)
        localStorage.setItem('ID', res.id)
        localStorage.setItem('name', res.name)
        navigate('/dashboard')
        console.log(res)
      })
      .catch((error) => {
        setData({
          ...data,
          error: error.response.data.message,
        })
        console.log(error)
        // toast.error('could not fetch customers')
        // throw new Error("Couldn't list customers!")
      })
    return setTimeout(() => {
      setData({
        ...data,
        error: '',
      })
    }, 8000)
  }

  useEffect(() => {
    // Update network status
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
      console.log(navigator.onLine)
      if (navigator.onLine) {
        return toast.success('You are Online !', {
          position: toast.POSITION.BOTTOM_LEFT,
          theme: 'colored',
        })
      } else {
        return toast.error('You are Offline !', {
          position: toast.POSITION.BOTTOM_LEFT,
          theme: 'colored',
        })
      }
    }

    // Listen to the online status
    window.addEventListener('online', handleStatusChange)

    // Listen to the offline status
    window.addEventListener('offline', handleStatusChange)

    // Specify how to clean up after this effect for performance improvment
    // return () => {
    //   window.removeEventListener('online', handleStatusChange)
    //   window.removeEventListener('offline', handleStatusChange)
    // }
  }, [isOnline])

  return (
    <div className="container px-md-0">
      <div className="row w-100 g-5 min-vh-100 align-items-center m-0">
        <div className="col-md d-none d-md-block align-self-stretch m-0 ps-md-0">
          <div
            className="h-100 w-cover bg-cover"
            // style={{
            //   backgroundImage: 'url(https://landkit.goodthemes.co/assets/img/covers/cover-14.jpg)',
            //   backgroundRepeat: 'no-repeat',
            //   backgroundPosition: 'center',
            // }}
          ></div>
        </div>
        <div className="col-md-7 m-0">
          <div className="card rounded-0">
            <div className="card-body p-5">
              {/* {isOnline
                ? toast.success('You are Online !', {
                    position: toast.POSITION.BOTTOM_LEFT,
                    theme: 'colored',
                  })
                : toast.error('You are Offline !', {
                    position: toast.POSITION.BOTTOM_LEFT,
                    theme: 'colored',
                  })} */}
              {data.error && (
                <div
                  className="alert alert-danger d-flex align-items-center mx-0 mb-3 rounded-0"
                  role="alert"
                >
                  <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
                  <span>{data.error}</span>
                </div>
              )}
              {/* style={{ color: '#c58c4f' }} */}
              <h1 className="mb-0 fw-bold">Sign in</h1>
              <p className="mb-6 text-muted">Simplify your workflow in minutes.</p>
              <form autoComplete="off" className="mb-2" onSubmit={handleAuth}>
                <div className="form-group">
                  <label className="form-label" htmlFor="email">
                    Email Address
                  </label>
                  <input
                    type="email"
                    className="form-control rounded-0 auth-input auth-input-lg"
                    id="email"
                    name="email"
                    value={data.email}
                    placeholder="name@address.com"
                    onChange={handleChange('email')}
                    required
                  />
                </div>
                <div className="form-group mb-5">
                  <label className="form-label" htmlFor="password">
                    Password
                  </label>
                  <input
                    type="password"
                    className="form-control auth-input auth-input-lg rounded-0"
                    id="password"
                    name="password"
                    value={data.password}
                    placeholder="Enter your password"
                    onChange={handleChange('password')}
                    required
                  />
                </div>
                <button
                  type="submit"
                  className="btn w-100 rounded-0 auth-btn"
                  disabled={data.isLoading}
                >
                  {data.isLoading ? (
                    <span
                      className="spinner-border text-denter spinner-border-sm"
                      role="status"
                      aria-hidden="true"
                    ></span>
                  ) : (
                    'Sign in'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default Login
