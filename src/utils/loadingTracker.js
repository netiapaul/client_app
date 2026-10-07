import axios from 'axios'

// Counts in-flight GET requests (axios + fetch) so a global loader can show while pages load data.
// Only GETs are tracked: form submissions already show their own button spinners.
let pending = 0
const listeners = new Set()

const notify = () => listeners.forEach((listener) => listener(pending > 0))
const start = () => {
  pending += 1
  notify()
}
const done = () => {
  pending = Math.max(0, pending - 1)
  notify()
}

export const subscribeToLoading = (listener) => {
  listeners.add(listener)
  listener(pending > 0)
  return () => listeners.delete(listener)
}

const isGet = (method) => !method || method.toUpperCase() === 'GET'

const attachInterceptors = (instance) => {
  instance.interceptors.request.use(
    (config) => {
      if (isGet(config.method)) {
        config.__tracked = true
        start()
      }
      return config
    },
    (error) => Promise.reject(error),
  )
  instance.interceptors.response.use(
    (response) => {
      if (response.config?.__tracked) done()
      return response
    },
    (error) => {
      if (error.config?.__tracked) done()
      return Promise.reject(error)
    },
  )
}

let installed = false

export const installLoadingTracker = () => {
  if (installed) return
  installed = true

  attachInterceptors(axios)

  // Instances from axios.create() don't inherit the default interceptors (e.g. ServiceInstance)
  const originalCreate = axios.create.bind(axios)
  axios.create = (...args) => {
    const instance = originalCreate(...args)
    attachInterceptors(instance)
    return instance
  }

  const originalFetch = window.fetch.bind(window)
  window.fetch = (input, init) => {
    const method = init?.method || (input instanceof Request ? input.method : 'GET')
    if (!isGet(method)) return originalFetch(input, init)
    start()
    return originalFetch(input, init).finally(done)
  }
}
