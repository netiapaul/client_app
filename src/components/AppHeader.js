import React from 'react'
// import { NavLink } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import {
  CContainer,
  CHeader,
  CHeaderBrand,
  // CHeaderDivider,
  CHeaderNav,
  CHeaderToggler,
  // CNavLink,
  // CNavItem,
} from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu } from '@coreui/icons'
// import { cilBell, cilEnvelopeOpen, cilList, cilMenu } from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'
import ThemeToggle from './ThemeToggle'
import { logo } from 'src/assets/brand/logo'

const AppHeader = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const collapsed = useSelector((state) => state.sidebarUnfoldable)

  /**
   * The hamburger means different things at different widths, because the sidebar does.
   *
   * On desktop it COLLAPSES the sidebar to the icon rail — hiding it outright just leaves a blank
   * column and no way back except the same button. On narrow screens the sidebar is an off-canvas
   * overlay, so there the hamburger shows and hides it, which is the only sensible meaning there.
   *
   * The desktop choice is remembered: someone who works collapsed should not have to re-collapse
   * it on every page load.
   */
  const toggleSidebar = () => {
    const isDesktop = window.matchMedia('(min-width: 992px)').matches
    if (isDesktop) {
      const next = !collapsed
      localStorage.setItem('sidebarCollapsed', next ? '1' : '0')
      dispatch({ type: 'set', sidebarUnfoldable: next, sidebarShow: true })
    } else {
      dispatch({ type: 'set', sidebarShow: !sidebarShow })
    }
  }

  return (
    <>
      <CHeader position="sticky">
        <CContainer fluid>
          <CHeaderToggler
            className="ps-1"
            aria-label="Toggle the menu"
            aria-expanded={!collapsed}
            onClick={toggleSidebar}
          >
            <CIcon icon={cilMenu} size="lg" />
          </CHeaderToggler>
          <CHeaderBrand className="mx-auto d-md-none" to="/">
            <CIcon icon={logo} height={48} alt="Logo" />
          </CHeaderBrand>
          {/* <CHeaderNav className="d-none d-md-flex me-auto">
          <CNavItem>
            <CNavLink to="/dashboard" component={NavLink}>
              Dashboard
            </CNavLink>
          </CNavItem>
           <CNavItem>
            <CNavLink href="#">Users</CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">Settings</CNavLink>
          </CNavItem>
        </CHeaderNav>*/}
          {/* <CHeaderNav>
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilBell} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilList} size="lg" />
            </CNavLink>
          </CNavItem>
          <CNavItem>
            <CNavLink href="#">
              <CIcon icon={cilEnvelopeOpen} size="lg" />
            </CNavLink>
          </CNavItem>
        </CHeaderNav> */}
          <CHeaderNav className="ms-auto">
            <ThemeToggle />
          </CHeaderNav>
          <CHeaderNav className="ms-2">
            <AppHeaderDropdown />
          </CHeaderNav>
        </CContainer>
        {/* <CHeaderDivider />
        <CContainer fluid>
          <AppBreadcrumb />
        </CContainer> */}
      </CHeader>
      <CContainer fluid className="mt-2">
        <AppBreadcrumb />
      </CContainer>
    </>
  )
}

export default AppHeader
