const { query, queryOne } = require('../config/db');
const { asyncHandler, ApiError, paginate } = require('../utils/helpers');
const { applyDecision } = require('../utils/approvals');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');

exports.list = asyncHandler(async (req, res) => {
  const { page, limit, offset } = paginate(req.query);
  let where = ' WHERE 1=1';
  const params = [];
  const u = req.user;
  // Approvers see their queue; leadership sees all; everyone sees their own requests
  if (req.query.view === 'mine') { where += ' AND a.requested_by = ?'; params.push(u.id); }
  else if (!(u.is_super_admin || u.data_scope === 'all')) { where += ' AND (a.approver_id = ? OR a.requested_by = ?)'; params.push(u.id, u.id); }
  if (req.query.status) { where += ' AND a.status = ?'; params.push(req.query.status); }
  if (req.query.entity_type) { where += ' AND a.entity_type = ?'; params.push(req.query.entity_type); }
  if (req.query.search) { where += ' AND (a.title LIKE ? OR a.request_type LIKE ?)'; params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const total = await queryOne(`SELECT COUNT(*) AS c FROM approvals a ${where}`, params);
  const rows = await query(
    `SELECT a.*, r.full_name AS requested_by_name, ap.full_name AS approver_name, d.full_name AS decided_by_name
       FROM approvals a LEFT JOIN employees r ON r.id = a.requested_by LEFT JOIN employees ap ON ap.id = a.approver_id
       LEFT JOIN employees d ON d.id = a.decided_by ${where}
      ORDER BY a.status = 'Pending' DESC, a.id DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  res.json({ data: rows, total: total.c, page, limit });
});

exports.counts = asyncHandler(async (req, res) => {
  const u = req.user;
  const row = u.is_super_admin || u.data_scope === 'all'
    ? await queryOne("SELECT COUNT(*) AS c FROM approvals WHERE status = 'Pending'")
    : await queryOne("SELECT COUNT(*) AS c FROM approvals WHERE status = 'Pending' AND approver_id = ?", [u.id]);
  res.json({ pending: row.c });
});

exports.decide = asyncHandler(async (req, res) => {
  const a = await queryOne('SELECT * FROM approvals WHERE id = ?', [req.params.id]);
  if (!a) throw new ApiError(404, 'Approval not found');
  if (a.status !== 'Pending') throw new ApiError(409, `Already ${a.status}`);
  const u = req.user;
  if (a.approver_id && a.approver_id !== u.id && !(u.is_super_admin || u.data_scope === 'all')) {
    throw new ApiError(403, 'This request is assigned to another approver');
  }
  if (a.requested_by === u.id && !u.is_super_admin) throw new ApiError(403, 'You cannot approve your own request');
  const approved = req.body.decision === 'Approved';
  if (!approved && !req.body.remarks) throw new ApiError(400, 'Remarks are required when rejecting');
  await query('UPDATE approvals SET status = ?, remarks = ?, decided_by = ?, decided_at = NOW() WHERE id = ?', [approved ? 'Approved' : 'Rejected', req.body.remarks || null, u.id, a.id]);
  await applyDecision(a, approved, u.id);
  await logAudit(req, approved ? 'approve' : 'reject', a.entity_type, a.entity_id, { approval_id: a.id, remarks: req.body.remarks });
  await notify(a.requested_by, `${a.request_type} ${approved ? 'approved' : 'rejected'}`, `${a.title}${req.body.remarks ? ' – ' + req.body.remarks : ''}`, null, 'approval');
  res.json({ message: approved ? 'Approved' : 'Rejected' });
});
