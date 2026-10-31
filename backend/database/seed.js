/**
 * Seeds departments, roles (from the Bigbee organisation structure),
 * default permissions, masters, settings and the super admin.
 * Each block only runs when its table is empty, so it is safe to re-run.
 */
const bcrypt = require('bcryptjs');
const { query, queryOne } = require('../config/db');
const MASTERS = require('../utils/masters.config');
const { MODULE_KEYS, ACTIONS } = require('../utils/modules');

const DEPARTMENTS = [
  { code: 'MGMT', name: 'Management' },
  { code: 'BD', name: 'Business Development' },
  { code: 'MKT', name: 'Marketing' },
  { code: 'CS', name: 'Client Servicing' },
  { code: 'OPS', name: 'Operations & Production' },
  { code: 'CRE', name: 'Creative' },
  { code: 'FIN', name: 'Accounts & Finance' },
  { code: 'HR', name: 'HR & Admin' },
];

// Permission preset helpers
const ALL = 'view,create,edit,delete,export,approve';
const RW = 'view,create,edit,export';
const RWD = 'view,create,edit,delete,export';
const R = 'view';
const RX = 'view,export';

const CRM_EXEC = { dashboard: R, companies: RW, contacts: RW, leads: RW, opportunities: RW, activities: RW, tasks: RW, targets: R, proposals: RW, projects: R };
const CRM_MGR = { ...CRM_EXEC, manager_dashboard: R, leads: RWD + ',approve', opportunities: RWD + ',approve', targets: RW, proposals: RWD + ',approve', reports: RX, approvals: 'view,approve', escalations: RW, campaigns: R };
const MKT_EXEC = { dashboard: R, companies: RW, contacts: RW, leads: RW, activities: RW, tasks: RW, campaigns: RW, opportunities: R };
const MKT_MGR = { ...MKT_EXEC, manager_dashboard: R, campaigns: RWD, leads: RWD, targets: R, reports: RX };
const CS_EXEC = { dashboard: R, companies: R, contacts: RW, leads: R, opportunities: R, activities: RW, tasks: RW, proposals: RW, projects: 'view,edit', execution: R, feedback: RW, escalations: RW };
const CS_MGR = { ...CS_EXEC, manager_dashboard: R, proposals: RWD + ',approve', projects: 'view,create,edit,export', project_financials: R, reports: RX, approvals: 'view,approve', targets: R };
const OPS_EXEC = { dashboard: R, projects: 'view,edit', tasks: RW, execution: RW, vendors: R, quotations: RW, purchase_orders: 'view,create', expenses: 'view,create', feedback: R, escalations: RW };
const OPS_MGR = { ...OPS_EXEC, manager_dashboard: R, execution: RWD, vendors: RW, purchase_orders: RW, vendor_bills: R, project_financials: R, reports: RX, approvals: 'view,approve' };
const CREATIVE = { dashboard: R, projects: R, tasks: RW, proposals: R };
const CREATIVE_HEAD = { ...CREATIVE, manager_dashboard: R, reports: R };
const PROCUREMENT = { dashboard: R, projects: R, vendors: RWD, vendor_bank: R, quotations: RWD, purchase_orders: RW, vendor_bills: R, tasks: RW };
const FIN_EXEC = { dashboard: R, projects: R, project_financials: R, invoices: RW, expenses: RW, vendor_bills: RW, purchase_orders: R, vendors: R, vendor_bank: R, profitability: RX, companies: R, tasks: RW };
const FIN_MGR = { ...FIN_EXEC, manager_dashboard: R, invoices: ALL, expenses: ALL, vendor_bills: ALL, purchase_orders: 'view,approve', profitability: RX, reports: RX, approvals: 'view,approve' };
const HR = { dashboard: R, employees: RW, departments: R, roles: R, tasks: RW };
const HR_HEAD = { ...FIN_MGR, ...HR, employees: RWD, departments: RW, roles: RW, permissions: R, audit_logs: R, manager_dashboard: R };
const LEADERSHIP = Object.fromEntries(MODULE_KEYS.map((k) => [k, ALL]));

const ROLES = [
  { name: 'Super Admin', dept: 'MGMT', level: 0, scope: 'all', perms: LEADERSHIP, system: 1, desc: 'Full system access' },
  { name: 'Managing Director', dept: 'MGMT', level: 1, scope: 'all', perms: LEADERSHIP, desc: 'Chairman / MD / Leadership' },
  { name: 'BD Head', dept: 'BD', level: 2, scope: 'team', perms: CRM_MGR },
  { name: 'BD Manager', dept: 'BD', level: 3, scope: 'team', perms: CRM_MGR },
  { name: 'BD Executive', dept: 'BD', level: 4, scope: 'own', perms: CRM_EXEC },
  { name: 'Marketing Head', dept: 'MKT', level: 2, scope: 'team', perms: MKT_MGR },
  { name: 'Digital Marketing Manager', dept: 'MKT', level: 3, scope: 'team', perms: MKT_MGR },
  { name: 'Offline Marketing Manager', dept: 'MKT', level: 3, scope: 'team', perms: MKT_MGR },
  { name: 'Marketing Executive', dept: 'MKT', level: 4, scope: 'own', perms: MKT_EXEC, desc: 'Performance / Social / SEO / Content / PR / Activation' },
  { name: 'Web Developer', dept: 'MKT', level: 4, scope: 'own', perms: { dashboard: R, tasks: RW, campaigns: R } },
  { name: 'CS Head', dept: 'CS', level: 2, scope: 'team', perms: CS_MGR },
  { name: 'CS Manager', dept: 'CS', level: 3, scope: 'team', perms: CS_MGR },
  { name: 'CS Executive', dept: 'CS', level: 4, scope: 'own', perms: CS_EXEC },
  { name: 'Production & Operations Head', dept: 'OPS', level: 2, scope: 'team', perms: OPS_MGR },
  { name: 'Operations Manager', dept: 'OPS', level: 3, scope: 'team', perms: OPS_MGR },
  { name: 'Production Manager', dept: 'OPS', level: 3, scope: 'team', perms: OPS_MGR },
  { name: 'Operations Executive', dept: 'OPS', level: 4, scope: 'own', perms: OPS_EXEC },
  { name: 'Procurement Manager', dept: 'OPS', level: 3, scope: 'all', perms: PROCUREMENT },
  { name: 'Creative Head', dept: 'CRE', level: 2, scope: 'team', perms: CREATIVE_HEAD },
  { name: '3D Designer', dept: 'CRE', level: 4, scope: 'own', perms: CREATIVE },
  { name: 'Graphic Designer', dept: 'CRE', level: 4, scope: 'own', perms: CREATIVE },
  { name: 'Video Editor', dept: 'CRE', level: 4, scope: 'own', perms: CREATIVE },
  { name: 'Visualiser', dept: 'CRE', level: 4, scope: 'own', perms: CREATIVE },
  { name: 'HR & Finance Head', dept: 'FIN', level: 2, scope: 'all', perms: HR_HEAD },
  { name: 'Accounts & Finance Manager', dept: 'FIN', level: 3, scope: 'all', perms: FIN_MGR },
  { name: 'Accounts Executive', dept: 'FIN', level: 4, scope: 'all', perms: FIN_EXEC },
  { name: 'HR & Admin Manager', dept: 'HR', level: 3, scope: 'all', perms: HR },
  { name: 'HR Executive', dept: 'HR', level: 4, scope: 'own', perms: { dashboard: R, employees: 'view,create,edit', tasks: RW } },
];

const SETTINGS = [
  ['company_name', 'Bigbee Experience Management Pvt. Ltd.', 'Company name', 'General'],
  ['margin_threshold_pct', '20', 'Minimum gross margin % (below needs approval / flag)', 'Approval Rules'],
  ['discount_threshold_pct', '10', 'Discount % above which proposal approval is required', 'Approval Rules'],
  ['po_approval_limit', '100000', 'Purchase order amount above which approval is required (INR)', 'Approval Rules'],
  ['expense_approval_limit', '25000', 'Expense amount above which manager approval is required (INR)', 'Approval Rules'],
  ['pipeline_coverage_multiple', '5', 'Default pipeline coverage target (x of target)', 'Sales'],
  ['inactive_lead_days', '7', 'Days without activity before a lead is flagged inactive', 'Automation'],
  ['stage_ageing_days', '15', 'Days in one funnel stage before flagged as ageing', 'Automation'],
  ['escalate_overdue_days', '2', 'Days overdue before high-priority items escalate to manager', 'Automation'],
  ['ageing_buckets', '0-30,31-60,61-90,90+', 'Collection ageing buckets (days)', 'Finance'],
  ['default_tax_pct', '18', 'Default GST %', 'Finance'],
  ['won_evidence_required', '1', 'Require PO / confirmation evidence before marking Won (1 = yes)', 'Sales'],
];

async function seedMasters() {
  for (const m of Object.values(MASTERS)) {
    const c = await queryOne(`SELECT COUNT(*) AS c FROM ${m.table}`);
    if (c.c > 0 || !m.seed.length) continue;
    let order = 1;
    for (const item of m.seed) {
      const row = typeof item === 'string' ? { name: item } : item;
      row.sort_order = order++;
      const cols = Object.keys(row);
      await query(
        `INSERT INTO ${m.table} (${cols.join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
        cols.map((k) => row[k])
      );
    }
  }
  // Sub sources linked to sources
  const subCount = await queryOne('SELECT COUNT(*) AS c FROM sub_sources');
  if (subCount.c === 0) {
    const subs = {
      Website: ['Contact Form', 'Chatbot', 'Landing Page'],
      LinkedIn: ['InMail', 'Organic Post', 'Sponsored'],
      Meta: ['Facebook Ads', 'Instagram Ads'],
      Referral: ['Client Referral', 'Employee Referral', 'Partner Referral'],
      'Outbound Call': ['Cold Call', 'Database Call'],
    };
    for (const [src, list] of Object.entries(subs)) {
      const s = await queryOne('SELECT id FROM lead_sources WHERE name = ?', [src]);
      if (!s) continue;
      for (const name of list) await query('INSERT INTO sub_sources (name, source_id) VALUES (?, ?)', [name, s.id]);
    }
  }
}

async function seedRolesAndPermissions() {
  const dc = await queryOne('SELECT COUNT(*) AS c FROM departments');
  if (dc.c === 0) {
    for (const d of DEPARTMENTS) await query('INSERT INTO departments (code, name) VALUES (?, ?)', [d.code, d.name]);
  }
  const rc = await queryOne('SELECT COUNT(*) AS c FROM roles');
  if (rc.c > 0) return;
  for (const r of ROLES) {
    const dept = await queryOne('SELECT id FROM departments WHERE code = ?', [r.dept]);
    const res = await query(
      'INSERT INTO roles (name, department_id, level, data_scope, description, is_system) VALUES (?,?,?,?,?,?)',
      [r.name, dept ? dept.id : null, r.level, r.scope, r.desc || null, r.system || 0]
    );
    for (const [module, actions] of Object.entries(r.perms)) {
      const set = new Set(actions.split(','));
      await query(
        `INSERT INTO permissions (role_id, module, ${ACTIONS.map((a) => 'can_' + a).join(',')})
         VALUES (?, ?, ${ACTIONS.map(() => '?').join(',')})`,
        [res.insertId, module, ...ACTIONS.map((a) => (set.has(a) ? 1 : 0))]
      );
    }
  }
}

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL || 'admin@bigbee.com';
  const exists = await queryOne('SELECT id FROM employees WHERE email = ?', [email]);
  if (exists) return;
  const role = await queryOne("SELECT id, department_id FROM roles WHERE name = 'Super Admin'");
  const hash = await bcrypt.hash(process.env.ADMIN_PASSWORD || 'Admin@123', 10);
  await query(
    `INSERT INTO employees (employee_code, full_name, email, password_hash, role_id, department_id, designation, is_super_admin, active_status)
     VALUES ('EMP0001', 'Admin', ?, ?, ?, ?, 'System Administrator', 1, 1)`,
    [email, hash, role ? role.id : null, role ? role.department_id : null]
  );
}

async function seedSettings() {
  for (const [k, v, label, group] of SETTINGS) {
    await query(
      'INSERT IGNORE INTO settings (setting_key, setting_value, label, setting_group) VALUES (?,?,?,?)',
      [k, v, label, group]
    );
  }
}

async function seed() {
  await seedMasters();
  await seedRolesAndPermissions();
  await seedAdmin();
  await seedSettings();
}

module.exports = seed;
