const { query, queryOne } = require('../config/db');
const MASTERS = require('../utils/masters.config');
const { asyncHandler, ApiError, pick, paginate, insertSql, updateSql } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

function cfgFor(type) {
  const cfg = MASTERS[type];
  if (!cfg) throw new ApiError(404, `Unknown master: ${type}`);
  return cfg;
}

function fieldsFor(cfg) {
  return ['name', 'description', 'sort_order', 'status', ...Object.keys(cfg.extra || {})];
}

/** List of available masters with labels (for UI). */
exports.types = asyncHandler(async (req, res) => {
  res.json(Object.entries(MASTERS).map(([key, m]) => ({ key, label: m.label, extra: Object.keys(m.extra || {}) })));
});

/** Every active dropdown in one call, plus employees, departments and roles. */
exports.lookups = asyncHandler(async (req, res) => {
  const out = {};
  for (const [key, m] of Object.entries(MASTERS)) {
    out[key] = await query(`SELECT * FROM ${m.table} WHERE status = 1 ORDER BY sort_order, name`);
  }
  out.employees = await query(
    `SELECT e.id, e.full_name, e.employee_code, e.department_id, e.role_id, e.reports_to, r.name AS role_name, d.name AS department_name
       FROM employees e LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.active_status = 1 ORDER BY e.full_name`
  );
  out.departments = await query('SELECT id, name, code FROM departments WHERE status = 1 ORDER BY name');
  out.roles = await query('SELECT id, name, department_id, data_scope FROM roles WHERE status = 1 ORDER BY level, name');
  res.json(out);
});

exports.list = asyncHandler(async (req, res) => {
  const cfg = cfgFor(req.params.type);
  const { page, limit, offset } = paginate(req.query);
  let where = ' WHERE 1=1';
  const params = [];
  if (req.query.search) {
    where += ' AND (t.name LIKE ? OR t.description LIKE ?)';
    params.push(`%${req.query.search}%`, `%${req.query.search}%`);
  }
  if (req.query.status !== undefined && req.query.status !== '') {
    where += ' AND t.status = ?';
    params.push(req.query.status);
  }
  let select = 't.*';
  let join = '';
  if (cfg.join) {
    select += `, j.name AS ${cfg.join.as}`;
    join = ` LEFT JOIN ${cfg.join.table} j ON j.id = t.${cfg.join.on}`;
    if (req.query[cfg.join.on]) {
      where += ` AND t.${cfg.join.on} = ?`;
      params.push(req.query[cfg.join.on]);
    }
  }
  const total = await queryOne(`SELECT COUNT(*) AS c FROM ${cfg.table} t ${join} ${where}`, params);
  const rows = await query(
    `SELECT ${select} FROM ${cfg.table} t ${join} ${where} ORDER BY t.sort_order, t.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ data: rows, total: total.c, page, limit });
});

exports.create = asyncHandler(async (req, res) => {
  const cfg = cfgFor(req.params.type);
  const data = pick(req.body, fieldsFor(cfg));
  if (!data.name) throw new ApiError(400, 'Name is required');
  const dup = await queryOne(`SELECT id FROM ${cfg.table} WHERE name = ?`, [data.name]);
  if (dup) throw new ApiError(409, `${cfg.label} "${data.name}" already exists`);
  const ins = insertSql(cfg.table, data);
  const r = await query(ins.sql, ins.params);
  await logAudit(req, 'create', `master:${req.params.type}`, r.insertId, data);
  res.status(201).json(await queryOne(`SELECT * FROM ${cfg.table} WHERE id = ?`, [r.insertId]));
});

exports.update = asyncHandler(async (req, res) => {
  const cfg = cfgFor(req.params.type);
  const data = pick(req.body, fieldsFor(cfg));
  if (data.name) {
    const dup = await queryOne(`SELECT id FROM ${cfg.table} WHERE name = ? AND id <> ?`, [data.name, req.params.id]);
    if (dup) throw new ApiError(409, `${cfg.label} "${data.name}" already exists`);
  }
  const up = updateSql(cfg.table, data, req.params.id);
  await query(up.sql, up.params);
  await logAudit(req, 'update', `master:${req.params.type}`, Number(req.params.id), data);
  res.json(await queryOne(`SELECT * FROM ${cfg.table} WHERE id = ?`, [req.params.id]));
});

exports.remove = asyncHandler(async (req, res) => {
  const cfg = cfgFor(req.params.type);
  await query(`DELETE FROM ${cfg.table} WHERE id = ?`, [req.params.id]);
  await logAudit(req, 'delete', `master:${req.params.type}`, Number(req.params.id));
  res.json({ message: 'Deleted' });
});
