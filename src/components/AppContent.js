import React, { Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { CContainer, CSpinner } from '@coreui/react'

// routes config
import routes from '../routes'
import { hasModule } from '../utils/session'

/**
 * May this user reach the route?
 *
 * `modules` is ANY-OF and takes precedence, mirroring both [RequireModule] on the server and the
 * sidebar's own pruning: a page built from independently-gated sections (Setup) must be reachable
 * by anyone who can use at least one of them. A route with neither field is open to any signed-in
 * user.
 */
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
            // Gate the route: users without the required module are bounced to their profile
            // (always accessible) rather than hitting a blank page or a backend 403.
            const Element = route.element
            const element = canReach(route) ? <Element /> : <Navigate to="/profile" replace />
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
