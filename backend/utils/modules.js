/**
 * Permission modules. Every protected API route checks one of these keys
 * with one action (view | create | edit | delete | export | approve).
 */
const ACTIONS = ['view', 'create', 'edit', 'delete', 'export', 'approve'];

const MODULES = [
  { key: 'dashboard', label: 'Dashboard', group: 'Dashboards' },
  { key: 'manager_dashboard', label: 'Manager Dashboard', group: 'Dashboards' },
  { key: 'companies', label: 'Companies', group: 'Lead & Enquiry' },
  { key: 'contacts', label: 'Contacts', group: 'Lead & Enquiry' },
  { key: 'leads', label: 'Leads & Enquiries', group: 'Lead & Enquiry' },
  { key: 'opportunities', label: 'Opportunities / Funnel', group: 'Lead & Enquiry' },
  { key: 'activities', label: 'Activities & Follow-ups', group: 'Lead & Enquiry' },
  { key: 'targets', label: 'Targets', group: 'Lead & Enquiry' },
  { key: 'proposals', label: 'Proposal & Estimation', group: 'Proposal' },
  { key: 'projects', label: 'Projects', group: 'Project Management' },
  { key: 'tasks', label: 'Tasks & Milestones', group: 'Project Management' },
  { key: 'project_financials', label: 'Project Financial Fields', group: 'Project Management' },
  { key: 'vendors', label: 'Vendors', group: 'Vendor Management' },
  { key: 'vendor_bank', label: 'Vendor Bank Details (sensitive)', group: 'Vendor Management' },
  { key: 'quotations', label: 'Vendor Quotations', group: 'Vendor Management' },
  { key: 'purchase_orders', label: 'Purchase Orders', group: 'Vendor Management' },
  { key: 'vendor_bills', label: 'Vendor Bills & Payments', group: 'Vendor Management' },
  { key: 'invoices', label: 'Invoices & Receipts', group: 'Budget & Finance' },
  { key: 'expenses', label: 'Expenses', group: 'Budget & Finance' },
  { key: 'profitability', label: 'Profitability & Receivables', group: 'Budget & Finance' },
  { key: 'execution', label: 'Execution Tracker', group: 'Execution' },
  { key: 'feedback', label: 'Feedback & Closure', group: 'Feedback & Closure' },
  { key: 'escalations', label: 'Escalations & Change Requests', group: 'Feedback & Closure' },
  { key: 'campaigns', label: 'Marketing Campaigns', group: 'Marketing' },
  { key: 'reports', label: 'Reports & Analytics', group: 'Reports' },
  { key: 'approvals', label: 'Approvals', group: 'Admin & Automation' },
  { key: 'audit_logs', label: 'Audit Logs', group: 'Admin & Automation' },
  { key: 'settings', label: 'Settings & Rules', group: 'Admin & Automation' },
  { key: 'import', label: 'Data Import', group: 'Admin & Automation' },
  { key: 'employees', label: 'Employee Master', group: 'Masters' },
  { key: 'roles', label: 'Roles', group: 'Masters' },
  { key: 'permissions', label: 'Permissions', group: 'Masters' },
  { key: 'departments', label: 'Departments', group: 'Masters' },
  { key: 'masters', label: 'Other Masters (dropdowns)', group: 'Masters' },
];

const MODULE_KEYS = MODULES.map((m) => m.key);

module.exports = { ACTIONS, MODULES, MODULE_KEYS };
