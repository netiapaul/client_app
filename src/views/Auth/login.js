import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
const axios = require('axios')

function Login() {
  const navigate = useNavigate()
  const [data, setData] = useState({
    isLoading: false,
    email: '',
    password: '',
    error: '',
  })
  const handleChange = (field) => {
    return (e) => setData((name) => ({ ...name, [field]: e.target.value }))
  }
  const handleAuth = async (e) => {
    e.preventDefault()
    setData({
      ...data,
      isLoading: true,
      error: '',
    })
    try {
      const response = await axios.post('http://102.37.102.247:5023/api/Auth/Login', {
        email: data.email,
        password: data.password,
      })
      if (response.statusText === 'OK') {
        setData({
          ...data,
          isLoading: false,
        })
        localStorage.setItem('accessToken', response.data.accessToken)
        localStorage.setItem('ID', response.data.id)
        navigate('/dashboard')
        console.log(response)
      }
    } catch (err) {
      setData({
        ...data,
        error: err.response.data.message,
        isLoading: false,
      })
      console.log(err)
    }
    return setTimeout(() => {
      setData({
        ...data,
        error: '',
      })
    }, 8000)
  }
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
        <div className="col-md-6 m-0">
          <div className="card rounded-0">
            <div className="card-body p-5">
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
