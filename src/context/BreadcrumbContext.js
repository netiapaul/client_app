import React, { createContext, useContext, useState } from 'react'
import PropTypes from 'prop-types'

// Lets a routed page supply a friendly label for the current (dynamic) breadcrumb crumb —
// e.g. the client name on /client/:id — which AppBreadcrumb then shows.
const BreadcrumbContext = createContext({ label: null, setLabel: () => {} })

export const BreadcrumbProvider = ({ children }) => {
  const [label, setLabel] = useState(null)
  return (
    <BreadcrumbContext.Provider value={{ label, setLabel }}>{children}</BreadcrumbContext.Provider>
  )
}

BreadcrumbProvider.propTypes = {
  children: PropTypes.node,
}

export const useBreadcrumbLabel = () => useContext(BreadcrumbContext)

export default BreadcrumbContext
