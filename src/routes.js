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
const BranchLocations = React.lazy(() => import('./views/locations/branchLocations'))
const DuplicateBranches = React.lazy(() => import('./views/clients/duplicateBranches'))
const Emails = React.lazy(() => import('./views/emails/emails'))
const Sms = React.lazy(() => import('./views/sms/sms'))
const Payments = React.lazy(() => import('./views/billing/payments'))
const PaymentAttempts = React.lazy(() => import('./views/billing/paymentAttempts'))
const Setup = React.lazy(() => import('./views/setup/setup'))
const AddOnPricing = React.lazy(() => import('./views/billing/addOnPricing'))
const BillableItems = React.lazy(() => import('./views/billing/billableItems'))
const UserLogs = React.lazy(() => import('./views/logs/userLogs'))
const Approvals = React.lazy(() => import('./views/approvals/approvals'))
const Profile = React.lazy(() => import('./views/profile/profile'))
const AccessControl = React.lazy(() => import('./views/accessControl/accessControl'))
const PortalUsers = React.lazy(() => import('./views/portal/portalUsers'))
const BillingProfiles = React.lazy(() => import('./views/billing/billingProfiles'))
const Invoices = React.lazy(() => import('./views/billing/invoices'))

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
  {
    path: '/branch-locations',
    name: 'Branch Locations',
    element: BranchLocations,
    exact: true,
    // Opening the screen needs View; editing needs ManageBranchLocations, checked inside it.
    module: MODULES.ViewBranchLocations,
  },
  {
    path: '/duplicate-branches',
    name: 'Duplicate Branches',
    element: DuplicateBranches,
    exact: true,
    // Viewing is read-only; deleting rows needs ResolveDuplicateBranches, checked inside.
    module: MODULES.ViewDuplicateBranches,
  },
  {
    path: '/billing-profiles',
    name: 'Billing Profiles',
    element: BillingProfiles,
    exact: true,
    // Viewing needs ViewBilling; changing a price needs ManageBilling, checked inside.
    module: MODULES.ViewBilling,
  },
  {
    path: '/invoices',
    name: 'Proforma Invoices',
    element: Invoices,
    exact: true,
    // Viewing needs ViewBilling; raising and issuing need ManageBilling, checked inside.
    module: MODULES.ViewBilling,
  },
  {
    path: '/addon-pricing',
    name: 'Add-on Pricing',
    element: AddOnPricing,
    exact: true,
    // Viewing needs ViewBilling; saving a price needs ManageBilling, checked inside and again on
    // the endpoint.
    module: MODULES.ViewBilling,
  },
  {
    path: '/billable-items',
    name: 'Billable Items',
    element: BillableItems,
    exact: true,
    // Viewing needs ViewBilling; saving the catalogue needs ManageBilling, checked inside and
    // again on the endpoint.
    module: MODULES.ViewBilling,
  },
  {
    path: '/payments',
    name: 'Payments',
    element: Payments,
    exact: true,
    // Reading the ledger needs ViewPayments; banking, allocating and simulating need
    // RecordPayments, checked inside and again on every endpoint.
    module: MODULES.ViewPayments,
  },
  {
    path: '/payment-attempts',
    name: 'Transactions',
    element: PaymentAttempts,
    exact: true,
    // Reading needs ViewPayments. Refreshing an attempt can BANK money, so that action needs
    // RecordPayments — checked inside the screen and again on the endpoint it calls.
    module: MODULES.ViewPayments,
  },
  {
    path: '/portal-users',
    name: 'Client Portal Users',
    element: PortalUsers,
    exact: true,
    module: MODULES.ManageClientPortalUsers,
  },
  { path: '/emails', name: 'Emails', element: Emails, exact: true, module: MODULES.ViewEmails },
  // Same rights as Emails: ViewEmails reaches the screen, ManageSmtp opens the settings panel.
  { path: '/sms', name: 'SMS', element: Sms, exact: true, module: MODULES.ViewEmails },
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
  {
    path: '/setup',
    name: 'Setup',
    element: Setup,
    exact: true,
    // ANY-OF: the page is four independently-gated sections, and each one's own endpoints enforce
    // the same rights again. Someone with only ManageSmtp reaches it and sees two tabs.
    modules: [
      MODULES.ManageSmtp,
      MODULES.RecordPayments,
      MODULES.ViewBilling,
      MODULES.ManageBilling,
    ],
  },
  { path: '/profile', name: 'My Profile', element: Profile, exact: true },
]

export default routes
