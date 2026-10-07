import axios from 'axios'
import { getToken, clearSession } from './session'

// Centralizes auth on every axios call so screens don't hand-roll the Authorization header,
// and a 401 (expired/invalid token) logs the user out instead of failing silently.

let redirecting = false
const handleUnauthorized = () => {
  if (redirecting) return
  redirecting = true
  clearSession()
  // Flag so the login page can tell the user why they're back here.
  try {
    sessionStorage.setItem('sessionExpired', '1')
  } catch {
    /* ignore storage errors */
  }
  // Hard redirect to the login route (outside React Router) for a clean reset.
  if (window.location.pathname !== '/') {
    window.location.assign('/')
  } else {
    redirecting = false
  }
}

const attachInterceptors = (instance) => {
  // Attach the bearer token when the caller hasn't set one explicitly.
  instance.interceptors.request.use(
    (config) => {
      const token = getToken()
      if (token) {
        config.headers = config.headers || {}
        if (!config.headers.Authorization && !config.headers.authorization) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
      return config
    },
    (error) => Promise.reject(error),
  )

  instance.interceptors.response.use(
    (response) => response,
    (error) => {
      if (error?.response?.status === 401) handleUnauthorized()
      return Promise.reject(error)
    },
  )
}

let installed = false

export const installAuthInterceptor = () => {
  if (installed) return
  installed = true

  attachInterceptors(axios)

  // Instances from axios.create() don't inherit the default interceptors, so patch create too.
  const originalCreate = axios.create.bind(axios)
  axios.create = (...args) => {
    const instance = originalCreate(...args)
    attachInterceptors(instance)
    return instance
  }
}
