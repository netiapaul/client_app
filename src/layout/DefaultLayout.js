import React from 'react'
import { AppContent, AppSidebar, AppFooter, AppHeader } from '../components/index'
import { Navigate } from 'react-router-dom'

const DefaultLayout = () => {
  if (
    !localStorage.getItem('accessToken') ||
    !localStorage.getItem('ID') ||
    !localStorage.getItem('name')
  )
    return <Navigate to={'/'} replace={true} />
  return (
    <div>
      <AppSidebar />
      <div className="wrapper d-flex flex-column min-vh-100 bg-light">
        <AppHeader />
        <div className="body flex-grow-1">
          <AppContent />
        </div>
        <AppFooter />
      </div>
    </div>
  )
}

export default DefaultLayout
