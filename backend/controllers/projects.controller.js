const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, pick, updateSql } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { hasPermission } = require('../middleware/auth');
const { projectFinancials } = require('../utils/finance');
const { getNumber } = require('../utils/settings');
const { templateFor } = require('../utils/projectTemplates');
const { DEFAULT_CHECKLIST } = require('../utils/projectService');

const MONEY_FIELDS = ['proposal_value', 'estimated_cost', 'approved_budget', 'agency_fee', 'payment_terms'];

/** Hide sensitive financial fields from roles without project_financials access. */
function maskFinancials(row, req) {
  if (hasPermission(req.user, 'project_financials', 'view')) return row;
  const out = { ...row };
  MONEY_FIELDS.forEach((f) => delete out[f]);
  return out;
}

const ctrl = crudController({
  table: 'projects',
  module: 'projects',
  select: `t.*, co.name AS company_name, ct.name AS contact_name, sv.name AS service_name, et.name AS event_type_name,
    bd.full_name AS bd_owner_name, cs.full_name AS cs_owner_name, op.full_name AS ops_owner_name,
    fo.full_name AS finance_owner_name, mg.full_name AS manager_name, o.opp_code,
    (SELECT status FROM project_handovers h WHERE h.project_id = t.id) AS handover_status,
    (SELECT COUNT(*) FROM tasks k WHERE k.project_id = t.id) AS task_total,
    (SELECT COUNT(*) FROM tasks k WHERE k.project_id = t.id AND k.status = 'Completed') AS task_done,
    (SELECT COUNT(*) FROM tasks k WHERE k.project_id = t.id AND k.status NOT IN ('Completed','Cancelled') AND k.due_date < NOW()) AS task_overdue,
    (SELECT COUNT(*) FROM milestones m WHERE m.project_id = t.id AND m.status NOT IN ('Completed','Cancelled') AND m.planned_date < CURDATE()) AS milestone_overdue,
    (SELECT COUNT(*) FROM escalations e WHERE e.project_id = t.id AND e.status IN ('Open','In Progress')) AS open_escalations`,
  joins: `LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN contacts ct ON ct.id = t.contact_id
    LEFT JOIN services sv ON sv.id = t.service_id LEFT JOIN lead_event_types et ON et.id = t.event_type_id
    LEFT JOIN employees bd ON bd.id = t.bd_owner_id LEFT JOIN employees cs ON cs.id = t.cs_owner_id
    LEFT JOIN employees op ON op.id = t.ops_owner_id LEFT JOIN employees fo ON fo.id = t.finance_owner_id
    LEFT JOIN employees mg ON mg.id = t.manager_id LEFT JOIN opportunities o ON o.id = t.opportunity_id`,
  fields: [
    'name', 'company_id', 'contact_id', 'service_id', 'event_type_id', 'location', 'city', 'event_start', 'event_end',
    'proposal_value', 'confirmed_value', 'estimated_cost', 'approved_budget', 'agency_fee', 'tax_pct', 'payment_terms', 'scope',
    'bd_owner_id', 'cs_owner_id', 'ops_owner_id', 'finance_owner_id', 'manager_id', 'status', 'health', 'progress',
    'event_day_status', 'closure_notes',
  ],
  trackCreator: true,
  required: ['name'],
  searchFields: ['t.project_code', 't.name', 'co.name', 't.city'],
  filters: {
    status: 't.status', health: 't.health', company_id: 't.company_id', service_id: 't.service_id',
    event_type_id: 't.event_type_id', manager_id: 't.manager_id', cs_owner_id: 't.cs_owner_id', ops_owner_id: 't.ops_owner_id',
  },
  dateField: 't.event_start',
  ownerColumns: ['t.bd_owner_id', 't.cs_owner_id', 't.ops_owner_id', 't.manager_id', 't.finance_owner_id', 't.created_by'],
  codeField: 'project_code',
  codePrefix: 'PRJ',
  sortable: ['t.event_start', 't.confirmed_value', 't.created_at'],
  transformRow: (row, req) => maskFinancials(row, req),
  beforeSave: async (data, req, existing) => {
    if (existing && data.status === 'Closed' && existing.status !== 'Closed') data.closed_at = new Date();
    if (!hasPermission(req.user, 'project_financials', 'edit')) MONEY_FIELDS.forEach((f) => delete data[f]);
    return data;
  },
  afterCreate: async (row, req) => {
    await query('INSERT INTO project_handovers (project_id, checklist, handed_over_by, received_by) VALUES (?,?,?,?)', [
      row.id, JSON.stringify(DEFAULT_CHECKLIST), row.bd_owner_id || req.user.id, row.cs_owner_id,
    ]);
  },
  beforeDelete: async (row) => {
    const inv = await queryOne('SELECT COUNT(*) AS c FROM invoices WHERE project_id = ?', [row.id]);
    const po = await queryOne('SELECT COUNT(*) AS c FROM purchase_orders WHERE project_id = ?', [row.id]);
    if (inv.c || po.c) throw new ApiError(409, 'Project has invoices / purchase orders. Cancel it instead of deleting.');
    for (const tbl of ['project_handovers', 'milestones', 'tasks', 'communication_logs', 'change_requests', 'execution_items', 'incidents', 'feedback']) {
      await query(`DELETE FROM ${tbl} WHERE project_id = ?`, [row.id]);
    }
    await query('UPDATE opportunities SET project_id = NULL WHERE project_id = ?', [row.id]);
  },
});

async function canSeeProject(req, id) {
  const p = await ctrl.findById(id, req);
  if (!p) throw new ApiError(404, 'Project not found');
  return p;
}

ctrl.overview = asyncHandler(async (req, res) => {
  const project = await canSeeProject(req, req.params.id);
  const id = project.id;
  const [handover, milestones, tasks, comms, changes, escalations, execution, incidents, feedback] = await Promise.all([
    queryOne(
      `SELECT h.*, a.full_name AS handed_over_by_name, b.full_name AS received_by_name FROM project_handovers h
         LEFT JOIN employees a ON a.id = h.handed_over_by LEFT JOIN employees b ON b.id = h.received_by WHERE h.project_id = ?`,
      [id]
    ),
    query('SELECT m.*, e.full_name AS owner_name FROM milestones m LEFT JOIN employees e ON e.id = m.owner_id WHERE m.project_id = ? ORDER BY m.planned_date', [id]),
    query(
      `SELECT t.*, e.full_name AS owner_name, d.name AS department_name FROM tasks t LEFT JOIN employees e ON e.id = t.owner_id
         LEFT JOIN departments d ON d.id = t.department_id WHERE t.project_id = ? ORDER BY t.due_date IS NULL, t.due_date`,
      [id]
    ),
    query('SELECT c.*, e.full_name AS logged_by_name FROM communication_logs c LEFT JOIN employees e ON e.id = c.logged_by WHERE c.project_id = ? ORDER BY c.log_date DESC', [id]),
    query('SELECT c.*, e.full_name AS requested_by_name FROM change_requests c LEFT JOIN employees e ON e.id = c.requested_by WHERE c.project_id = ? ORDER BY c.id DESC', [id]),
    query('SELECT x.*, a.full_name AS raised_by_name, b.full_name AS escalated_to_name FROM escalations x LEFT JOIN employees a ON a.id = x.raised_by LEFT JOIN employees b ON b.id = x.escalated_to WHERE x.project_id = ? ORDER BY x.id DESC', [id]),
    query("SELECT status, COUNT(*) AS n FROM execution_items WHERE project_id = ? GROUP BY status", [id]),
    query('SELECT COUNT(*) AS n FROM incidents WHERE project_id = ?', [id]),
    query('SELECT * FROM feedback WHERE project_id = ? ORDER BY id DESC', [id]),
  ]);
  if (handover && typeof handover.checklist === 'string') {
    try { handover.checklist = JSON.parse(handover.checklist); } catch (e) { handover.checklist = []; }
  }
  let financials = null;
  if (hasPermission(req.user, 'project_financials', 'view')) {
    const margin = await getNumber('margin_threshold_pct', 20);
    financials = (await projectFinancials('AND p.id = ?', [id], margin))[0] || null;
  }
  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'Completed').length;
  res.json({
    project,
    handover,
    milestones,
    tasks,
    communication_logs: comms,
    change_requests: changes,
    escalations,
    execution_summary: execution,
    incident_count: incidents[0] ? incidents[0].n : 0,
    feedback,
    financials,
    progress: total ? Math.round((done / total) * 100) : project.progress || 0,
  });
});

ctrl.financials = asyncHandler(async (req, res) => {
  const margin = await getNumber('margin_threshold_pct', 20);
  const row = (await projectFinancials('AND p.id = ?', [req.params.id], margin))[0];
  if (!row) throw new ApiError(404, 'Project not found');
  res.json(row);
});

// ---------- Handover ----------
const HANDOVER_FIELDS = ['brief', 'proposal_reference', 'costing_assumptions', 'exclusions', 'promises_made', 'client_stakeholders', 'budget_notes', 'timeline_notes', 'risks', 'checklist', 'received_by'];

ctrl.saveHandover = asyncHandler(async (req, res) => {
  const id = req.params.id;
  let h = await queryOne('SELECT * FROM project_handovers WHERE project_id = ?', [id]);
  if (!h) {
    await query('INSERT INTO project_handovers (project_id, checklist, handed_over_by) VALUES (?,?,?)', [id, JSON.stringify(DEFAULT_CHECKLIST), req.user.id]);
    h = await queryOne('SELECT * FROM project_handovers WHERE project_id = ?', [id]);
  }
  if (h.status === 'Accepted') throw new ApiError(409, 'Handover already accepted');
  const data = pick(req.body, HANDOVER_FIELDS);
  if (Object.keys(data).length) {
    const up = updateSql('project_handovers', data, h.id);
    await query(up.sql, up.params);
  }
  await logAudit(req, 'update_handover', 'projects', Number(id), data);
  res.json({ message: 'Handover saved' });
});

ctrl.submitHandover = asyncHandler(async (req, res) => {
  const h = await queryOne('SELECT * FROM project_handovers WHERE project_id = ?', [req.params.id]);
  if (!h) throw new ApiError(404, 'Handover not found');
  const missing = [];
  ['brief', 'client_stakeholders', 'timeline_notes'].forEach((f) => { if (!h[f]) missing.push(f.replace(/_/g, ' ')); });
  if (!h.received_by) missing.push('receiving owner');
  if (missing.length) throw new ApiError(400, `Complete the handover before submitting: ${missing.join(', ')}`);
  await query("UPDATE project_handovers SET status = 'Submitted', submitted_at = NOW(), handed_over_by = COALESCE(handed_over_by, ?) WHERE id = ?", [req.user.id, h.id]);
  await notify(h.received_by, 'Handover awaiting your acceptance', 'A project handover has been submitted to you', `/projects/${req.params.id}`, 'project');
  await logAudit(req, 'submit_handover', 'projects', Number(req.params.id));
  res.json({ message: 'Handover submitted for acceptance' });
});

ctrl.acceptHandover = asyncHandler(async (req, res) => {
  const h = await queryOne('SELECT * FROM project_handovers WHERE project_id = ?', [req.params.id]);
  if (!h) throw new ApiError(404, 'Handover not found');
  if (h.status !== 'Submitted' && h.status !== 'Clarification Requested') throw new ApiError(409, 'Handover must be submitted first');
  if (h.received_by && h.received_by !== req.user.id && !hasPermission(req.user, 'projects', 'approve')) {
    throw new ApiError(403, 'Only the receiving owner can accept this handover');
  }
  await query("UPDATE project_handovers SET status = 'Accepted', accepted_at = NOW(), received_by = COALESCE(received_by, ?) WHERE id = ?", [req.user.id, h.id]);
  await query("UPDATE projects SET status = IF(status = 'Handover Pending', 'Planning', status), cs_owner_id = COALESCE(cs_owner_id, ?) WHERE id = ?", [h.received_by || req.user.id, req.params.id]);
  await notify(h.handed_over_by, 'Handover accepted', 'Your project handover was accepted', `/projects/${req.params.id}`, 'project');
  await logAudit(req, 'accept_handover', 'projects', Number(req.params.id));
  res.json({ message: 'Handover accepted' });
});

ctrl.clarifyHandover = asyncHandler(async (req, res) => {
  if (!req.body.clarification) throw new ApiError(400, 'Describe what information is missing');
  const h = await queryOne('SELECT * FROM project_handovers WHERE project_id = ?', [req.params.id]);
  if (!h) throw new ApiError(404, 'Handover not found');
  await query("UPDATE project_handovers SET status = 'Clarification Requested', clarification = ? WHERE id = ?", [req.body.clarification, h.id]);
  await notify(h.handed_over_by, 'Handover clarification requested', req.body.clarification, `/projects/${req.params.id}`, 'project');
  await logAudit(req, 'clarify_handover', 'projects', Number(req.params.id), { clarification: req.body.clarification });
  res.json({ message: 'Clarification requested' });
});

/** Create tasks & milestones from the event-type template. */
ctrl.applyTemplate = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT p.*, et.name AS event_type_name FROM projects p LEFT JOIN lead_event_types et ON et.id = p.event_type_id WHERE p.id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Project not found');
  const tpl = templateFor(req.body.template || p.event_type_name);
  const start = p.event_start ? new Date(p.event_start) : new Date(Date.now() + 30 * 86400000);
  const day = (offset) => new Date(start.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const depts = await query('SELECT id, code FROM departments');
  const deptId = (code) => (depts.find((d) => d.code === code) || {}).id || null;
  const ownerFor = (code) => ({ CS: p.cs_owner_id, OPS: p.ops_owner_id, FIN: p.finance_owner_id }[code] || p.manager_id || null);
  for (const m of tpl.milestones) {
    await query('INSERT INTO milestones (project_id, title, milestone_type, planned_date, owner_id) VALUES (?,?,?,?,?)', [p.id, m.title, m.type, day(m.offset), p.manager_id]);
  }
  for (const t of tpl.tasks) {
    await query(
      `INSERT INTO tasks (title, related_type, related_id, project_id, owner_id, department_id, priority, due_date, created_by)
       VALUES (?, 'project', ?, ?, ?, ?, ?, ?, ?)`,
      [t.title, p.id, p.id, ownerFor(t.dept), deptId(t.dept), t.priority || 'Medium', `${day(t.offset)} 18:00:00`, req.user.id]
    );
  }
  await logAudit(req, 'apply_template', 'projects', p.id, { template: req.body.template || p.event_type_name });
  res.json({ message: `Added ${tpl.tasks.length} tasks and ${tpl.milestones.length} milestones` });
});

ctrl.close = asyncHandler(async (req, res) => {
  const margin = await getNumber('margin_threshold_pct', 20);
  const fin = (await projectFinancials('AND p.id = ?', [req.params.id], margin))[0];
  if (!fin) throw new ApiError(404, 'Project not found');
  const open = await queryOne("SELECT COUNT(*) AS c FROM tasks WHERE project_id = ? AND status NOT IN ('Completed','Cancelled')", [req.params.id]);
  if (open.c > 0 && !req.body.force) throw new ApiError(409, `${open.c} task(s) are still open. Complete or cancel them, or close with force.`);
  await query("UPDATE projects SET status = 'Closed', closed_at = NOW(), closure_notes = ?, completion_signoff_by = ?, progress = 100 WHERE id = ?", [req.body.closure_notes || null, req.user.id, req.params.id]);
  await logAudit(req, 'close', 'projects', Number(req.params.id), { receivable_outstanding: fin.receivable_outstanding, vendor_outstanding: fin.vendor_outstanding });
  res.json({ message: 'Project closed', warnings: fin.flags });
});

module.exports = ctrl;
