const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler } = require('../utils/helpers');
const { scopeClause } = require('../utils/scope');

const ctrl = crudController({
  table: 'activities',
  module: 'activities',
  select: `t.*, e.full_name AS owner_name, fm.name AS mode_name,
    CASE t.related_type
      WHEN 'lead' THEN (SELECT CONCAT(lead_code, ' – ', COALESCE(company_name, contact_name, '')) FROM leads WHERE id = t.related_id)
      WHEN 'opportunity' THEN (SELECT CONCAT(opp_code, ' – ', title) FROM opportunities WHERE id = t.related_id)
      WHEN 'company' THEN (SELECT name FROM companies WHERE id = t.related_id)
      WHEN 'project' THEN (SELECT CONCAT(project_code, ' – ', name) FROM projects WHERE id = t.related_id)
      WHEN 'proposal' THEN (SELECT CONCAT(proposal_code, ' v', version) FROM proposals WHERE id = t.related_id)
      ELSE NULL END AS related_name`,
  joins: 'LEFT JOIN employees e ON e.id = t.owner_id LEFT JOIN follow_up_modes fm ON fm.id = t.follow_up_mode_id',
  fields: ['related_type', 'related_id', 'activity_type', 'follow_up_mode_id', 'subject', 'outcome', 'activity_date', 'next_action', 'next_follow_up', 'owner_id'],
  required: ['related_type', 'related_id', 'activity_type'],
  searchFields: ['t.subject', 't.outcome'],
  filters: { related_type: 't.related_type', related_id: 't.related_id', activity_type: 't.activity_type', owner_id: 't.owner_id' },
  dateField: 't.activity_date',
  ownerColumns: ['t.owner_id'],
  defaultSort: 't.activity_date DESC',
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.owner_id = data.owner_id || req.user.id;
      data.activity_date = data.activity_date || new Date();
    }
    return data;
  },
  afterCreate: async (row) => {
    // Keep the parent record's last activity / next follow-up current
    const tbl = { lead: 'leads', opportunity: 'opportunities' }[row.related_type];
    if (tbl) {
      await query(
        `UPDATE ${tbl} SET last_activity_at = ?, next_action = COALESCE(?, next_action), next_follow_up = ? WHERE id = ?`,
        [row.activity_date, row.next_action, row.next_follow_up || null, row.related_id]
      );
      if (row.related_type === 'lead') {
        const lead = await queryOne('SELECT l.lead_status_id, s.name FROM leads l LEFT JOIN lead_statuses s ON s.id = l.lead_status_id WHERE l.id = ?', [row.related_id]);
        if (lead && lead.name === 'New') {
          const c = await queryOne("SELECT id FROM lead_statuses WHERE name = 'Contacted'");
          if (c) await query('UPDATE leads SET lead_status_id = ? WHERE id = ?', [c.id, row.related_id]);
        }
      }
    }
  },
});

/** Follow-up board: leads, opportunities and tasks due today / overdue / upcoming. */
ctrl.followUps = asyncHandler(async (req, res) => {
  const range = req.query.range || 'today';
  const cond = {
    overdue: (c) => `${c} < NOW()`,
    today: (c) => `DATE(${c}) = CURDATE()`,
    upcoming: (c) => `${c} > NOW() AND ${c} <= DATE_ADD(NOW(), INTERVAL 7 DAY)`,
    all: (c) => `${c} IS NOT NULL`,
  }[range] || ((c) => `DATE(${c}) = CURDATE()`);
  const ownerFilter = req.query.owner_id ? Number(req.query.owner_id) : null;

  const ls = await scopeClause(req.user, ['l.owner_id']);
  const os = await scopeClause(req.user, ['o.owner_id']);
  const ts = await scopeClause(req.user, ['t.owner_id']);

  const leads = await query(
    `SELECT 'lead' AS type, l.id, l.lead_code AS code, COALESCE(l.company_name, l.contact_name) AS name, l.next_action,
            l.next_follow_up AS due, l.priority, l.owner_id, e.full_name AS owner_name, l.phone
       FROM leads l LEFT JOIN employees e ON e.id = l.owner_id
      WHERE l.is_converted = 0 AND l.next_follow_up IS NOT NULL AND ${cond('l.next_follow_up')} ${ls.sql}
        ${ownerFilter ? 'AND l.owner_id = ' + ownerFilter : ''}`,
    ls.params
  );
  const opps = await query(
    `SELECT 'opportunity' AS type, o.id, o.opp_code AS code, o.title AS name, o.next_action, o.next_follow_up AS due,
            'Medium' AS priority, o.owner_id, e.full_name AS owner_name, NULL AS phone
       FROM opportunities o LEFT JOIN employees e ON e.id = o.owner_id LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id
      WHERE f.stage_type IN ('open','hold') AND o.next_follow_up IS NOT NULL AND ${cond('o.next_follow_up')} ${os.sql}
        ${ownerFilter ? 'AND o.owner_id = ' + ownerFilter : ''}`,
    os.params
  );
  const tasks = await query(
    `SELECT 'task' AS type, t.id, CONCAT('TSK', t.id) AS code, t.title AS name, t.status AS next_action, t.due_date AS due,
            t.priority, t.owner_id, e.full_name AS owner_name, NULL AS phone
       FROM tasks t LEFT JOIN employees e ON e.id = t.owner_id
      WHERE t.status NOT IN ('Completed','Cancelled') AND t.due_date IS NOT NULL AND ${cond('t.due_date')} ${ts.sql}
        ${ownerFilter ? 'AND t.owner_id = ' + ownerFilter : ''}`,
    ts.params
  );
  const all = [...leads, ...opps, ...tasks].sort((a, b) => String(a.due).localeCompare(String(b.due)));
  res.json(all);
});

module.exports = ctrl;
