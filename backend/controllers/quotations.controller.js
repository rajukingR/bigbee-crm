const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

const ctrl = crudController({
  table: 'vendor_quotations',
  module: 'quotations',
  select: `t.*, v.name AS vendor_name, v.rating AS vendor_rating, p.project_code, p.name AS project_name,
    ROUND(COALESCE(NULLIF(t.negotiated_amount,0), t.quoted_amount) * (1 + t.tax_pct/100), 2) AS final_with_tax,
    COALESCE(NULLIF(t.negotiated_amount,0), t.quoted_amount) AS final_amount`,
  joins: 'LEFT JOIN vendors v ON v.id = t.vendor_id LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'vendor_id', 'requirement', 'quote_date', 'quoted_amount', 'negotiated_amount', 'tax_pct', 'delivery_days', 'status', 'notes'],
  trackCreator: true,
  required: ['vendor_id', 'requirement'],
  searchFields: ['t.requirement', 'v.name', 'p.name', 'p.project_code', 't.quote_code'],
  filters: { project_id: 't.project_id', vendor_id: 't.vendor_id', status: 't.status', requirement: 't.requirement' },
  dateField: 't.quote_date',
  codeField: 'quote_code',
  codePrefix: 'VQ',
});

/** Side-by-side comparison grouped by project + requirement. */
ctrl.compare = asyncHandler(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1';
  if (req.query.project_id) { where += ' AND q.project_id = ?'; params.push(req.query.project_id); }
  if (req.query.requirement) { where += ' AND q.requirement = ?'; params.push(req.query.requirement); }
  const rows = await query(
    `SELECT q.*, v.name AS vendor_name, v.rating AS vendor_rating, p.project_code, p.name AS project_name,
            COALESCE(NULLIF(q.negotiated_amount,0), q.quoted_amount) AS final_amount
       FROM vendor_quotations q LEFT JOIN vendors v ON v.id = q.vendor_id LEFT JOIN projects p ON p.id = q.project_id
      ${where} ORDER BY q.project_id, q.requirement, final_amount`,
    params
  );
  const groups = {};
  rows.forEach((r) => {
    const key = `${r.project_id || 0}|${r.requirement}`;
    if (!groups[key]) groups[key] = { project_id: r.project_id, project_code: r.project_code, project_name: r.project_name, requirement: r.requirement, quotes: [] };
    groups[key].quotes.push(r);
  });
  const out = Object.values(groups).map((g) => {
    const amounts = g.quotes.map((q) => Number(q.final_amount));
    const min = Math.min(...amounts);
    return { ...g, lowest: min, highest: Math.max(...amounts), quotes: g.quotes.map((q) => ({ ...q, is_lowest: Number(q.final_amount) === min })) };
  });
  res.json(out);
});

/** Select a vendor quotation; others for the same requirement are rejected. */
ctrl.select = asyncHandler(async (req, res) => {
  const q = await queryOne('SELECT * FROM vendor_quotations WHERE id = ?', [req.params.id]);
  if (!q) throw new ApiError(404, 'Quotation not found');
  await query(
    "UPDATE vendor_quotations SET is_selected = 0, status = 'Rejected' WHERE requirement = ? AND COALESCE(project_id,0) = COALESCE(?,0) AND id <> ?",
    [q.requirement, q.project_id, q.id]
  );
  await query("UPDATE vendor_quotations SET is_selected = 1, status = 'Selected', negotiated_amount = COALESCE(?, negotiated_amount) WHERE id = ?", [req.body.negotiated_amount || null, q.id]);
  await logAudit(req, 'select_quotation', 'quotations', q.id, { requirement: q.requirement });
  res.json({ message: 'Vendor selected' });
});

module.exports = ctrl;
