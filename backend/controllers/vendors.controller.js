const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { hasPermission } = require('../middleware/auth');

const BANK = ['bank_name', 'bank_account_no', 'bank_ifsc', 'bank_account_name'];

/** Bank / payment details are restricted. */
function mask(row, req) {
  if (hasPermission(req.user, 'vendor_bank', 'view')) return row;
  const out = { ...row };
  BANK.forEach((f) => {
    if (out[f]) out[f] = f === 'bank_account_no' ? `XXXX${String(out[f]).slice(-4)}` : '••••';
  });
  out.bank_restricted = true;
  return out;
}

const ctrl = crudController({
  table: 'vendors',
  module: 'vendors',
  select: `t.*, c.name AS category_name,
    (SELECT COUNT(DISTINCT po.project_id) FROM purchase_orders po WHERE po.vendor_id = t.id) AS project_count,
    (SELECT COALESCE(SUM(b.total_amount - b.paid_amount),0) FROM vendor_bills b WHERE b.vendor_id = t.id) AS outstanding`,
  joins: 'LEFT JOIN categories c ON c.id = t.category_id',
  fields: ['name', 'category_id', 'services', 'contact_person', 'phone', 'email', 'city', 'locations', 'address', 'gst_no', 'pan_no', 'payment_terms', ...BANK, 'rating', 'performance_notes', 'status'],
  trackCreator: true,
  required: ['name'],
  searchFields: ['t.name', 't.vendor_code', 't.city', 't.services', 't.contact_person', 't.phone', 't.gst_no'],
  filters: { category_id: 't.category_id', status: 't.status', city: 't.city' },
  codeField: 'vendor_code',
  codePrefix: 'VND',
  defaultSort: 't.name ASC',
  transformRow: mask,
  beforeSave: async (data, req, existing) => {
    if (!hasPermission(req.user, 'vendor_bank', 'edit')) BANK.forEach((f) => delete data[f]);
    if (data.gst_no) {
      const dup = await queryOne('SELECT id, name FROM vendors WHERE gst_no = ? AND id <> ?', [data.gst_no, existing ? existing.id : 0]);
      if (dup) throw new ApiError(409, `GST number already used by vendor ${dup.name}`);
    }
    return data;
  },
  beforeDelete: async (row) => {
    const c = await queryOne('SELECT (SELECT COUNT(*) FROM purchase_orders WHERE vendor_id = ?) + (SELECT COUNT(*) FROM vendor_bills WHERE vendor_id = ?) AS c', [row.id, row.id]);
    if (c.c > 0) throw new ApiError(409, 'Vendor has POs / bills. Mark Inactive instead.');
  },
});

ctrl.history = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const [quotes, pos, bills] = await Promise.all([
    query('SELECT q.*, p.project_code, p.name AS project_name FROM vendor_quotations q LEFT JOIN projects p ON p.id = q.project_id WHERE q.vendor_id = ? ORDER BY q.id DESC', [id]),
    query('SELECT po.*, p.project_code, p.name AS project_name FROM purchase_orders po LEFT JOIN projects p ON p.id = po.project_id WHERE po.vendor_id = ? ORDER BY po.id DESC', [id]),
    query('SELECT b.*, p.project_code FROM vendor_bills b LEFT JOIN projects p ON p.id = b.project_id WHERE b.vendor_id = ? ORDER BY b.id DESC', [id]),
  ]);
  res.json({ quotations: quotes, purchase_orders: pos, bills });
});

module.exports = ctrl;
