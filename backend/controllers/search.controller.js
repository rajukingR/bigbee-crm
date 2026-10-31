const { query } = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const { hasPermission } = require('../middleware/auth');
const { scopeClause } = require('../utils/scope');

/** Global search: company, contact, lead ID, opportunity ID, project code, vendor, invoice. */
exports.search = asyncHandler(async (req, res) => {
  const q = (req.query.q || '').trim();
  if (q.length < 2) return res.json([]);
  const like = `%${q}%`;
  const u = req.user;
  const out = [];
  const add = (rows, type, link) => rows.forEach((r) => out.push({ type, id: r.id, title: r.title, subtitle: r.subtitle, link: link(r) }));

  if (hasPermission(u, 'companies', 'view')) {
    add(await query(`SELECT id, name AS title, CONCAT_WS(' · ', company_code, city) AS subtitle FROM companies WHERE name LIKE ? OR company_code LIKE ? OR phone LIKE ? LIMIT 5`, [like, like, like]), 'Company', (r) => `/companies/${r.id}`);
  }
  if (hasPermission(u, 'contacts', 'view')) {
    add(await query(`SELECT c.id, c.name AS title, CONCAT_WS(' · ', co.name, c.phone, c.email) AS subtitle, c.company_id FROM contacts c LEFT JOIN companies co ON co.id = c.company_id WHERE c.name LIKE ? OR c.phone LIKE ? OR c.email LIKE ? LIMIT 5`, [like, like, like]), 'Contact', (r) => (r.company_id ? `/companies/${r.company_id}` : '/contacts'));
  }
  if (hasPermission(u, 'leads', 'view')) {
    const s = await scopeClause(u, ['l.owner_id', 'l.created_by']);
    add(await query(`SELECT l.id, CONCAT(l.lead_code, ' – ', COALESCE(l.company_name, l.contact_name, '')) AS title, CONCAT_WS(' · ', l.contact_name, l.phone) AS subtitle FROM leads l WHERE (l.lead_code LIKE ? OR l.company_name LIKE ? OR l.contact_name LIKE ? OR l.phone LIKE ?) ${s.sql} LIMIT 5`, [like, like, like, like, ...s.params]), 'Lead', (r) => `/leads/${r.id}`);
  }
  if (hasPermission(u, 'opportunities', 'view')) {
    const s = await scopeClause(u, ['o.owner_id']);
    add(await query(`SELECT o.id, CONCAT(o.opp_code, ' – ', o.title) AS title, co.name AS subtitle FROM opportunities o LEFT JOIN companies co ON co.id = o.company_id WHERE (o.opp_code LIKE ? OR o.title LIKE ?) ${s.sql} LIMIT 5`, [like, like, ...s.params]), 'Opportunity', (r) => `/opportunities/${r.id}`);
  }
  if (hasPermission(u, 'projects', 'view')) {
    const s = await scopeClause(u, ['p.bd_owner_id', 'p.cs_owner_id', 'p.ops_owner_id', 'p.manager_id', 'p.finance_owner_id']);
    add(await query(`SELECT p.id, CONCAT(p.project_code, ' – ', p.name) AS title, CONCAT_WS(' · ', co.name, p.status) AS subtitle FROM projects p LEFT JOIN companies co ON co.id = p.company_id WHERE (p.project_code LIKE ? OR p.name LIKE ?) ${s.sql} LIMIT 5`, [like, like, ...s.params]), 'Project', (r) => `/projects/${r.id}`);
  }
  if (hasPermission(u, 'proposals', 'view')) {
    add(await query("SELECT id, CONCAT(proposal_code, ' v', version, ' – ', title) AS title, status AS subtitle FROM proposals WHERE proposal_code LIKE ? OR title LIKE ? LIMIT 5", [like, like]), 'Proposal', (r) => `/proposals/${r.id}`);
  }
  if (hasPermission(u, 'vendors', 'view')) {
    add(await query("SELECT id, name AS title, CONCAT_WS(' · ', vendor_code, city) AS subtitle FROM vendors WHERE name LIKE ? OR vendor_code LIKE ? OR gst_no LIKE ? LIMIT 5", [like, like, like]), 'Vendor', () => '/vendors');
  }
  if (hasPermission(u, 'invoices', 'view')) {
    add(await query("SELECT i.id, i.invoice_no AS title, CONCAT_WS(' · ', co.name, i.status) AS subtitle FROM invoices i LEFT JOIN companies co ON co.id = i.company_id WHERE i.invoice_no LIKE ? LIMIT 5", [like]), 'Invoice', () => '/finance/invoices');
  }
  res.json(out);
});
