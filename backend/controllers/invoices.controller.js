const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, num, round2 } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

async function refreshInvoice(id) {
  const inv = await queryOne('SELECT total_amount, status, (SELECT COALESCE(SUM(amount),0) FROM receipts WHERE invoice_id = ?) AS rec FROM invoices WHERE id = ?', [id, id]);
  if (!inv) return;
  const rec = num(inv.rec);
  let status = inv.status;
  if (status !== 'Cancelled' && status !== 'Draft') status = rec <= 0 ? 'Raised' : rec >= num(inv.total_amount) - 0.01 ? 'Paid' : 'Partially Paid';
  await query('UPDATE invoices SET received_amount = ?, status = ? WHERE id = ?', [rec, status, id]);
}

const ctrl = crudController({
  table: 'invoices',
  module: 'invoices',
  select: `t.*, p.project_code, p.name AS project_name, co.name AS company_name, o.full_name AS owner_name,
    ROUND(t.total_amount - t.received_amount, 2) AS outstanding,
    CASE WHEN t.status NOT IN ('Paid','Cancelled') AND t.due_date < CURDATE() THEN DATEDIFF(CURDATE(), t.due_date) ELSE 0 END AS overdue_days`,
  joins: 'LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN employees o ON o.id = t.owner_id',
  fields: ['invoice_no', 'project_id', 'company_id', 'invoice_type', 'invoice_date', 'due_date', 'amount', 'tax_pct', 'status', 'next_follow_up', 'owner_id', 'notes'],
  trackCreator: true,
  required: ['project_id', 'amount'],
  searchFields: ['t.invoice_no', 'p.project_code', 'p.name', 'co.name'],
  filters: { project_id: 't.project_id', company_id: 't.company_id', status: 't.status', invoice_type: 't.invoice_type', owner_id: 't.owner_id' },
  dateField: 't.invoice_date',
  codeField: 'invoice_no',
  codePrefix: 'INV',
  extraWhere: async (req) => (req.query.overdue === '1' ? { sql: " AND t.status NOT IN ('Paid','Cancelled','Draft') AND t.due_date < CURDATE()", params: [] } : null),
  beforeSave: async (data, req, existing) => {
    if (data.project_id) {
      const p = await queryOne('SELECT company_id, finance_owner_id, tax_pct FROM projects WHERE id = ?', [data.project_id]);
      if (p) {
        data.company_id = data.company_id || p.company_id;
        if (!existing) data.owner_id = data.owner_id || p.finance_owner_id || req.user.id;
        if (data.tax_pct === undefined || data.tax_pct === null) data.tax_pct = existing ? existing.tax_pct : p.tax_pct;
      }
    }
    const amount = data.amount !== undefined ? num(data.amount) : num(existing && existing.amount);
    const tax = data.tax_pct !== undefined && data.tax_pct !== null ? num(data.tax_pct) : num(existing ? existing.tax_pct : 18);
    data.tax_amount = round2((amount * tax) / 100);
    data.total_amount = round2(amount + data.tax_amount);
    if (!existing) data.invoice_date = data.invoice_date || new Date().toISOString().slice(0, 10);
    return data;
  },
  afterUpdate: async (row) => refreshInvoice(row.id),
  beforeDelete: async (row) => {
    if (num(row.received_amount) > 0) throw new ApiError(409, 'Invoice has receipts. Cancel it instead.');
  },
});

ctrl.receipts = asyncHandler(async (req, res) => {
  res.json(await query('SELECT r.*, e.full_name AS created_by_name FROM receipts r LEFT JOIN employees e ON e.id = r.created_by WHERE r.invoice_id = ? ORDER BY r.receipt_date DESC', [req.params.id]));
});

ctrl.addReceipt = asyncHandler(async (req, res) => {
  const inv = await queryOne('SELECT * FROM invoices WHERE id = ?', [req.params.id]);
  if (!inv) throw new ApiError(404, 'Invoice not found');
  if (inv.status === 'Cancelled') throw new ApiError(409, 'Invoice is cancelled');
  const amount = num(req.body.amount);
  if (amount <= 0) throw new ApiError(400, 'Enter a valid amount');
  if (amount > num(inv.total_amount) - num(inv.received_amount) + 0.01) throw new ApiError(400, 'Receipt exceeds outstanding amount');
  await query('INSERT INTO receipts (invoice_id, amount, receipt_date, mode, reference, created_by) VALUES (?,?,?,?,?,?)', [
    inv.id, amount, req.body.receipt_date || new Date().toISOString().slice(0, 10), req.body.mode || 'NEFT', req.body.reference || null, req.user.id,
  ]);
  await refreshInvoice(inv.id);
  await logAudit(req, 'receipt', 'invoices', inv.id, req.body);
  res.status(201).json(await ctrl.findById(inv.id, req));
});

ctrl.removeReceipt = asyncHandler(async (req, res) => {
  const r = await queryOne('SELECT * FROM receipts WHERE id = ?', [req.params.receiptId]);
  if (!r) throw new ApiError(404, 'Receipt not found');
  await query('DELETE FROM receipts WHERE id = ?', [r.id]);
  await refreshInvoice(r.invoice_id);
  await logAudit(req, 'delete_receipt', 'invoices', r.invoice_id, r);
  res.json({ message: 'Receipt removed' });
});

module.exports = ctrl;
