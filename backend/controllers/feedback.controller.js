const { query } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { codeFor } = require('../utils/helpers');

module.exports = crudController({
  table: 'feedback',
  module: 'feedback',
  select: `t.*, p.project_code, p.name AS project_name, p.company_id, co.name AS company_name, ct.name AS contact_name,
           e.full_name AS collected_by_name,
           ROUND((t.rating_overall + t.rating_quality + t.rating_communication + t.rating_timeliness) / 4, 1) AS avg_rating`,
  joins: `LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN companies co ON co.id = p.company_id
          LEFT JOIN contacts ct ON ct.id = t.contact_id LEFT JOIN employees e ON e.id = t.collected_by`,
  fields: ['project_id', 'contact_id', 'feedback_date', 'rating_overall', 'rating_quality', 'rating_communication', 'rating_timeliness', 'nps', 'comments', 'repeat_business', 'repeat_notes'],
  required: ['project_id'],
  searchFields: ['p.name', 'p.project_code', 'co.name', 't.comments'],
  filters: { project_id: 't.project_id', repeat_business: 't.repeat_business' },
  dateField: 't.feedback_date',
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.collected_by = req.user.id;
      data.feedback_date = data.feedback_date || new Date().toISOString().slice(0, 10);
    }
    return data;
  },
  afterCreate: async (row, req) => {
    // Repeat-business opportunity -> create a new lead for BD
    if (row.repeat_business) {
      const p = await query('SELECT company_id, contact_id, bd_owner_id, city FROM projects WHERE id = ?', [row.project_id]);
      const proj = p[0];
      if (proj) {
        const type = await query("SELECT id FROM lead_types WHERE name = 'Existing Client' LIMIT 1");
        const src = await query("SELECT id FROM lead_sources WHERE name = 'Existing Client' LIMIT 1");
        const r = await query(
          `INSERT INTO leads (company_id, contact_id, company_name, city, lead_type_id, lead_source_id, requirement, owner_id, created_by)
           SELECT ?, ?, name, ?, ?, ?, ?, ?, ? FROM companies WHERE id = ?`,
          [proj.company_id, proj.contact_id, proj.city, type[0] ? type[0].id : null, src[0] ? src[0].id : null,
            `Repeat business from ${row.project_code}: ${row.repeat_notes || ''}`, proj.bd_owner_id || req.user.id, req.user.id, proj.company_id]
        );
        if (r.insertId) await query('UPDATE leads SET lead_code = ? WHERE id = ?', [codeFor('LD', r.insertId), r.insertId]);
      }
    }
  },
});
