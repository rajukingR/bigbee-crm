const bcrypt = require('bcryptjs');
const { query, queryOne, transaction } = require('../config/db');
const { asyncHandler, ApiError, pick, paginate, insertSql, updateSql, codeFor } = require('../utils/helpers');
const { logAudit, diff } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { publicPath, removeFile } = require('../middleware/upload');
const { clearScopeCache, getSubordinateIds } = require('../utils/scope');

const FIELDS = ['employee_code', 'full_name', 'email', 'phone', 'role_id', 'department_id', 'reports_to', 'designation', 'date_of_joining', 'city', 'active_status'];

const SELECT = `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.role_id, e.department_id, e.reports_to,
       e.designation, e.date_of_joining, e.city, e.photo, e.is_super_admin, e.active_status, e.deactivated_at,
       e.last_login, e.created_at, r.name AS role_name, d.name AS department_name, m.full_name AS manager_name
  FROM employees e
  LEFT JOIN roles r ON r.id = e.role_id
  LEFT JOIN departments d ON d.id = e.department_id
  LEFT JOIN employees m ON m.id = e.reports_to`;

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  let where = ' WHERE 1=1';
  const params = [];
  const q = req.query;
  if (q.search) {
    where += ' AND (e.full_name LIKE ? OR e.email LIKE ? OR e.employee_code LIKE ? OR r.name LIKE ?)';
    params.push(...Array(4).fill(`%${q.search}%`));
  }
  ['role_id', 'department_id', 'reports_to', 'active_status'].forEach((f) => {
    if (q[f] !== undefined && q[f] !== '') {
      where += ` AND e.${f} = ?`;
      params.push(q[f]);
    }
  });
  const total = await queryOne(
    `SELECT COUNT(*) AS c FROM employees e LEFT JOIN roles r ON r.id = e.role_id ${where}`,
    params
  );
  const rows = await query(`${SELECT} ${where} ORDER BY e.id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data: rows, total: total.c, page, limit });
});

exports.get = asyncHandler(async (req, res) => {
  const row = await queryOne(`${SELECT} WHERE e.id = ?`, [req.params.id]);
  if (!row) throw new ApiError(404, 'Employee not found');
  const [leads, opps, tasks, projects] = await Promise.all([
    queryOne('SELECT COUNT(*) AS c FROM leads WHERE owner_id = ? AND is_converted = 0', [row.id]),
    queryOne(
      `SELECT COUNT(*) AS c FROM opportunities o LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id
        WHERE o.owner_id = ? AND (f.stage_type IS NULL OR f.stage_type IN ('open','hold'))`,
      [row.id]
    ),
    queryOne("SELECT COUNT(*) AS c FROM tasks WHERE owner_id = ? AND status NOT IN ('Completed','Cancelled')", [row.id]),
    queryOne(
      "SELECT COUNT(*) AS c FROM projects WHERE (bd_owner_id = ? OR cs_owner_id = ? OR ops_owner_id = ? OR manager_id = ?) AND status NOT IN ('Closed','Cancelled')",
      [row.id, row.id, row.id, row.id]
    ),
  ]);
  row.open_work = { leads: leads.c, opportunities: opps.c, tasks: tasks.c, projects: projects.c };
  row.team = await query('SELECT id, full_name, designation FROM employees WHERE reports_to = ?', [row.id]);
  res.json(row);
});

async function validate(data, id = null) {
  if (data.email) {
    const dup = await queryOne('SELECT id FROM employees WHERE email = ? AND id <> ?', [data.email, id || 0]);
    if (dup) throw new ApiError(409, 'Email already in use');
  }
  if (data.employee_code) {
    const dup = await queryOne('SELECT id FROM employees WHERE employee_code = ? AND id <> ?', [data.employee_code, id || 0]);
    if (dup) throw new ApiError(409, 'Employee ID already in use');
  }
  if (id && data.reports_to) {
    if (Number(data.reports_to) === Number(id)) throw new ApiError(400, 'An employee cannot report to themselves');
    const subs = await getSubordinateIds(Number(id));
    if (subs.includes(Number(data.reports_to))) throw new ApiError(400, 'Reporting loop: selected manager reports to this employee');
  }
  if (data.role_id && !data.department_id) {
    const role = await queryOne('SELECT department_id FROM roles WHERE id = ?', [data.role_id]);
    if (role && role.department_id) data.department_id = role.department_id;
  }
}

exports.create = asyncHandler(async (req, res) => {
  const data = pick(req.body, FIELDS);
  if (!data.full_name || !data.email) throw new ApiError(400, 'Full name and email are required');
  if (!req.body.password || req.body.password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
  await validate(data);
  data.password_hash = await bcrypt.hash(req.body.password, 10);
  if (data.active_status === null || data.active_status === undefined) data.active_status = 1;
  data.employee_code = data.employee_code || `TMP${Date.now()}`;
  if (req.file) data.photo = publicPath(req.file);
  const ins = insertSql('employees', data);
  const r = await query(ins.sql, ins.params);
  if (data.employee_code.startsWith('TMP')) {
    await query('UPDATE employees SET employee_code = ? WHERE id = ?', [codeFor('EMP', r.insertId, 4), r.insertId]);
  }
  clearScopeCache();
  delete data.password_hash;
  await logAudit(req, 'create', 'employees', r.insertId, data);
  if (data.reports_to) await notify(data.reports_to, 'New team member', `${data.full_name} now reports to you`, '/manager-dashboard', 'team');
  await notify(r.insertId, `Welcome to Bigbee CRM, ${data.full_name.split(' ')[0]}!`, 'Your dashboard shows the work assigned to you.', '/dashboard', 'info');
  res.status(201).json(await queryOne(`${SELECT} WHERE e.id = ?`, [r.insertId]));
});

exports.update = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const existing = await queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  if (!existing) throw new ApiError(404, 'Employee not found');
  const data = pick(req.body, FIELDS);
  await validate(data, id);
  if (req.body.password) {
    if (req.body.password.length < 6) throw new ApiError(400, 'Password must be at least 6 characters');
    data.password_hash = await bcrypt.hash(req.body.password, 10);
  }
  if (req.file) {
    if (existing.photo) removeFile(existing.photo);
    data.photo = publicPath(req.file);
  }
  if (existing.is_super_admin && data.active_status !== undefined && Number(data.active_status) === 0) {
    throw new ApiError(400, 'Super admin cannot be deactivated');
  }
  if (data.active_status !== undefined && data.active_status !== null) {
    data.deactivated_at = Number(data.active_status) === 0 ? existing.deactivated_at || new Date() : null;
  }
  if (Object.keys(data).length) {
    const up = updateSql('employees', data, id);
    await query(up.sql, up.params);
  }
  clearScopeCache();
  const changes = diff(existing, data);
  delete changes.password_hash;
  await logAudit(req, 'update', 'employees', id, changes);
  res.json(await queryOne(`${SELECT} WHERE e.id = ?`, [id]));
});

exports.remove = asyncHandler(async (req, res) => {
  const id = Number(req.params.id);
  const emp = await queryOne('SELECT * FROM employees WHERE id = ?', [id]);
  if (!emp) throw new ApiError(404, 'Employee not found');
  if (emp.is_super_admin) throw new ApiError(400, 'Super admin cannot be deleted');
  const used = await queryOne(
    `SELECT (SELECT COUNT(*) FROM leads WHERE owner_id = ?) + (SELECT COUNT(*) FROM opportunities WHERE owner_id = ?)
          + (SELECT COUNT(*) FROM tasks WHERE owner_id = ?) + (SELECT COUNT(*) FROM activities WHERE owner_id = ?) AS c`,
    [id, id, id, id]
  );
  if (used.c > 0) throw new ApiError(409, 'Employee has history records. Deactivate instead of deleting to preserve history.');
  await query('UPDATE employees SET reports_to = NULL WHERE reports_to = ?', [id]);
  await query('DELETE FROM employees WHERE id = ?', [id]);
  if (emp.photo) removeFile(emp.photo);
  clearScopeCache();
  await logAudit(req, 'delete', 'employees', id, { full_name: emp.full_name, email: emp.email });
  res.json({ message: 'Employee deleted' });
});

/** Move all open work of one employee to another (used after deactivation). */
exports.reassign = asyncHandler(async (req, res) => {
  const fromId = Number(req.params.id);
  const toId = Number(req.body.to_employee_id);
  if (!toId || toId === fromId) throw new ApiError(400, 'Select a different employee to reassign to');
  const reason = req.body.reason || 'Bulk reassignment';
  const result = await transaction(async (conn) => {
    const [leads] = await conn.query('SELECT id FROM leads WHERE owner_id = ? AND is_converted = 0', [fromId]);
    for (const l of leads) {
      await conn.query(
        'INSERT INTO lead_assignments (lead_id, from_owner_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?,?)',
        [l.id, fromId, toId, reason, req.user.id]
      );
    }
    await conn.query('UPDATE leads SET owner_id = ? WHERE owner_id = ? AND is_converted = 0', [toId, fromId]);
    const [o] = await conn.query(
      `UPDATE opportunities o LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id SET o.owner_id = ?
        WHERE o.owner_id = ? AND (f.stage_type IS NULL OR f.stage_type IN ('open','hold'))`,
      [toId, fromId]
    );
    const [t] = await conn.query(
      "UPDATE tasks SET owner_id = ? WHERE owner_id = ? AND status NOT IN ('Completed','Cancelled')",
      [toId, fromId]
    );
    const [c] = await conn.query('UPDATE companies SET owner_id = ? WHERE owner_id = ?', [toId, fromId]);
    const [rep] = await conn.query('UPDATE employees SET reports_to = ? WHERE reports_to = ?', [toId, fromId]);
    return { leads: leads.length, opportunities: o.affectedRows, tasks: t.affectedRows, companies: c.affectedRows, direct_reports: rep.affectedRows };
  });
  clearScopeCache();
  await logAudit(req, 'reassign', 'employees', fromId, { to: toId, ...result });
  res.json({ message: 'Open work reassigned', ...result });
});

/** Upward-reporting tree for the organisation chart. */
exports.orgChart = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT e.id, e.full_name, e.designation, e.reports_to, e.photo, r.name AS role_name, d.name AS department_name
       FROM employees e LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.active_status = 1 ORDER BY r.level, e.full_name`
  );
  const map = {};
  rows.forEach((r) => (map[r.id] = { ...r, children: [] }));
  const roots = [];
  rows.forEach((r) => {
    if (r.reports_to && map[r.reports_to]) map[r.reports_to].children.push(map[r.id]);
    else roots.push(map[r.id]);
  });
  res.json(roots);
});
