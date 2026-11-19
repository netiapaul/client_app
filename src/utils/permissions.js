// Module codes — must match the backend ModuleCodes catalog (ClientsApi/Model/SystemModule.cs).
// These are stable permission identifiers used to gate menus, routes, and buttons.
export const MODULES = {
  ViewClients: 1,
  CreateClient: 2,
  UpdateClient: 3,
  AddBranch: 4,
  ViewUsers: 5,
  ManageUsers: 6,
  DeleteUsers: 7,
  ManageAccessControl: 8,
  ViewApprovals: 9,
  ApproveChanges: 10,
  ViewEmails: 11,
  ManageSmtp: 12,
  ManageServers: 13,
  ManageLocations: 14,
  ViewUserLogs: 15,
  ManageClientModules: 16,
  ManageBranchLocations: 17,
  ViewBranchLocations: 18,
  ViewDuplicateBranches: 19,
  ResolveDuplicateBranches: 20,

  // Billing, payments and the client portal. Viewing money and moving money are separate rights.
  ViewBilling: 21,
  ManageBilling: 22,
  ViewPayments: 23,
  RecordPayments: 24,
  ManageClientPortalUsers: 25,

  // 26/27 were ViewSms/ManageSms. SMS now uses ViewEmails/ManageSmtp — one right covers messaging
  // setup, email and SMS alike. The numbers are not reused.
}
