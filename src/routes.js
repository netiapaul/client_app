import React from 'react'
import { MODULES } from './utils/permissions'

const Dashboard = React.lazy(() => import('./views/dashboard/Dashboard'))
const CreateClient = React.lazy(() => import('./views/clients/createClient'))
const AccessModules = React.lazy(() => import('./views/clients/acessModules'))
const UpdateClient = React.lazy(() => import('./views/clients/updateClient'))
const Users = React.lazy(() => import('./views/users/users'))
const Branches = React.lazy(() => import('./views/branches/branches'))
const Servers = React.lazy(() => import('./views/servers/servers'))
const Analytics = React.lazy(() => import('./views/analytics/analytics'))
const Locations = React.lazy(() => import('./views/locations/locations'))
const Emails = React.lazy(() => import('./views/emails/emails'))
const UserLogs = React.lazy(() => import('./views/logs/userLogs'))
const Approvals = React.lazy(() => import('./views/approvals/approvals'))
const Profile = React.lazy(() => import('./views/profile/profile'))
const AccessControl = React.lazy(() => import('./views/accessControl/accessControl'))

// `module` gates the route: AppContent redirects users who lack it. Routes with no `module`
// (e.g. Profile) are always accessible to any signed-in user.
const routes = [
  {
    path: '/dashboard',
    exact: true,
    name: 'Dashboard',
    element: Dashboard,
    module: MODULES.ViewClients,
  },
  {
    path: '/client/:id',
    name: 'Update Client',
    element: UpdateClient,
    exact: true,
    module: MODULES.UpdateClient,
  },
  {
    path: '/client/create-client',
    name: 'Create Client',
    element: CreateClient,
    exact: true,
    module: MODULES.CreateClient,
  },
  {
    path: '/client/access-modules',
    name: 'Access Modules',
    element: AccessModules,
    exact: true,
    module: MODULES.ManageClientModules,
  },
  { path: '/users', name: 'Users', element: Users, exact: true, module: MODULES.ViewUsers },
  {
    path: '/access-control',
    name: 'Access Control',
    element: AccessControl,
    exact: true,
    module: MODULES.ManageAccessControl,
  },
  { path: '/user-branches', name: 'User Branches', element: Branches, exact: true },
  {
    path: '/servers',
    name: 'Servers',
    element: Servers,
    exact: true,
    module: MODULES.ManageServers,
  },
  {
    path: '/analytics',
    name: 'Analytics',
    element: Analytics,
    exact: true,
    module: MODULES.ManageServers,
  },
  {
    path: '/locations',
    name: 'Locations',
    element: Locations,
    exact: true,
    module: MODULES.ManageLocations,
  },
  { path: '/emails', name: 'Emails', element: Emails, exact: true, module: MODULES.ViewEmails },
  {
    path: '/user-logs',
    name: 'User Logs',
    element: UserLogs,
    exact: true,
    module: MODULES.ViewUserLogs,
  },
  {
    path: '/approvals',
    name: 'Approvals',
    element: Approvals,
    exact: true,
    module: MODULES.ViewApprovals,
  },
  { path: '/profile', name: 'My Profile', element: Profile, exact: true },
]

export default routes
