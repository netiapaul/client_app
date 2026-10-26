import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

// routes config
import routes from '../routes'
import { hasModule } from '../utils/session'

const AppContent = () => {
  return (
    <CContainer>
      <Suspense fallback={<CSpinner color="primary" />}>
        <Routes>
          {routes.map((route, idx) => {
            if (!route.element) return null
            // Gate the route: users without the required module are bounced to their profile
            // (always accessible) rather than hitting a blank page or a backend 403.
            const Element = route.element
            const element =
              route.module && !hasModule(route.module) ? (
                <Navigate to="/profile" replace />
              ) : (
                <Element />
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
