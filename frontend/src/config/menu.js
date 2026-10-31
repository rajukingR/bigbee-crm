import {
  LuLayoutDashboard, LuChartNoAxesColumn, LuUserPlus, LuFileText, LuFolderKanban, LuBuilding2, LuWallet,
  LuClipboardCheck, LuMessageSquare, LuMegaphone, LuChartColumn, LuSettings, LuUserCog, LuCircleCheck,
  LuListTree, LuNetwork, LuCornerDownRight, LuCalendarDays, LuTrendingUp, LuLayers, LuPhoneCall, LuWrench,
  LuMonitor, LuShare2, LuFactory, LuCircleX, LuShieldCheck, LuBuilding,
} from 'react-icons/lu';

/**
 * Main sidebar. `module` = permission key needed to see the item.
 * Items with children render as an expandable group.
 */
export const MAIN_MENU = [
  { label: 'Dashboard', path: '/dashboard', icon: LuLayoutDashboard, module: 'dashboard' },
  { label: 'Manager Dashboard', path: '/manager-dashboard', icon: LuChartNoAxesColumn, module: 'manager_dashboard' },
  {
    label: 'Lead & Enquiry Management',
    icon: LuUserPlus,
    children: [
      { label: 'Companies', path: '/companies', module: 'companies' },
      { label: 'Contacts', path: '/contacts', module: 'contacts' },
      { label: 'Leads & Enquiries', path: '/leads', module: 'leads' },
      { label: 'Sales Funnel', path: '/opportunities', module: 'opportunities' },
      { label: 'Follow-ups', path: '/follow-ups', module: 'activities' },
      { label: 'Targets', path: '/targets', module: 'targets' },
    ],
  },
  { label: 'Proposal & Estimation', path: '/proposals', icon: LuFileText, module: 'proposals' },
  {
    label: 'Project Management',
    icon: LuFolderKanban,
    children: [
      { label: 'Projects', path: '/projects', module: 'projects' },
      { label: 'Tasks', path: '/tasks', module: 'tasks' },
    ],
  },
  {
    label: 'Vendor Management',
    icon: LuBuilding2,
    children: [
      { label: 'Vendors', path: '/vendors', module: 'vendors' },
      { label: 'Quotations', path: '/vendors/quotations', module: 'quotations' },
      { label: 'Purchase Orders', path: '/vendors/purchase-orders', module: 'purchase_orders' },
      { label: 'Vendor Bills', path: '/vendors/bills', module: 'vendor_bills' },
    ],
  },
  {
    label: 'Budget & Finance',
    icon: LuWallet,
    children: [
      { label: 'Invoices & Receipts', path: '/finance/invoices', module: 'invoices' },
      { label: 'Expenses', path: '/finance/expenses', module: 'expenses' },
      { label: 'Project Profitability', path: '/finance/profitability', module: 'profitability' },
      { label: 'Receivables Ageing', path: '/finance/receivables', module: ['profitability', 'invoices'] },
    ],
  },
  { label: 'Execution Tracker', path: '/execution', icon: LuClipboardCheck, module: 'execution' },
  {
    label: 'Feedback & Closure',
    icon: LuMessageSquare,
    children: [
      { label: 'Client Feedback', path: '/feedback', module: 'feedback' },
      { label: 'Escalations', path: '/feedback/escalations', module: 'escalations' },
      { label: 'Change Requests', path: '/feedback/change-requests', module: 'escalations' },
    ],
  },
  {
    label: 'Marketing',
    icon: LuMegaphone,
    children: [
      { label: 'Campaigns', path: '/marketing/campaigns', module: 'campaigns' },
      { label: 'Marketing ROI', path: '/marketing/roi', module: 'campaigns' },
    ],
  },
  { label: 'Reports & Analytics', path: '/reports', icon: LuChartColumn, module: 'reports' },
  {
    label: 'Admin & Automation',
    icon: LuSettings,
    children: [
      { label: 'Approvals', path: '/admin/approvals', module: 'approvals' },
      { label: 'Audit Logs', path: '/admin/audit-logs', module: 'audit_logs' },
      { label: 'Settings & Rules', path: '/admin/settings', module: 'settings' },
      { label: 'Data Import', path: '/admin/import', module: 'import' },
      { label: 'Org Chart', path: '/admin/org-chart', module: 'employees' },
    ],
  },
];

/** Masters sidebar (shown after clicking "Masters"). */
export const MASTER_MENU = [
  { label: 'Employee Master', path: '/masters/employees', icon: LuUserCog, module: 'employees' },
  { label: 'Roles', path: '/masters/roles', icon: LuCircleCheck, module: 'roles' },
  { label: 'Permissions', path: '/masters/permissions', icon: LuShieldCheck, module: 'permissions' },
  { label: 'Departments', path: '/masters/departments', icon: LuBuilding, module: 'departments' },
  { label: 'Lead Type', path: '/masters/lead-type', icon: LuListTree, module: 'masters' },
  { label: 'Lead Source', path: '/masters/lead-source', icon: LuNetwork, module: 'masters' },
  { label: 'Sub Source', path: '/masters/sub-source', icon: LuCornerDownRight, module: 'masters' },
  { label: 'Lead Event Type', path: '/masters/lead-event-type', icon: LuCalendarDays, module: 'masters' },
  { label: 'Lead Status', path: '/masters/lead-status', icon: LuCircleCheck, module: 'masters' },
  { label: 'Funnel Status', path: '/masters/funnel-status', icon: LuTrendingUp, module: 'masters' },
  { label: 'Category', path: '/masters/category', icon: LuLayers, module: 'masters' },
  { label: 'Follow Up Mode', path: '/masters/follow-up-mode', icon: LuPhoneCall, module: 'masters' },
  { label: 'Services', path: '/masters/services', icon: LuWrench, module: 'masters' },
  { label: 'Campaign Type', path: '/masters/campaign-type', icon: LuMegaphone, module: 'masters' },
  { label: 'Type of Advertising', path: '/masters/advertising-type', icon: LuMonitor, module: 'masters' },
  { label: 'Marketing Channel', path: '/masters/marketing-channel', icon: LuShare2, module: 'masters' },
  { label: 'Industry', path: '/masters/industry', icon: LuFactory, module: 'masters' },
  { label: 'Loss Reason', path: '/masters/loss-reason', icon: LuCircleX, module: 'masters' },
];

/** Page titles for the header, by path prefix. */
export const PAGE_TITLES = [
  ['/dashboard', 'Dashboard'],
  ['/manager-dashboard', 'Manager Dashboard'],
  ['/companies', 'Companies'],
  ['/contacts', 'Contacts'],
  ['/leads', 'Lead & Enquiry Management'],
  ['/opportunities', 'Sales Funnel'],
  ['/follow-ups', 'Follow-ups'],
  ['/targets', 'Targets'],
  ['/proposals', 'Proposal & Estimation'],
  ['/projects', 'Project Management'],
  ['/tasks', 'Tasks'],
  ['/vendors/quotations', 'Vendor Quotations'],
  ['/vendors/purchase-orders', 'Purchase Orders'],
  ['/vendors/bills', 'Vendor Bills'],
  ['/vendors', 'Vendor Management'],
  ['/finance/invoices', 'Invoices & Receipts'],
  ['/finance/expenses', 'Expenses'],
  ['/finance/profitability', 'Project Profitability'],
  ['/finance/receivables', 'Receivables Ageing'],
  ['/execution', 'Execution Tracker'],
  ['/feedback/escalations', 'Escalations'],
  ['/feedback/change-requests', 'Change Requests'],
  ['/feedback', 'Feedback & Closure'],
  ['/marketing/roi', 'Marketing ROI'],
  ['/marketing', 'Marketing'],
  ['/reports', 'Reports & Analytics'],
  ['/admin/approvals', 'Approvals'],
  ['/admin/audit-logs', 'Audit Logs'],
  ['/admin/settings', 'Settings & Rules'],
  ['/admin/import', 'Data Import'],
  ['/admin/org-chart', 'Organisation Chart'],
  ['/masters', 'Master Dashboard'],
  ['/profile', 'My Profile'],
  ['/notifications', 'Notifications'],
];
