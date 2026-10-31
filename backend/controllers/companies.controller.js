const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');

async function findDuplicates({ name, phone, email, excludeId = 0 }) {
  const out = [];
  if (name) {
    const rows = await query(
      `SELECT id, company_code, name, city, 'name' AS matched_on FROM companies
        WHERE id <> ? AND (LOWER(TRIM(name)) = LOWER(TRIM(?)) OR REPLACE(LOWER(name),' ','') = REPLACE(LOWER(?),' ',''))`,
      [excludeId, name, name]
    );
    out.push(...rows);
  }
  if (phone) {
    out.push(...(await query("SELECT id, company_code, name, city, 'phone' AS matched_on FROM companies WHERE id <> ? AND phone = ?", [excludeId, phone])));
  }
  if (email) {
    out.push(...(await query("SELECT id, company_code, name, city, 'email' AS matched_on FROM companies WHERE id <> ? AND email = ?", [excludeId, email])));
  }
  return out;
}

const ctrl = crudController({
  table: 'companies',
  module: 'companies',
  select: `t.*, i.name AS industry_name, o.full_name AS owner_name,
    (SELECT COUNT(*) FROM contacts c WHERE c.company_id = t.id) AS contact_count,
    (SELECT COUNT(*) FROM leads l WHERE l.company_id = t.id) AS lead_count,
    (SELECT COUNT(*) FROM projects p WHERE p.company_id = t.id) AS project_count,
    (SELECT COALESCE(SUM(p.confirmed_value + p.change_order_value),0) FROM projects p WHERE p.company_id = t.id AND p.status <> 'Cancelled') AS won_revenue`,
  joins: 'LEFT JOIN industries i ON i.id = t.industry_id LEFT JOIN employees o ON o.id = t.owner_id',
  fields: ['name', 'industry_id', 'company_size', 'website', 'phone', 'email', 'address', 'city', 'state', 'locations', 'gst_no', 'target_departments', 'client_type', 'bucket', 'owner_id', 'status', 'notes'],
  trackCreator: true,
  required: ['name'],
  searchFields: ['t.name', 't.company_code', 't.city', 't.phone', 't.email'],
  filters: { industry_id: 't.industry_id', owner_id: 't.owner_id', client_type: 't.client_type', bucket: 't.bucket', status: 't.status', city: 't.city' },
  dateField: 't.created_at',
  codeField: 'company_code',
  codePrefix: 'CMP',
  beforeSave: async (data, req, existing) => {
    if (!existing && !data.owner_id) data.owner_id = req.user.id;
    if (req.body.force) return data;
    const dups = await findDuplicates({
      name: data.name,
      phone: data.phone,
      email: data.email,
      excludeId: existing ? existing.id : 0,
    });
    if (dups.length) {
      const err = new ApiError(409, `Possible duplicate company: ${dups.map((d) => `${d.name} (${d.matched_on})`).join(', ')}`);
      throw err;
    }
    return data;
  },
  beforeDelete: async (row) => {
    const used = await queryOne(
      `SELECT (SELECT COUNT(*) FROM leads WHERE company_id = ?) + (SELECT COUNT(*) FROM opportunities WHERE company_id = ?)
            + (SELECT COUNT(*) FROM projects WHERE company_id = ?) AS c`,
      [row.id, row.id, row.id]
    );
    if (used.c > 0) throw new ApiError(409, 'Company has leads / opportunities / projects. Mark it Inactive instead of deleting.');
    await query('DELETE FROM contacts WHERE company_id = ?', [row.id]);
  },
});

ctrl.checkDuplicate = asyncHandler(async (req, res) => {
  res.json(await findDuplicates({ ...req.query, excludeId: req.query.exclude_id || 0 }));
});

/** Full account history: contacts, leads, opportunities, proposals, projects, activities, collections. */
ctrl.overview = asyncHandler(async (req, res) => {
  const id = req.params.id;
  const company = await ctrl.findById(id, req);
  if (!company) throw new ApiError(404, 'Company not found');
  const [contacts, leads, opportunities, proposals, projects, activities, invoices] = await Promise.all([
    query('SELECT * FROM contacts WHERE company_id = ? ORDER BY is_primary DESC, name', [id]),
    query(
      `SELECT l.id, l.lead_code, l.created_at, l.expected_budget, l.qualification, ls.name AS status_name, e.full_name AS owner_name
         FROM leads l LEFT JOIN lead_statuses ls ON ls.id = l.lead_status_id LEFT JOIN employees e ON e.id = l.owner_id
        WHERE l.company_id = ? ORDER BY l.id DESC`,
      [id]
    ),
    query(
      `SELECT o.id, o.opp_code, o.title, o.expected_value, o.expected_close_date, f.name AS stage_name, f.color AS stage_color, e.full_name AS owner_name
         FROM opportunities o LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id LEFT JOIN employees e ON e.id = o.owner_id
        WHERE o.company_id = ? ORDER BY o.id DESC`,
      [id]
    ),
    query('SELECT id, proposal_code, title, version, status, total_amount, sent_date FROM proposals WHERE company_id = ? ORDER BY id DESC', [id]),
    query('SELECT id, project_code, name, status, event_start, confirmed_value FROM projects WHERE company_id = ? ORDER BY id DESC', [id]),
    query(
      `SELECT a.*, e.full_name AS owner_name FROM activities a LEFT JOIN employees e ON e.id = a.owner_id
        WHERE (a.related_type = 'company' AND a.related_id = ?)
           OR (a.related_type = 'lead' AND a.related_id IN (SELECT id FROM leads WHERE company_id = ?))
           OR (a.related_type = 'opportunity' AND a.related_id IN (SELECT id FROM opportunities WHERE company_id = ?))
        ORDER BY a.activity_date DESC LIMIT 100`,
      [id, id, id]
    ),
    query('SELECT id, invoice_no, invoice_date, due_date, total_amount, received_amount, status FROM invoices WHERE company_id = ? ORDER BY id DESC', [id]),
  ]);
  res.json({ company, contacts, leads, opportunities, proposals, projects, activities, invoices });
});

/** Segregate existing clients vs existing data and assign revenue buckets. */
ctrl.recalculateBuckets = asyncHandler(async (req, res) => {
  await query(`UPDATE companies c
      LEFT JOIN (SELECT company_id, SUM(confirmed_value + change_order_value) AS rev FROM projects WHERE status <> 'Cancelled' GROUP BY company_id) p
        ON p.company_id = c.id
      LEFT JOIN (SELECT company_id, COUNT(*) AS n FROM leads GROUP BY company_id) l ON l.company_id = c.id
      SET c.client_type = CASE WHEN COALESCE(p.rev,0) > 0 THEN 'Existing Client' WHEN COALESCE(l.n,0) > 0 THEN 'Existing Data' ELSE c.client_type END,
          c.bucket = CASE WHEN COALESCE(p.rev,0) >= 5000000 THEN 'A' WHEN COALESCE(p.rev,0) >= 2000000 THEN 'B'
                          WHEN COALESCE(p.rev,0) > 0 THEN 'C' WHEN COALESCE(l.n,0) > 0 THEN 'D' ELSE c.bucket END`);
  res.json({ message: 'Client types and buckets recalculated' });
});

module.exports = ctrl;
