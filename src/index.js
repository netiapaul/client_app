import 'react-app-polyfill/stable'
import 'core-js'
import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import reportWebVitals from './reportWebVitals'
import { Provider } from 'react-redux'
import store from './store'
import { ToastContainer } from 'react-toastify'
import 'react-datepicker/dist/react-datepicker.css'
import 'react-toastify/dist/ReactToastify.css'
import 'react-phone-input-2/lib/style.css'
import 'bootstrap/dist/css/bootstrap.min.css'
import 'bootstrap/dist/js/bootstrap.bundle.min'
import { installLoadingTracker } from './utils/loadingTracker'
import { installAuthInterceptor } from './utils/authInterceptor'

installLoadingTracker()
installAuthInterceptor()

// Apply the persisted colour theme before first paint (avoids a flash of light UI).
if (localStorage.getItem('theme') === 'dark') {
  document.documentElement.classList.add('theme-dark')
}

createRoot(document.getElementById('root')).render(
  <Provider store={store}>
    <App />
    <ToastContainer
      limit={1}
      autoClose={5000}
      hideProgressBar={true}
      newestOnTop={false}
      closeOnClick={false}
      rtl={false}
      pauseOnFocusLoss={false}
      draggable={false}
      pauseOnHover={false}
      theme="colored"
    />
  </Provider>,
)

reportWebVitals()
