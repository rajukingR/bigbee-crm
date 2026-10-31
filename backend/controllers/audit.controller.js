const { query, queryOne } = require('../config/db');
const { asyncHandler, paginate } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  let where = ' WHERE 1=1';
  const params = [];
  const q = req.query;
  ['module', 'action', 'user_id', 'entity_id'].forEach((f) => {
    if (q[f]) { where += ` AND ${f} = ?`; params.push(q[f]); }
  });
  if (q.search) { where += ' AND (user_name LIKE ? OR module LIKE ? OR action LIKE ?)'; params.push(...Array(3).fill(`%${q.search}%`)); }
  if (q.from) { where += ' AND created_at >= ?'; params.push(q.from); }
  if (q.to) { where += ' AND created_at <= ?'; params.push(`${q.to} 23:59:59`); }
  const total = await queryOne(`SELECT COUNT(*) AS c FROM audit_logs ${where}`, params);
  const rows = await query(`SELECT * FROM audit_logs ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, limit, offset]);
  res.json({ data: rows, total: total.c, page, limit });
});

exports.modules = asyncHandler(async (req, res) => {
  res.json((await query('SELECT DISTINCT module FROM audit_logs ORDER BY module')).map((r) => r.module));
});
