const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, num, round2 } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { getNumber } = require('../utils/settings');
const { createApproval } = require('../utils/approvals');

const ctrl = crudController({
  table: 'purchase_orders',
  module: 'purchase_orders',
  select: `t.*, v.name AS vendor_name, p.project_code, p.name AS project_name, a.full_name AS approved_by_name, cb.full_name AS created_by_name,
    (SELECT COALESCE(SUM(b.total_amount),0) FROM vendor_bills b WHERE b.po_id = t.id) AS billed_amount,
    (SELECT COALESCE(SUM(b.paid_amount),0) FROM vendor_bills b WHERE b.po_id = t.id) AS paid_amount`,
  joins: `LEFT JOIN vendors v ON v.id = t.vendor_id LEFT JOIN projects p ON p.id = t.project_id
          LEFT JOIN employees a ON a.id = t.approved_by LEFT JOIN employees cb ON cb.id = t.created_by`,
  fields: ['po_type', 'project_id', 'vendor_id', 'quotation_id', 'scope', 'amount', 'tax_pct', 'po_date', 'delivery_date', 'payment_terms', 'delivery_status'],
  trackCreator: true,
  required: ['vendor_id', 'amount'],
  searchFields: ['t.po_code', 'v.name', 'p.name', 'p.project_code', 't.scope'],
  filters: { project_id: 't.project_id', vendor_id: 't.vendor_id', status: 't.status', delivery_status: 't.delivery_status', po_type: 't.po_type' },
  dateField: 't.po_date',
  codeField: 'po_code',
  codePrefix: 'PO',
  beforeSave: async (data, req, existing) => {
    if (existing && !['Draft', 'Rejected'].includes(existing.status) && (data.amount !== undefined || data.vendor_id !== undefined)) {
      throw new ApiError(409, `PO is ${existing.status}; amount / vendor cannot be changed`);
    }
    if (data.quotation_id && !existing) {
      const q = await queryOne('SELECT * FROM vendor_quotations WHERE id = ?', [data.quotation_id]);
      if (q) {
        data.vendor_id = data.vendor_id || q.vendor_id;
        data.project_id = data.project_id || q.project_id;
        if (!data.amount) data.amount = num(q.negotiated_amount) || num(q.quoted_amount);
        data.scope = data.scope || q.requirement;
      }
    }
    const amount = data.amount !== undefined ? num(data.amount) : num(existing && existing.amount);
    const tax = data.tax_pct !== undefined && data.tax_pct !== null ? num(data.tax_pct) : num(existing ? existing.tax_pct : 18);
    data.tax_amount = round2((amount * tax) / 100);
    data.total_amount = round2(amount + data.tax_amount);
    if (!existing) data.po_date = data.po_date || new Date().toISOString().slice(0, 10);
    return data;
  },
  beforeDelete: async (row) => {
    if (!['Draft', 'Rejected', 'Cancelled'].includes(row.status)) throw new ApiError(409, 'Only Draft / Rejected / Cancelled POs can be deleted');
    const b = await queryOne('SELECT COUNT(*) AS c FROM vendor_bills WHERE po_id = ?', [row.id]);
    if (b.c) throw new ApiError(409, 'PO has vendor bills');
  },
});

/** Approval limit by amount: auto-approve under limit, otherwise route for approval. */
ctrl.submit = asyncHandler(async (req, res) => {
  const po = await queryOne('SELECT po.*, p.project_code, p.approved_budget, v.name AS vendor_name FROM purchase_orders po LEFT JOIN projects p ON p.id = po.project_id LEFT JOIN vendors v ON v.id = po.vendor_id WHERE po.id = ?', [req.params.id]);
  if (!po) throw new ApiError(404, 'PO not found');
  if (!['Draft', 'Rejected'].includes(po.status)) throw new ApiError(409, `PO is already ${po.status}`);
  const limit = await getNumber('po_approval_limit', 100000);
  const reasons = [];
  if (num(po.amount) > limit) reasons.push(`Amount exceeds approval limit of ₹${limit}`);
  if (po.project_id && num(po.approved_budget) > 0) {
    const c = await queryOne("SELECT COALESCE(SUM(amount),0) AS c FROM purchase_orders WHERE project_id = ? AND status IN ('Approved','Issued','Delivered')", [po.project_id]);
    if (num(c.c) + num(po.amount) > num(po.approved_budget)) reasons.push('Commitments will exceed approved project budget');
  }
  if (reasons.length) {
    await query("UPDATE purchase_orders SET status = 'Pending Approval' WHERE id = ?", [po.id]);
    await createApproval({
      entityType: 'purchase_order', entityId: po.id, requestType: 'Purchase order',
      title: `${po.po_code} – ${po.vendor_name}${po.project_code ? ' – ' + po.project_code : ''}`,
      amount: po.total_amount, reason: reasons.join('; '), req, link: '/vendors/purchase-orders',
    });
  } else {
    await query("UPDATE purchase_orders SET status = 'Approved', approved_by = ?, approved_at = NOW() WHERE id = ?", [req.user.id, po.id]);
  }
  await logAudit(req, 'submit', 'purchase_orders', po.id, { reasons });
  res.json(await ctrl.findById(po.id, req));
});

ctrl.setStatus = asyncHandler(async (req, res) => {
  const po = await queryOne('SELECT * FROM purchase_orders WHERE id = ?', [req.params.id]);
  if (!po) throw new ApiError(404, 'PO not found');
  const { status, delivery_status } = req.body;
  const allowed = { Approved: ['Issued', 'Cancelled'], Issued: ['Delivered', 'Cancelled'], Delivered: [], Draft: ['Cancelled'], Rejected: ['Cancelled'] };
  if (status && !(allowed[po.status] || []).includes(status)) throw new ApiError(409, `Cannot change PO from ${po.status} to ${status}`);
  await query('UPDATE purchase_orders SET status = COALESCE(?, status), delivery_status = COALESCE(?, delivery_status) WHERE id = ?', [
    status || null, status === 'Delivered' ? 'Delivered' : delivery_status || null, po.id,
  ]);
  await logAudit(req, 'status', 'purchase_orders', po.id, req.body);
  res.json(await ctrl.findById(po.id, req));
});

module.exports = ctrl;
