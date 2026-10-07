import React from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

import routes from '../routes'
import { useBreadcrumbLabel } from '../context/BreadcrumbContext'

import { CBreadcrumb, CBreadcrumbItem } from '@coreui/react'

const AppBreadcrumb = () => {
  const navigate = useNavigate()
  const currentLocation = useLocation().pathname
  const { label } = useBreadcrumbLabel()

  // Does a route path (which may contain :params) match this pathname segment-for-segment?
  const pathMatches = (routePath, pathname) => {
    const rp = routePath.split('/')
    const pn = pathname.split('/')
    if (rp.length !== pn.length) return false
    return rp.every((seg, i) => seg.startsWith(':') || seg === pn[i])
  }

  const getRouteName = (pathname, routes) => {
    // Prefer an exact (static) route; fall back to a dynamic one (e.g. /client/:id -> "Update Client").
    const exact = routes.find((route) => route.path === pathname)
    if (exact) return exact.name
    const dynamic = routes.find(
      (route) => route.path.includes(':') && pathMatches(route.path, pathname),
    )
    return dynamic ? dynamic.name : false
  }

  const getBreadcrumbs = (location) => {
    const breadcrumbs = []
    location.split('/').reduce((prev, curr, index, array) => {
      const currentPathname = `${prev}/${curr}`
      const routeName = getRouteName(currentPathname, routes)
      routeName &&
        breadcrumbs.push({
          pathname: currentPathname,
          name: routeName,
          active: index + 1 === array.length,
        })
      return currentPathname
    })
    return breadcrumbs
  }

  const breadcrumbs = getBreadcrumbs(currentLocation)
  const atHome = currentLocation === '/dashboard' || currentLocation === '/'

  // SPA navigation for a crumb (no full page reload like the old href did).
  const go = (pathname) => (e) => {
    e.preventDefault()
    navigate(pathname)
  }

  return (
    <div className="app-breadcrumb d-flex align-items-center">
      <button
        type="button"
        className="app-breadcrumb-back"
        onClick={() => navigate(-1)}
        title="Go back"
        aria-label="Go back"
      >
        <span className="material-icons">arrow_back</span>
      </button>

      <CBreadcrumb className="m-0">
        <CBreadcrumbItem
          {...(atHome ? { active: true } : { href: '/dashboard', onClick: go('/dashboard') })}
        >
          <span className="material-icons app-breadcrumb-home">home</span>
          Home
        </CBreadcrumbItem>
        {breadcrumbs.map((breadcrumb, index) =>
          breadcrumb.active ? (
            <CBreadcrumbItem key={index} active>
              {label || breadcrumb.name}
            </CBreadcrumbItem>
          ) : (
            <CBreadcrumbItem
              key={index}
              href={breadcrumb.pathname}
              onClick={go(breadcrumb.pathname)}
            >
              {breadcrumb.name}
            </CBreadcrumbItem>
          ),
        )}
      </CBreadcrumb>
    </div>
  )
}

export default React.memo(AppBreadcrumb)
