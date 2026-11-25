import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

import routes from '../routes'
import { hasModule } from '../utils/session'

/** May this user reach the route? `modules` is ANY-OF and takes precedence. */
const canReach = (route) => {
  if (route.modules?.length) return route.modules.some((m) => hasModule(m))
  return !route.module || hasModule(route.module)
}

const AppContent = () => {
  return (
    <CContainer>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            if (!route.element) return null
            // Gate the route: users without the required module are bounced to their profile.
            const Element = route.element
            // `route.props` lets one component serve two routes.
            const element = canReach(route) ? (
              <Element {...(route.props || {})} />
            ) : (
              <Navigate to="/profile" replace />
            )
            return (
              <Route
                key={idx}
                path={route.path}
                exact={route.exact}
                name={route.name}
                element={element}
              />
            )
          })}
          <Route path="/dashboard" element={<Navigate to="dashboard" replace />} />
        </Routes>
      </Suspense>
    </CContainer>
  )
}

export default React.memo(AppContent)
