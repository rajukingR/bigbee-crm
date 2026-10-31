export const PRIORITIES = ['Low', 'Medium', 'High', 'Urgent'];
export const TASK_STATUSES = ['Not Started', 'In Progress', 'Waiting for Client', 'Waiting for Vendor', 'Blocked', 'Completed', 'Cancelled'];
export const PROJECT_STATUSES = ['Handover Pending', 'Planning', 'In Progress', 'Event Live', 'Completed', 'Closed', 'On Hold', 'Cancelled'];
export const HEALTH = ['Green', 'Amber', 'Red'];
export const ACTIVITY_TYPES = ['Call', 'Email', 'Meeting', 'WhatsApp', 'Site Visit', 'Proposal Sent', 'Note'];
export const CLIENT_TYPES = ['Prospect', 'Existing Client', 'Existing Data'];
export const BUCKETS = ['A', 'B', 'C', 'D'];
export const DECISION_ROLES = ['Decision Maker', 'Influencer', 'Gatekeeper', 'User', 'Other'];
export const COMPANY_SIZES = ['1-50', '51-200', '201-500', '501-1000', '1000-5000', '5000+'];
export const MILESTONE_TYPES = ['Internal', 'Client Approval', 'Venue Confirmation', 'Artist Confirmation', 'Vendor Delivery', 'Payment'];
export const MILESTONE_STATUSES = ['Pending', 'In Progress', 'Completed', 'Delayed', 'Cancelled'];
export const EXEC_CATEGORIES = ['Venue / Site', 'Run of Show', 'Production', 'Logistics', 'Manpower', 'Equipment', 'Transport', 'Permits', 'Hospitality', 'Other'];
export const EXEC_STATUSES = ['Pending', 'In Progress', 'Ready', 'Issue', 'Done'];
export const SEVERITIES = ['Low', 'Medium', 'High', 'Critical'];
export const ESCALATION_TYPES = ['Risk', 'Client Complaint', 'Delay', 'Pending Approval', 'Overdue Task', 'Other'];
export const PAYMENT_MODES = ['NEFT', 'RTGS', 'IMPS', 'Cheque', 'UPI', 'Cash', 'Other'];
export const INVOICE_TYPES = ['Advance', 'Milestone', 'Final'];
export const CAMPAIGN_STATUSES = ['Planned', 'Active', 'Paused', 'Completed'];
export const DATA_SCOPES = [
  { value: 'own', label: 'Own records only' },
  { value: 'team', label: 'Self & team (reporting hierarchy)' },
  { value: 'all', label: 'All records (company-wide)' },
];
export const toOptions = (arr) => arr.map((v) => ({ value: v, label: v }));

/** Status → colour classes for badges */
export const STATUS_COLORS = {
  green: 'bg-green-50 text-green-700 ring-1 ring-green-200',
  red: 'bg-red-50 text-red-700 ring-1 ring-red-200',
  amber: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200',
  blue: 'bg-blue-50 text-blue-700 ring-1 ring-blue-200',
  slate: 'bg-slate-100 text-slate-700 ring-1 ring-slate-200',
  orange: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
  purple: 'bg-purple-50 text-purple-700 ring-1 ring-purple-200',
};

const MAP = {
  green: ['Active', 'Approved', 'Paid', 'Completed', 'Closed', 'Won', 'Qualified', 'Accepted', 'Selected', 'Delivered', 'Ready', 'Done', 'Resolved', 'Green', 'Reimbursed', 'Existing Client'],
  red: ['Inactive', 'Rejected', 'Lost', 'Disqualified', 'Cancelled', 'Blocked', 'Issue', 'Critical', 'Red', 'Overdue', 'Disputed', 'Blacklisted', 'Delayed', 'Urgent'],
  amber: ['Pending', 'Pending Approval', 'Partially Paid', 'Waiting for Client', 'Waiting for Vendor', 'On Hold', 'Amber', 'High', 'Clarification Requested', 'Under Negotiation', 'Paused', 'Partial', 'Handover Pending', 'Submitted'],
  blue: ['In Progress', 'Sent', 'Raised', 'Issued', 'Planning', 'Event Live', 'Open', 'Received', 'Planned', 'Medium', 'Prospect'],
  purple: ['Revised', 'Draft', 'Enquiry Sent', 'Existing Data'],
};
export const statusColor = (s) => {
  for (const [c, list] of Object.entries(MAP)) if (list.includes(s)) return STATUS_COLORS[c];
  return STATUS_COLORS.slate;
};
