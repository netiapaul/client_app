import React, { useEffect, useState } from 'react'
import { CSpinner } from '@coreui/react'
import { subscribeToLoading } from '../utils/loadingTracker'

// Short delay so fast requests don't flash the overlay
const SHOW_DELAY_MS = 200

const PageLoader = () => {
  const [isLoading, setIsLoading] = useState(false)
  const [visible, setVisible] = useState(false)

  useEffect(() => subscribeToLoading(setIsLoading), [])

  useEffect(() => {
    if (!isLoading) {
      setVisible(false)
      return
    }
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
    return () => clearTimeout(timer)
  }, [isLoading])

  if (!visible) return null

  return (
    <div className="page-loader" role="status" aria-live="polite">
      <div className="page-loader__content">
        <CSpinner color="primary" />
        <span className="page-loader__text">Loading...</span>
      </div>
    </div>
  )
}

export default PageLoader
