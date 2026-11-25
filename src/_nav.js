import React from 'react'
import { CNavGroup, CNavItem } from '@coreui/react'
import { MODULES } from './utils/permissions'

/** The sidebar. Grouped rather than one long list. */
const _nav = [
  {
    component: CNavItem,
    name: 'Licenses',
    to: '/dashboard',
    module: MODULES.ViewClients,
    icon: <span className="material-icons nav-icon">home</span>,
  },
  {
    component: CNavGroup,
    name: 'Clients',
    icon: <span className="material-icons nav-icon">apartment</span>,
    items: [
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
        component: CNavItem,
        name: 'Branch Locations',
        to: '/branch-locations',
        module: MODULES.ViewBranchLocations,
        icon: <span className="material-icons nav-icon">pin_drop</span>,
      },
      {
        component: CNavItem,
        name: 'Duplicate Branches',
        to: '/duplicate-branches',
        module: MODULES.ViewDuplicateBranches,
        icon: <span className="material-icons nav-icon">content_copy</span>,
      },
      {
        // Its own entry rather than a tab on the duplicates screen.
        component: CNavItem,
        name: 'Archived Branches',
        to: '/archived-branches',
        module: MODULES.ViewArchivedBranches,
        icon: <span className="material-icons nav-icon">inventory_2</span>,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Billing',
    icon: <span className="material-icons nav-icon">receipt_long</span>,
    items: [
      {
        component: CNavItem,
        name: 'Billing Profiles',
        to: '/billing-profiles',
        module: MODULES.ViewBilling,
        icon: <span className="material-icons nav-icon">payments</span>,
      },
      {
        // Next to Billing Profiles on purpose.
        component: CNavItem,
        name: 'Add-on Pricing',
        to: '/addon-pricing',
        module: MODULES.ViewBilling,
        icon: <span className="material-icons nav-icon">extension</span>,
      },
      {
        // With the other two pricing screens rather than under Setup, for the same reason.
        component: CNavItem,
        name: 'Billable Items',
        to: '/billable-items',
        module: MODULES.ViewBilling,
        icon: <span className="material-icons nav-icon">sell</span>,
      },
      {
        component: CNavItem,
        name: 'Proforma Invoices',
        to: '/invoices',
        module: MODULES.ViewBilling,
        icon: <span className="material-icons nav-icon">description</span>,
      },
      {
        component: CNavItem,
        name: 'Payments',
        to: '/payments',
        module: MODULES.ViewPayments,
        icon: <span className="material-icons nav-icon">account_balance_wallet</span>,
      },
      {
        // Directly under Payments, because it is the other half of the same question.
        component: CNavItem,
        name: 'Transactions',
        to: '/payment-attempts',
        module: MODULES.ViewPayments,
        icon: <span className="material-icons nav-icon">swap_horiz</span>,
      },
      {
        component: CNavItem,
        name: 'Portal Users',
        to: '/portal-users',
        module: MODULES.ManageClientPortalUsers,
        icon: <span className="material-icons nav-icon">groups</span>,
      },
    ],
  },
  {
    // Named to match the access-control group: one right (ManageSmtp) covers both channels.
    component: CNavGroup,
    name: 'Messaging',
    icon: <span className="material-icons nav-icon">forum</span>,
    items: [
      {
        component: CNavItem,
        name: 'Emails',
        to: '/emails',
        module: MODULES.ViewEmails,
        icon: <span className="material-icons nav-icon">email</span>,
      },
      {
        component: CNavItem,
        name: 'SMS',
        to: '/sms',
        module: MODULES.ViewEmails,
        icon: <span className="material-icons nav-icon">sms</span>,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Infrastructure',
    icon: <span className="material-icons nav-icon">lan</span>,
    items: [
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
      },
      {
        // Maintenance of the region/county/town catalog — infrastructure, not a client screen.
        component: CNavItem,
        name: 'Locations',
        to: '/locations',
        module: MODULES.ManageLocations,
        icon: <span className="material-icons nav-icon">place</span>,
      },
    ],
  },
  {
    component: CNavGroup,
    name: 'Users & Security',
    icon: <span className="material-icons nav-icon">security</span>,
    items: [
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
      },
      {
        component: CNavItem,
        name: 'User Logs',
        to: '/user-logs',
        module: MODULES.ViewUserLogs,
        icon: <span className="material-icons nav-icon">history</span>,
      },
    ],
  },
  {
    // One entry for every integration and letterhead setting.
    component: CNavItem,
    name: 'Setup',
    to: '/setup',
    modules: [
      MODULES.ManageSmtp,
      MODULES.RecordPayments,
      MODULES.ViewBilling,
      MODULES.ManageBilling,
    ],
    icon: <span className="material-icons nav-icon">settings</span>,
  },
]

export default _nav
