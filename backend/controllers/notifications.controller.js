const { query, queryOne } = require('../config/db');
const { asyncHandler } = require('../utils/helpers');

exports.list = asyncHandler(async (req, res) => {
  const limit = Math.min(200, parseInt(req.query.limit, 10) || 30);
  // Admin can review every user's notifications (?all=1, optional ?user_id=)
  if (req.query.all === '1' && req.user.is_super_admin) {
    const params = [];
    let where = '';
    if (req.query.user_id) { where = 'WHERE n.user_id = ?'; params.push(req.query.user_id); }
    const rows = await query(
      `SELECT n.*, e.full_name AS user_name, r.name AS role_name FROM notifications n
         LEFT JOIN employees e ON e.id = n.user_id LEFT JOIN roles r ON r.id = e.role_id
        ${where} ORDER BY n.id DESC LIMIT ?`,
      [...params, limit]
    );
    return res.json({ data: rows, unread: rows.filter((x) => !x.is_read).length });
  }
  const rows = await query('SELECT * FROM notifications WHERE user_id = ? ORDER BY id DESC LIMIT ?', [req.user.id, limit]);
  const unread = await queryOne('SELECT COUNT(*) AS c FROM notifications WHERE user_id = ? AND is_read = 0', [req.user.id]);
  res.json({ data: rows, unread: unread.c });
});

exports.markRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  res.json({ ok: true });
});

exports.markAllRead = asyncHandler(async (req, res) => {
  await query('UPDATE notifications SET is_read = 1 WHERE user_id = ?', [req.user.id]);
  res.json({ ok: true });
});
