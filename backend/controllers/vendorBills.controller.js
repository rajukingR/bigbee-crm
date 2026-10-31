const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, num, round2 } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

async function refreshBill(id) {
  const b = await queryOne('SELECT total_amount, (SELECT COALESCE(SUM(amount),0) FROM vendor_payments WHERE bill_id = ?) AS paid FROM vendor_bills WHERE id = ?', [id, id]);
  if (!b) return;
  const paid = num(b.paid);
  const status = paid <= 0 ? 'Pending' : paid >= num(b.total_amount) ? 'Paid' : 'Partially Paid';
  await query("UPDATE vendor_bills SET paid_amount = ?, status = IF(status = 'Disputed', status, ?) WHERE id = ?", [paid, status, id]);
}

const ctrl = crudController({
  table: 'vendor_bills',
  module: 'vendor_bills',
  select: `t.*, v.name AS vendor_name, p.project_code, p.name AS project_name, po.po_code,
    ROUND(t.total_amount - t.paid_amount, 2) AS balance,
    CASE WHEN t.status <> 'Paid' AND t.due_date < CURDATE() THEN DATEDIFF(CURDATE(), t.due_date) ELSE 0 END AS overdue_days`,
  joins: 'LEFT JOIN vendors v ON v.id = t.vendor_id LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN purchase_orders po ON po.id = t.po_id',
  fields: ['bill_no', 'po_id', 'vendor_id', 'project_id', 'bill_type', 'bill_date', 'due_date', 'amount', 'tax_amount', 'notes', 'status'],
  trackCreator: true,
  required: ['bill_no', 'vendor_id', 'amount'],
  searchFields: ['t.bill_no', 'v.name', 'p.project_code', 'po.po_code'],
  filters: { vendor_id: 't.vendor_id', project_id: 't.project_id', po_id: 't.po_id', status: 't.status', bill_type: 't.bill_type' },
  dateField: 't.bill_date',
  beforeSave: async (data, req, existing) => {
    if (data.po_id) {
      const po = await queryOne('SELECT vendor_id, project_id, tax_pct FROM purchase_orders WHERE id = ?', [data.po_id]);
      if (po) {
        data.vendor_id = data.vendor_id || po.vendor_id;
        data.project_id = data.project_id || po.project_id;
        if ((data.tax_amount === undefined || data.tax_amount === null) && data.amount) data.tax_amount = round2((num(data.amount) * num(po.tax_pct)) / 100);
      }
    }
    const amount = data.amount !== undefined ? num(data.amount) : num(existing && existing.amount);
    const tax = data.tax_amount !== undefined && data.tax_amount !== null ? num(data.tax_amount) : num(existing && existing.tax_amount);
    data.total_amount = round2(amount + tax);
    return data;
  },
  afterUpdate: async (row) => refreshBill(row.id),
});

ctrl.payments = asyncHandler(async (req, res) => {
  res.json(await query('SELECT vp.*, e.full_name AS created_by_name FROM vendor_payments vp LEFT JOIN employees e ON e.id = vp.created_by WHERE vp.bill_id = ? ORDER BY vp.payment_date DESC', [req.params.id]));
});

ctrl.addPayment = asyncHandler(async (req, res) => {
  const bill = await queryOne('SELECT * FROM vendor_bills WHERE id = ?', [req.params.id]);
  if (!bill) throw new ApiError(404, 'Bill not found');
  const amount = num(req.body.amount);
  if (amount <= 0) throw new ApiError(400, 'Enter a valid amount');
  if (amount > num(bill.total_amount) - num(bill.paid_amount) + 0.01) throw new ApiError(400, 'Payment exceeds bill balance');
  await query('INSERT INTO vendor_payments (bill_id, amount, payment_date, mode, reference, created_by) VALUES (?,?,?,?,?,?)', [
    bill.id, amount, req.body.payment_date || new Date().toISOString().slice(0, 10), req.body.mode || 'NEFT', req.body.reference || null, req.user.id,
  ]);
  await refreshBill(bill.id);
  await logAudit(req, 'payment', 'vendor_bills', bill.id, req.body);
  res.status(201).json(await ctrl.findById(bill.id, req));
});

ctrl.removePayment = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM vendor_payments WHERE id = ?', [req.params.paymentId]);
  if (!p) throw new ApiError(404, 'Payment not found');
  await query('DELETE FROM vendor_payments WHERE id = ?', [p.id]);
  await refreshBill(p.bill_id);
  await logAudit(req, 'delete_payment', 'vendor_bills', p.bill_id, p);
  res.json({ message: 'Payment removed' });
});

module.exports = ctrl;
