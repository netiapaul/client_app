import React from 'react'
import { isAuthenticated } from '../utils/session'
import { AppContent, AppSidebar, AppFooter, AppHeader, PageLoader } from '../components/index'
import { Navigate } from 'react-router-dom'
import { BreadcrumbProvider } from '../context/BreadcrumbContext'

const DefaultLayout = () => {
  if (!isAuthenticated()) return <Navigate to={'/'} replace={true} />
  return (
    <BreadcrumbProvider>
      <div>
        <AppSidebar />
        <div className="wrapper d-flex flex-column min-vh-100 bg-light">
          <AppHeader />
          <div className="body flex-grow-1 position-relative">
            <PageLoader />
            <AppContent />
          </div>
          <AppFooter />
        </div>
      </div>
    </BreadcrumbProvider>
  )
}

export default DefaultLayout
