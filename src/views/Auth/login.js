import React, { useState, useEffect } from 'react'
import { setSession } from '../../utils/session'
import { useNavigate } from 'react-router-dom'
import { loginRequest, loginTwoFactorRequest } from '../../utils/requests'
import { toast } from 'react-toastify'
// const axios = require('axios')
import CompanyRight from '../../assets/images/corebase.png'

function Login() {
  const navigate = useNavigate()
  const [isOnline, setIsOnline] = useState(navigator.onLine)
  const [data, setData] = useState({
    isLoading: false,
    email: '',
    password: '',
    error: '',
    requiresTwoFactor: false,
    twoFactorToken: '',
    code: '',
  })
  const handleChange = (field) => {
    return (e) => setData((name) => ({ ...name, [field]: e.target.value }))
  }
  /**
   *
   * * @Login User
   */

  // Store the token + redirect once we have a real access token (shared by both login steps).
  const completeLogin = (res) => {
    const modules = res.modules || []
    setSession({
      token: res.accessToken,
      id: res.id,
      name: res.name,
      canApprove: res.canApprove,
      modules,
    })
    // Land on the dashboard if they can view clients; otherwise send them to their profile
    // (always accessible) so a user without client access doesn't hit a permission wall.
    const landing = modules.includes(1) ? '/dashboard' : '/profile'
    navigate(landing, { replace: true })
  }

  async function handleAuth(e) {
    e.preventDefault()
    setData((d) => ({ ...d, isLoading: true, error: '' }))
    try {
      const res = await loginRequest(data)
      // 2FA account: password was correct, but we still need the authenticator code.
      if (res?.requiresTwoFactor) {
        setData((d) => ({
          ...d,
          isLoading: false,
          requiresTwoFactor: true,
          twoFactorToken: res.twoFactorToken,
          code: '',
        }))
        return
      }
      completeLogin(res)
    } catch (error) {
      setData((d) => ({
        ...d,
        isLoading: false,
        error: error.response?.data?.message || error?.message,
      }))
    }
  }

  // Second step: submit the 6-digit authenticator code (or a backup code).
  async function handleVerify(e) {
    e.preventDefault()
    setData((d) => ({ ...d, isLoading: true, error: '' }))
    try {
      const res = await loginTwoFactorRequest({
        twoFactorToken: data.twoFactorToken,
        code: data.code,
      })
      completeLogin(res)
    } catch (error) {
      setData((d) => ({
        ...d,
        isLoading: false,
        error: error.response?.data?.message || error?.message,
      }))
    }
  }

  const backToSignIn = () =>
    setData((d) => ({ ...d, requiresTwoFactor: false, twoFactorToken: '', code: '', error: '' }))

  // Tell the user why they're back at login after an expired/invalid session (set by the 401 interceptor).
  useEffect(() => {
    if (sessionStorage.getItem('sessionExpired')) {
      sessionStorage.removeItem('sessionExpired')
      toast.info('Your session has expired. Please sign in again.', {
        position: toast.POSITION.BOTTOM_LEFT,
        theme: 'colored',
      })
    }
  }, [])

  useEffect(() => {
    // Update network status
    const handleStatusChange = () => {
      setIsOnline(navigator.onLine)
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
    // <div className="container-fluid min-vh-100 login_page">
    //   {/* <div className="row w-100 g-5 min-vh-100 align-items-center m-0"> */}
    //   <div className="row min-vh-100 align-items-center">
    //     <div className="col-md d-none d-md-block align-self-stretch m-0 ps-md-0">
    //       <div className="h-100 w-cover bg-cover"></div>
    //     </div>
    //     <div className="col-md-7 m-0">
    //       <div className="card rounded-0">
    //         <div className="card-body p-5">
    //           <div className="mt-5 mb-3">
    //             <h2 className="mb-3">
    //               <span className="company_text_color">phAMACore</span> &trade;
    //             </h2>
    //             <h5 className="mb-1">Welcome back!</h5>
    //             <p className="text-muted">Please enter your credentials to sign in!</p>
    //           </div>

    //           {data.error && (
    //             <div
    //               className="alert alert-danger d-flex align-items-center mx-0 mb-3 rounded-0"
    //               role="alert"
    //             >
    //               <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
    //               <span>{data.error}</span>
    //             </div>
    //           )}
    //           <form autoComplete="off" className="mb-2" onSubmit={handleAuth}>
    //             <div className="form-group">
    //               <label className="form-label" htmlFor="email">
    //                 Email Address
    //               </label>
    //               <input
    //                 type="email"
    //                 className="form-control rounded-0 auth-input auth-input-lg"
    //                 id="email"
    //                 name="email"
    //                 value={data.email}
    //                 placeholder="name@address.com"
    //                 onChange={handleChange('email')}
    //                 required
    //               />
    //             </div>
    //             <div className="form-group mb-5">
    //               <label className="form-label" htmlFor="password">
    //                 Password
    //               </label>
    //               <input
    //                 type="password"
    //                 className="form-control auth-input auth-input-lg rounded-0"
    //                 id="password"
    //                 name="password"
    //                 value={data.password}
    //                 placeholder="Enter your password"
    //                 onChange={handleChange('password')}
    //                 required
    //               />
    //             </div>
    //             <button
    //               type="submit"
    //               className="btn w-100 rounded-0 auth-btn"
    //               disabled={data.isLoading}
    //             >
    //               {data.isLoading ? (
    //                 <span
    //                   className="spinner-border text-denter spinner-border-sm"
    //                   role="status"
    //                   aria-hidden="true"
    //                 ></span>
    //               ) : (
    //                 'Sign in'
    //               )}
    //             </button>
    //           </form>
    //         </div>
    //       </div>
    //     </div>
    //   </div>
    // </div>

    <div className="container-fluid min-vh-100 login_page">
      <div className="row min-vh-100 align-items-center">
        <div className="col-md-4 min-vh-100 d-none d-xl-block login_asset"></div>
        <div className="col-md">
          <div className="card border-0">
            <div className="card-body d-grid col-md-10 col-12 col-lg-5 col-xl-4 mx-auto">
              <div className="mt-5 mb-3">
                <h2 className="mb-3">
                  <span className="company_text_color">phAMACore</span> &trade;
                </h2>
                <h5 className="mb-1">
                  {data.requiresTwoFactor ? 'Two-step verification' : 'Welcome back!'}
                </h5>
                <p className="text-muted">
                  {data.requiresTwoFactor
                    ? 'Enter the 6-digit code from your authenticator app.'
                    : 'Please enter your credentials to sign in!'}
                </p>
              </div>
              <div>
                {data.error && (
                  <div
                    className="alert alert-danger d-flex align-items-center mx-0 mb-3 rounded-0"
                    role="alert"
                  >
                    <i className="fa fa-exclamation-triangle me-3" aria-hidden="true"></i>
                    <span>{data.error}</span>
                  </div>
                )}
                {!data.requiresTwoFactor ? (
                  <form autoComplete="off" className="mb-2" onSubmit={handleAuth}>
                    <div className="mb-3">
                      <label htmlFor="email" className="form-label">
                        Email address
                      </label>
                      <input
                        type="email"
                        className="form-control auth-input auth-input-lg"
                        id="email"
                        name="email"
                        value={data.email}
                        placeholder="name@address.com"
                        onChange={handleChange('email')}
                        required
                      />
                    </div>
                    <div className="mb-3">
                      <label htmlFor="password" className="form-label">
                        Password
                      </label>
                      <input
                        type="password"
                        className="form-control auth-input auth-input-lg"
                        id="password"
                        name="password"
                        value={data.password}
                        placeholder="Enter your password"
                        onChange={handleChange('password')}
                        required
                      />
                    </div>
                    <div className="form-check mb-3">
                      <input
                        type="checkbox"
                        className="form-check-input"
                        id="customControlInline"
                        disabled
                      />
                      <label className="form-check-label" htmlFor="customControlInline">
                        Remember me
                      </label>
                    </div>
                    <div className="d-grid gap-2 mb-3">
                      <button
                        type="submit"
                        className="btn w-100 auth-btn"
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
                    </div>
                  </form>
                ) : (
                  <form autoComplete="off" className="mb-2" onSubmit={handleVerify}>
                    <div className="mb-3">
                      <label htmlFor="code" className="form-label">
                        Authentication code
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        className="form-control auth-input auth-input-lg"
                        id="code"
                        name="code"
                        value={data.code}
                        placeholder="123456 or a backup code"
                        onChange={handleChange('code')}
                        autoFocus
                        required
                      />
                    </div>
                    <div className="d-grid gap-2 mb-2">
                      <button
                        type="submit"
                        className="btn w-100 auth-btn"
                        disabled={data.isLoading}
                      >
                        {data.isLoading ? (
                          <span
                            className="spinner-border text-denter spinner-border-sm"
                            role="status"
                            aria-hidden="true"
                          ></span>
                        ) : (
                          'Verify'
                        )}
                      </button>
                    </div>
                    <button
                      type="button"
                      className="btn btn-link p-0 text-muted"
                      onClick={backToSignIn}
                    >
                      ← Back to sign in
                    </button>
                  </form>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
      <footer id="login-footer">
        <div className="copy-right text-center my-2">
          <p className="m-0 company-sm">Powered by</p>
          <img width="15" className="img-fluid" src={CompanyRight} alt="company brand" />
          <p className="m-0 company-sm">CoreBase Solutions</p>
        </div>
      </footer>
    </div>
  )
}

export default Login
