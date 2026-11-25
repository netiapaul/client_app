import React, { Component, Suspense } from 'react'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import ErrorBoundary from './components/ErrorBoundary'
import './scss/style.scss'

const loading = (
  <div className="pt-3 text-center">
    <div className="sk-spinner sk-spinner-pulse"></div>
  </div>
)

// Containers
const DefaultLayout = React.lazy(() => import('./layout/DefaultLayout'))

// Pages
const Login = React.lazy(() => import('./views/Auth/login'))
// The client portal is mounted outside DefaultLayout on purpose: that layout is the staff shell.
const PortalLayout = React.lazy(() => import('./layout/PortalLayout'))

class App extends Component {
  render() {
    return (
      <ErrorBoundary>
        <BrowserRouter>
          <Suspense fallback={loading}>
            <Routes>
              <Route exact path="/" name="Login Page" element={<Login />} />
              <Route path="/portal/*" name="Client Portal" element={<PortalLayout />} />
              <Route path="*" name="Home" element={<DefaultLayout />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </ErrorBoundary>
    )
  }
}

export default App
