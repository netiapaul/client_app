import React from 'react'
import { CNavItem, CNavTitle } from '@coreui/react'
import { MODULES } from './utils/permissions'

// Each item carries the module code required to see it. AppSidebarNav hides items the user
// lacks. Items with no `module` are always shown. (Admins receive every module code at login.)
// CNavTitle entries are section headings; a heading is hidden when none of its items are visible.
const _nav = [
  {
    component: CNavTitle,
    name: 'Clients',
  },
  {
    component: CNavItem,
    name: 'Licenses',
    to: '/dashboard',
    module: MODULES.ViewClients,
    icon: <span className="material-icons nav-icon">home</span>,
  },
  {
    component: CNavItem,
    name: 'Approvals',
    to: '/approvals',
    module: MODULES.ViewApprovals,
    icon: <span className="material-icons nav-icon">verified</span>,
  },
  {
    component: CNavItem,
    name: 'Client Access Modules',
    to: '/client/access-modules',
    module: MODULES.ManageClientModules,
    icon: <span className="material-icons nav-icon">extension</span>,
  },
  {
    component: CNavTitle,
    name: 'Infrastructure',
  },
  {
    component: CNavItem,
    name: 'Servers',
    to: '/servers',
    module: MODULES.ManageServers,
    icon: <span className="material-icons nav-icon">dns</span>,
  },
  {
    component: CNavItem,
    name: 'Analytics',
    to: '/analytics',
    module: MODULES.ManageServers,
    icon: <span className="material-icons nav-icon">insights</span>,
    badge: { color: 'info', text: 'NEW' },
  },
  {
    component: CNavTitle,
    name: 'Users & Security',
  },
  {
    component: CNavItem,
    name: 'Users',
    to: '/users',
    module: MODULES.ViewUsers,
    icon: <span className="material-icons nav-icon">group</span>,
  },
  {
    component: CNavItem,
    name: 'Access Control',
    to: '/access-control',
    module: MODULES.ManageAccessControl,
    icon: <span className="material-icons nav-icon">admin_panel_settings</span>,
    badge: { color: 'info', text: 'NEW' },
  },
  {
    component: CNavItem,
    name: 'User Logs',
    to: '/user-logs',
    module: MODULES.ViewUserLogs,
    icon: <span className="material-icons nav-icon">history</span>,
  },
  {
    component: CNavTitle,
    name: 'Settings',
  },
  {
    component: CNavItem,
    name: 'Emails',
    to: '/emails',
    module: MODULES.ViewEmails,
    icon: <span className="material-icons nav-icon">email</span>,
  },
  {
    component: CNavItem,
    name: 'Locations',
    to: '/locations',
    module: MODULES.ManageLocations,
    icon: <span className="material-icons nav-icon">place</span>,
  },
]

export default _nav
