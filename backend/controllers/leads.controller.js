const { query, queryOne, transaction } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, codeFor } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { getNumber } = require('../utils/settings');

const FIELDS = [
  'company_id', 'contact_id', 'company_name', 'contact_name', 'phone', 'email', 'city', 'location',
  'lead_type_id', 'lead_source_id', 'sub_source_id', 'campaign_id', 'service_id', 'event_type_id',
  'tentative_event_date', 'expected_budget', 'expected_decision_date', 'requirement', 'owner_id',
  'lead_status_id', 'priority', 'next_action', 'next_follow_up', 'qualification', 'qualification_notes',
  'disqualify_reason', 'duplicate_of',
];

/** Automated assignment: least-loaded active BD employee (Executive / Manager). */
async function autoAssignOwner(req) {
  const me = req.user;
  const myDept = await queryOne('SELECT code FROM departments WHERE id = ?', [me.department_id]);
  if (myDept && myDept.code === 'BD') return me.id;
  const pick = await queryOne(
    `SELECT e.id, (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0) AS open_leads
       FROM employees e JOIN departments d ON d.id = e.department_id JOIN roles r ON r.id = e.role_id
      WHERE d.code = 'BD' AND e.active_status = 1 AND r.level >= 3
      ORDER BY open_leads ASC, e.id ASC LIMIT 1`
  );
  return pick ? pick.id : me.id;
}

async function findDuplicateLead(data, excludeId = 0) {
  const conds = [];
  const params = [excludeId];
  if (data.phone) { conds.push('l.phone = ?'); params.push(data.phone); }
  if (data.email) { conds.push('l.email = ?'); params.push(data.email); }
  if (data.company_id) { conds.push('(l.company_id = ? AND l.is_converted = 0)'); params.push(data.company_id); }
  if (!conds.length) return null;
  return queryOne(`SELECT l.id, l.lead_code FROM leads l WHERE l.id <> ? AND (${conds.join(' OR ')}) ORDER BY l.id LIMIT 1`, params);
}

/** Link to an existing company/contact or create them so data stays connected. */
async function linkCompanyAndContact(data, req) {
  if (!data.company_id && data.company_name) {
    const found = await queryOne('SELECT id FROM companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [data.company_name]);
    if (found) data.company_id = found.id;
    else {
      const r = await query(
        'INSERT INTO companies (name, city, phone, email, owner_id, client_type, created_by) VALUES (?,?,?,?,?,?,?)',
        [data.company_name, data.city || null, null, null, data.owner_id || req.user.id, 'Prospect', req.user.id]
      );
      await query('UPDATE companies SET company_code = ? WHERE id = ?', [codeFor('CMP', r.insertId), r.insertId]);
      data.company_id = r.insertId;
    }
  }
  if (data.company_id && !data.company_name) {
    const c = await queryOne('SELECT name FROM companies WHERE id = ?', [data.company_id]);
    if (c) data.company_name = c.name;
  }
  if (!data.contact_id && data.contact_name && data.company_id) {
    let found = null;
    if (data.phone || data.email) {
      found = await queryOne('SELECT id FROM contacts WHERE company_id = ? AND (phone = ? OR email = ?)', [data.company_id, data.phone || '-', data.email || '-']);
    }
    if (found) data.contact_id = found.id;
    else {
      const r = await query(
        'INSERT INTO contacts (company_id, name, phone, email, location, owner_id, created_by) VALUES (?,?,?,?,?,?,?)',
        [data.company_id, data.contact_name, data.phone || null, data.email || null, data.city || null, data.owner_id || req.user.id, req.user.id]
      );
      data.contact_id = r.insertId;
    }
  }
  if (data.contact_id && !data.contact_name) {
    const c = await queryOne('SELECT name, phone, email FROM contacts WHERE id = ?', [data.contact_id]);
    if (c) {
      data.contact_name = c.name;
      data.phone = data.phone || c.phone;
      data.email = data.email || c.email;
    }
  }
}

const ctrl = crudController({
  table: 'leads',
  module: 'leads',
  select: `t.*, co.name AS company_display, lt.name AS lead_type_name, src.name AS source_name, ss.name AS sub_source_name,
    cp.name AS campaign_name, sv.name AS service_name, et.name AS event_type_name, ls.name AS status_name, ls.color AS status_color,
    o.full_name AS owner_name, cb.full_name AS created_by_name,
    CASE WHEN t.next_follow_up IS NOT NULL AND t.next_follow_up < NOW() AND t.is_converted = 0 THEN 1 ELSE 0 END AS is_overdue`,
  joins: `LEFT JOIN companies co ON co.id = t.company_id
    LEFT JOIN lead_types lt ON lt.id = t.lead_type_id
    LEFT JOIN lead_sources src ON src.id = t.lead_source_id
    LEFT JOIN sub_sources ss ON ss.id = t.sub_source_id
    LEFT JOIN campaigns cp ON cp.id = t.campaign_id
    LEFT JOIN services sv ON sv.id = t.service_id
    LEFT JOIN lead_event_types et ON et.id = t.event_type_id
    LEFT JOIN lead_statuses ls ON ls.id = t.lead_status_id
    LEFT JOIN employees o ON o.id = t.owner_id
    LEFT JOIN employees cb ON cb.id = t.created_by`,
  fields: FIELDS,
  trackCreator: true,
  searchFields: ['t.lead_code', 't.company_name', 't.contact_name', 't.phone', 't.email', 't.city', 'co.name'],
  filters: {
    owner_id: 't.owner_id', lead_status_id: 't.lead_status_id', lead_type_id: 't.lead_type_id',
    lead_source_id: 't.lead_source_id', service_id: 't.service_id', event_type_id: 't.event_type_id',
    campaign_id: 't.campaign_id', priority: 't.priority', qualification: 't.qualification',
    company_id: 't.company_id', city: 't.city', is_converted: 't.is_converted',
  },
  dateField: 't.created_at',
  ownerColumns: ['t.owner_id', 't.created_by'],
  codeField: 'lead_code',
  codePrefix: 'LD',
  sortable: ['t.next_follow_up', 't.created_at', 't.expected_budget'],
  extraWhere: async (req) => {
    const q = req.query;
    let sql = '';
    if (q.overdue === '1') sql += ' AND t.next_follow_up < NOW() AND t.is_converted = 0';
    if (q.no_next_action === '1') sql += " AND (t.next_follow_up IS NULL AND (t.next_action IS NULL OR t.next_action = '')) AND t.is_converted = 0";
    if (q.inactive === '1') {
      const days = await getNumber('inactive_lead_days', 7);
      sql += ` AND t.is_converted = 0 AND COALESCE(t.last_activity_at, t.created_at) < DATE_SUB(NOW(), INTERVAL ${Math.floor(days)} DAY)`;
    }
    if (q.duplicates === '1') sql += ' AND t.duplicate_of IS NOT NULL';
    return { sql, params: [] };
  },
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      if (!data.company_name && !data.company_id && !data.contact_name) throw new ApiError(400, 'Company or contact name is required');
      if (!data.owner_id) data.owner_id = await autoAssignOwner(req);
      if (!data.lead_status_id) {
        const s = await queryOne("SELECT id FROM lead_statuses WHERE name = 'New'");
        if (s) data.lead_status_id = s.id;
      }
      await linkCompanyAndContact(data, req);
      const dup = await findDuplicateLead(data);
      if (dup) data.duplicate_of = dup.id;
    } else {
      await linkCompanyAndContact(data, req);
      if (data.owner_id && Number(data.owner_id) !== Number(existing.owner_id)) {
        await query(
          'INSERT INTO lead_assignments (lead_id, from_owner_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?,?)',
          [existing.id, existing.owner_id, data.owner_id, req.body.reassign_reason || 'Changed while editing lead', req.user.id]
        );
        await notify(data.owner_id, 'Lead assigned to you', `Lead ${existing.lead_code} has been assigned to you`, `/leads/${existing.id}`, 'lead');
      }
    }
    if (data.owner_id) {
      const o = await queryOne('SELECT department_id FROM employees WHERE id = ?', [data.owner_id]);
      if (o) data.department_id = o.department_id;
    }
    return data;
  },
  afterCreate: async (row, req) => {
    await query(
      'INSERT INTO lead_assignments (lead_id, from_owner_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?,?)',
      [row.id, null, row.owner_id, 'Initial assignment', req.user.id]
    );
    if (row.owner_id && row.owner_id !== req.user.id) {
      await notify(row.owner_id, 'New lead assigned', `${row.lead_code} – ${row.company_name || row.contact_name || ''}`, `/leads/${row.id}`, 'lead');
    }
  },
  beforeDelete: async (row) => {
    if (row.is_converted) throw new ApiError(409, 'Converted lead cannot be deleted');
    await query('DELETE FROM lead_assignments WHERE lead_id = ?', [row.id]);
    await query("DELETE FROM activities WHERE related_type = 'lead' AND related_id = ?", [row.id]);
  },
});

ctrl.detail = asyncHandler(async (req, res) => {
  const lead = await ctrl.findById(req.params.id, req);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const [activities, assignments, duplicate] = await Promise.all([
    query(
      `SELECT a.*, e.full_name AS owner_name, fm.name AS mode_name FROM activities a
         LEFT JOIN employees e ON e.id = a.owner_id LEFT JOIN follow_up_modes fm ON fm.id = a.follow_up_mode_id
        WHERE a.related_type = 'lead' AND a.related_id = ? ORDER BY a.activity_date DESC`,
      [lead.id]
    ),
    query(
      `SELECT la.*, f.full_name AS from_name, t.full_name AS to_name, b.full_name AS assigned_by_name
         FROM lead_assignments la LEFT JOIN employees f ON f.id = la.from_owner_id
         LEFT JOIN employees t ON t.id = la.to_owner_id LEFT JOIN employees b ON b.id = la.assigned_by
        WHERE la.lead_id = ? ORDER BY la.id DESC`,
      [lead.id]
    ),
    lead.duplicate_of ? queryOne('SELECT id, lead_code, company_name, contact_name FROM leads WHERE id = ?', [lead.duplicate_of]) : null,
  ]);
  res.json({ ...lead, activities, assignments, duplicate });
});

/** Reassign with full history: previous owner, new owner, date, reason and who authorised it. */
ctrl.assign = asyncHandler(async (req, res) => {
  const lead = await queryOne('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) throw new ApiError(404, 'Lead not found');
  const { owner_id, reason } = req.body;
  if (!owner_id) throw new ApiError(400, 'Select the new owner');
  if (!reason) throw new ApiError(400, 'Reason for reassignment is required');
  const o = await queryOne('SELECT department_id FROM employees WHERE id = ?', [owner_id]);
  await query('UPDATE leads SET owner_id = ?, department_id = ? WHERE id = ?', [owner_id, o ? o.department_id : null, lead.id]);
  await query(
    'INSERT INTO lead_assignments (lead_id, from_owner_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?,?)',
    [lead.id, lead.owner_id, owner_id, reason, req.user.id]
  );
  await logAudit(req, 'reassign', 'leads', lead.id, { from: lead.owner_id, to: owner_id, reason });
  await notify(owner_id, 'Lead reassigned to you', `${lead.lead_code}: ${reason}`, `/leads/${lead.id}`, 'lead');
  res.json(await ctrl.findById(lead.id, req));
});

ctrl.bulkAssign = asyncHandler(async (req, res) => {
  const { lead_ids = [], owner_id, reason } = req.body;
  if (!lead_ids.length || !owner_id) throw new ApiError(400, 'Select leads and the new owner');
  for (const id of lead_ids) {
    const lead = await queryOne('SELECT id, owner_id FROM leads WHERE id = ?', [id]);
    if (!lead) continue;
    await query('UPDATE leads SET owner_id = ? WHERE id = ?', [owner_id, id]);
    await query(
      'INSERT INTO lead_assignments (lead_id, from_owner_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?,?)',
      [id, lead.owner_id, owner_id, reason || 'Bulk assignment', req.user.id]
    );
  }
  await logAudit(req, 'bulk_reassign', 'leads', null, { lead_ids, owner_id, reason });
  await notify(owner_id, 'Leads assigned to you', `${lead_ids.length} lead(s) assigned to you`, '/leads', 'lead');
  res.json({ message: `${lead_ids.length} lead(s) reassigned` });
});

ctrl.qualify = asyncHandler(async (req, res) => {
  const { qualification, qualification_notes, disqualify_reason } = req.body;
  if (!['Qualified', 'Disqualified', 'Pending'].includes(qualification)) throw new ApiError(400, 'Invalid qualification');
  if (qualification === 'Disqualified' && !disqualify_reason) throw new ApiError(400, 'Disqualification reason is required');
  const statusName = qualification === 'Pending' ? 'In Progress' : qualification;
  const st = await queryOne('SELECT id FROM lead_statuses WHERE name = ?', [statusName]);
  await query(
    'UPDATE leads SET qualification = ?, qualification_notes = ?, disqualify_reason = ?, lead_status_id = COALESCE(?, lead_status_id) WHERE id = ?',
    [qualification, qualification_notes || null, disqualify_reason || null, st ? st.id : null, req.params.id]
  );
  await logAudit(req, 'qualify', 'leads', Number(req.params.id), { qualification, disqualify_reason });
  res.json(await ctrl.findById(req.params.id, req));
});

/** Convert a lead into an opportunity, carrying all data forward. */
ctrl.convert = asyncHandler(async (req, res) => {
  const lead = await queryOne('SELECT * FROM leads WHERE id = ?', [req.params.id]);
  if (!lead) throw new ApiError(404, 'Lead not found');
  if (lead.is_converted) throw new ApiError(409, 'Lead is already converted');
  const b = req.body || {};
  const stage = b.funnel_status_id
    ? await queryOne('SELECT * FROM funnel_statuses WHERE id = ?', [b.funnel_status_id])
    : await queryOne("SELECT * FROM funnel_statuses WHERE name = 'Qualified'") || (await queryOne("SELECT * FROM funnel_statuses WHERE stage_type = 'open' ORDER BY sort_order LIMIT 1"));
  const oppId = await transaction(async (conn) => {
    const [r] = await conn.query(
      `INSERT INTO opportunities (title, lead_id, company_id, contact_id, owner_id, service_id, event_type_id, lead_source_id, campaign_id,
         city, expected_value, funnel_status_id, probability, expected_close_date, event_date, next_action, next_follow_up, notes, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        b.title || `${lead.company_name || lead.contact_name} – Event`,
        lead.id, lead.company_id, lead.contact_id, b.owner_id || lead.owner_id, lead.service_id, lead.event_type_id,
        lead.lead_source_id, lead.campaign_id, lead.city, b.expected_value || lead.expected_budget || 0,
        stage ? stage.id : null, stage ? stage.probability : 0, b.expected_close_date || lead.expected_decision_date,
        lead.tentative_event_date, lead.next_action, lead.next_follow_up, lead.requirement, req.user.id,
      ]
    );
    await conn.query('UPDATE opportunities SET opp_code = ? WHERE id = ?', [codeFor('OPP', r.insertId), r.insertId]);
    await conn.query(
      'INSERT INTO opportunity_stage_history (opportunity_id, from_status_id, to_status_id, probability, remarks, changed_by) VALUES (?,?,?,?,?,?)',
      [r.insertId, null, stage ? stage.id : null, stage ? stage.probability : 0, `Converted from lead ${lead.lead_code}`, req.user.id]
    );
    const conv = await conn.query("SELECT id FROM lead_statuses WHERE name = 'Converted'");
    const convId = conv[0][0] ? conv[0][0].id : lead.lead_status_id;
    await conn.query(
      "UPDATE leads SET is_converted = 1, opportunity_id = ?, qualification = 'Qualified', lead_status_id = ? WHERE id = ?",
      [r.insertId, convId, lead.id]
    );
    return r.insertId;
  });
  await logAudit(req, 'convert', 'leads', lead.id, { opportunity_id: oppId });
  res.status(201).json({ message: 'Lead converted to opportunity', opportunity_id: oppId });
});

module.exports = ctrl;
