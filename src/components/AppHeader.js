import React from 'react'
import { useSelector, useDispatch } from 'react-redux'
import { CContainer, CHeader, CHeaderBrand, CHeaderNav, CHeaderToggler } from '@coreui/react'
import CIcon from '@coreui/icons-react'
import { cilMenu } from '@coreui/icons'

import { AppBreadcrumb } from './index'
import { AppHeaderDropdown } from './header/index'
import ThemeToggle from './ThemeToggle'
import { logo } from 'src/assets/brand/logo'

const AppHeader = () => {
  const dispatch = useDispatch()
  const sidebarShow = useSelector((state) => state.sidebarShow)
  const collapsed = useSelector((state) => state.sidebarUnfoldable)

  /** The hamburger means different things at different widths, because the sidebar does. */
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
          <CHeaderNav className="ms-auto">
            <ThemeToggle />
          </CHeaderNav>
          <CHeaderNav className="ms-2">
            <AppHeaderDropdown />
          </CHeaderNav>
        </CContainer>
      </CHeader>
      <CContainer fluid className="mt-2">
        <AppBreadcrumb />
      </CContainer>
    </>
  )
}

export default AppHeader
