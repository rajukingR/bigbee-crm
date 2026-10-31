/**
 * Approval chain: request goes to the requester's reporting manager;
 * if none, to the MD / super admin. Decisions update the source record.
 */
const { query, queryOne } = require('../config/db');
const { notify } = require('./notify');

async function findApprover(userId) {
  const me = await queryOne('SELECT reports_to FROM employees WHERE id = ?', [userId]);
  if (me && me.reports_to) return me.reports_to;
  const md = await queryOne(
    `SELECT e.id FROM employees e LEFT JOIN roles r ON r.id = e.role_id
      WHERE e.active_status = 1 AND e.id <> ? AND (r.name = 'Managing Director' OR e.is_super_admin = 1)
      ORDER BY e.is_super_admin ASC, e.id LIMIT 1`,
    [userId]
  );
  return md ? md.id : null;
}

async function createApproval({ entityType, entityId, requestType, title, amount = null, reason = null, req, link = null }) {
  // Do not duplicate an open request for the same record & type
  await query(
    "UPDATE approvals SET status = 'Rejected', remarks = 'Superseded by new request', decided_at = NOW() WHERE entity_type = ? AND entity_id = ? AND request_type = ? AND status = 'Pending'",
    [entityType, entityId, requestType]
  );
  const approver = await findApprover(req.user.id);
  const r = await query(
    `INSERT INTO approvals (entity_type, entity_id, request_type, title, amount, reason, requested_by, approver_id)
     VALUES (?,?,?,?,?,?,?,?)`,
    [entityType, entityId, requestType, title, amount, reason, req.user.id, approver]
  );
  if (approver) await notify(approver, `Approval required: ${requestType}`, `${title}${reason ? ' – ' + reason : ''}`, link || '/admin/approvals', 'approval');
  return r.insertId;
}

/** Apply an approval decision to the underlying record. */
const HANDLERS = {
  proposal: async (id, approved, userId) => {
    await query(
      `UPDATE proposals SET status = ?, approved_by = ?, approved_at = ${approved ? 'NOW()' : 'NULL'} WHERE id = ?`,
      [approved ? 'Approved' : 'Rejected', userId, id]
    );
  },
  purchase_order: async (id, approved, userId) => {
    await query(
      `UPDATE purchase_orders SET status = ?, approved_by = ?, approved_at = ${approved ? 'NOW()' : 'NULL'} WHERE id = ?`,
      [approved ? 'Approved' : 'Rejected', userId, id]
    );
  },
  expense: async (id, approved, userId) => {
    await query('UPDATE expenses SET status = ?, approved_by = ? WHERE id = ?', [approved ? 'Approved' : 'Rejected', userId, id]);
  },
  change_request: async (id, approved, userId) => {
    const cr = await queryOne('SELECT * FROM change_requests WHERE id = ?', [id]);
    await query('UPDATE change_requests SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?', [approved ? 'Approved' : 'Rejected', userId, id]);
    if (approved && cr) {
      await query(
        'UPDATE projects SET change_order_value = change_order_value + ?, approved_budget = approved_budget + ? WHERE id = ?',
        [cr.revenue_impact || 0, cr.cost_impact || 0, cr.project_id]
      );
    }
  },
};

async function applyDecision(approval, approved, userId) {
  const h = HANDLERS[approval.entity_type];
  if (h) await h(approval.entity_id, approved, userId);
}

module.exports = { createApproval, applyDecision, findApprover };
