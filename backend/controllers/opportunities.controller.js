const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, num } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { notify } = require('../utils/notify');
const { hasPermission } = require('../middleware/auth');
const { getNumber } = require('../utils/settings');
const { publicPath } = require('../middleware/upload');
const { createProjectFromOpportunity } = require('../utils/projectService');
const { scopeClause } = require('../utils/scope');

const FIELDS = [
  'title', 'lead_id', 'company_id', 'contact_id', 'owner_id', 'service_id', 'event_type_id', 'lead_source_id',
  'campaign_id', 'city', 'expected_value', 'funnel_status_id', 'probability', 'expected_close_date', 'event_date',
  'next_action', 'next_follow_up', 'competitor', 'loss_reason_id', 'lost_value', 'loss_notes', 'notes',
];

const SELECT = `t.*, co.name AS company_name, co.industry_id, ind.name AS industry_name, ct.name AS contact_name,
  o.full_name AS owner_name, sv.name AS service_name, et.name AS event_type_name, src.name AS source_name,
  f.name AS stage_name, f.color AS stage_color, f.stage_type, f.sort_order AS stage_order,
  COALESCE(t.probability, f.probability, 0) AS effective_probability,
  ROUND(t.expected_value * COALESCE(t.probability, f.probability, 0) / 100, 2) AS weighted_value,
  DATEDIFF(NOW(), t.stage_changed_at) AS stage_age_days, lr.name AS loss_reason_name, pr.project_code`;

const JOINS = `LEFT JOIN companies co ON co.id = t.company_id
  LEFT JOIN industries ind ON ind.id = co.industry_id
  LEFT JOIN contacts ct ON ct.id = t.contact_id
  LEFT JOIN employees o ON o.id = t.owner_id
  LEFT JOIN services sv ON sv.id = t.service_id
  LEFT JOIN lead_event_types et ON et.id = t.event_type_id
  LEFT JOIN lead_sources src ON src.id = t.lead_source_id
  LEFT JOIN funnel_statuses f ON f.id = t.funnel_status_id
  LEFT JOIN loss_reasons lr ON lr.id = t.loss_reason_id
  LEFT JOIN projects pr ON pr.id = t.project_id`;

async function recordStage(oppId, fromId, toId, prob, remarks, userId) {
  await query(
    'INSERT INTO opportunity_stage_history (opportunity_id, from_status_id, to_status_id, probability, remarks, changed_by) VALUES (?,?,?,?,?,?)',
    [oppId, fromId, toId, prob, remarks || null, userId]
  );
}

const ctrl = crudController({
  table: 'opportunities',
  module: 'opportunities',
  select: SELECT,
  joins: JOINS,
  fields: FIELDS,
  trackCreator: true,
  required: ['title'],
  searchFields: ['t.opp_code', 't.title', 'co.name', 't.city', 't.competitor'],
  filters: {
    owner_id: 't.owner_id', funnel_status_id: 't.funnel_status_id', service_id: 't.service_id',
    industry_id: 'co.industry_id', lead_source_id: 't.lead_source_id', city: 't.city',
    company_id: 't.company_id', stage_type: 'f.stage_type', event_type_id: 't.event_type_id',
    department_id: 'o.department_id',
  },
  dateField: 't.expected_close_date',
  ownerColumns: ['t.owner_id'],
  codeField: 'opp_code',
  codePrefix: 'OPP',
  sortable: ['t.expected_value', 't.expected_close_date', 't.stage_changed_at'],
  extraWhere: async (req) => {
    const q = req.query;
    let sql = '';
    const params = [];
    if (q.close_period === 'week') sql += ' AND YEARWEEK(t.expected_close_date, 1) = YEARWEEK(CURDATE(), 1)';
    if (q.close_period === 'month') sql += ' AND YEAR(t.expected_close_date) = YEAR(CURDATE()) AND MONTH(t.expected_close_date) = MONTH(CURDATE())';
    if (q.close_period === 'quarter') sql += ' AND YEAR(t.expected_close_date) = YEAR(CURDATE()) AND QUARTER(t.expected_close_date) = QUARTER(CURDATE())';
    if (q.overdue === '1') sql += " AND t.next_follow_up < NOW() AND f.stage_type IN ('open','hold')";
    if (q.ageing === '1') {
      const d = await getNumber('stage_ageing_days', 15);
      sql += ` AND f.stage_type = 'open' AND t.stage_changed_at < DATE_SUB(NOW(), INTERVAL ${Math.floor(d)} DAY)`;
    }
    if (q.min_value) { sql += ' AND t.expected_value >= ?'; params.push(q.min_value); }
    if (q.max_value) { sql += ' AND t.expected_value <= ?'; params.push(q.max_value); }
    return { sql, params };
  },
  beforeSave: async (data, req, existing) => {
    // Probability override only for authorised roles (audited by crud update diff)
    if (data.probability !== undefined && data.probability !== null) {
      const stageProb = existing
        ? (await queryOne('SELECT probability FROM funnel_statuses WHERE id = ?', [data.funnel_status_id || existing.funnel_status_id])) || {}
        : {};
      const changed = !existing || num(data.probability) !== num(existing.probability);
      if (changed && num(data.probability) !== num(stageProb.probability)) {
        if (!hasPermission(req.user, 'opportunities', 'approve')) {
          throw new ApiError(403, 'Only authorised roles can override stage probability');
        }
        data.probability_override = 1;
      }
    }
    const newStage = data.funnel_status_id
      ? await queryOne('SELECT * FROM funnel_statuses WHERE id = ?', [data.funnel_status_id])
      : null;
    if (!existing) {
      if (!data.owner_id) data.owner_id = req.user.id;
      let stage = newStage;
      if (!stage) {
        stage = await queryOne("SELECT * FROM funnel_statuses WHERE stage_type = 'open' ORDER BY sort_order LIMIT 1");
        if (stage) data.funnel_status_id = stage.id;
      }
      if (stage && stage.stage_type === 'won') throw new ApiError(400, 'Create the opportunity first, then use "Mark as Won"');
      if (stage && (data.probability === undefined || data.probability === null)) data.probability = stage.probability;
      if (data.lead_id) {
        const lead = await queryOne('SELECT company_id, contact_id FROM leads WHERE id = ?', [data.lead_id]);
        if (lead) {
          data.company_id = data.company_id || lead.company_id;
          data.contact_id = data.contact_id || lead.contact_id;
        }
      }
    } else if (newStage && Number(newStage.id) !== Number(existing.funnel_status_id)) {
      if (newStage.stage_type === 'won') throw new ApiError(400, 'Use "Mark as Won" so that confirmation evidence is captured');
      if (newStage.stage_type === 'lost' && !(data.loss_reason_id || existing.loss_reason_id)) {
        throw new ApiError(400, 'Loss reason is required to mark an opportunity Lost');
      }
      data.stage_changed_at = new Date();
      if (!existing.probability_override && (data.probability === undefined || data.probability === null)) data.probability = newStage.probability;
      if (newStage.stage_type === 'lost' && !data.lost_value) data.lost_value = data.expected_value || existing.expected_value;
      await recordStage(existing.id, existing.funnel_status_id, newStage.id, data.probability ?? newStage.probability, req.body.stage_remarks, req.user.id);
    }
    return data;
  },
  afterCreate: async (row, req) => {
    await recordStage(row.id, null, row.funnel_status_id, row.effective_probability, 'Created', req.user.id);
  },
  beforeDelete: async (row) => {
    if (row.project_id) throw new ApiError(409, 'Opportunity has a project and cannot be deleted');
    await query('DELETE FROM opportunity_stage_history WHERE opportunity_id = ?', [row.id]);
  },
});

/** Move to another stage (Kanban drag or stage button). */
ctrl.changeStage = asyncHandler(async (req, res) => {
  const opp = await queryOne('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const stage = await queryOne('SELECT * FROM funnel_statuses WHERE id = ?', [req.body.funnel_status_id]);
  if (!stage) throw new ApiError(400, 'Invalid stage');
  if (stage.stage_type === 'won') throw new ApiError(400, 'Use "Mark as Won" so that confirmation evidence is captured');
  const b = req.body;
  if (stage.stage_type === 'lost' && !b.loss_reason_id) throw new ApiError(400, 'Loss reason is required');
  const prob = opp.probability_override ? opp.probability : stage.probability;
  await query(
    `UPDATE opportunities SET funnel_status_id = ?, probability = ?, stage_changed_at = NOW(),
       loss_reason_id = COALESCE(?, loss_reason_id), competitor = COALESCE(?, competitor),
       lost_value = COALESCE(?, lost_value), loss_notes = COALESCE(?, loss_notes) WHERE id = ?`,
    [
      stage.id, prob, b.loss_reason_id || null, b.competitor || null,
      stage.stage_type === 'lost' ? b.lost_value || opp.expected_value : null, b.loss_notes || null, opp.id,
    ]
  );
  await recordStage(opp.id, opp.funnel_status_id, stage.id, prob, b.remarks, req.user.id);
  await logAudit(req, 'stage_change', 'opportunities', opp.id, { from: opp.funnel_status_id, to: stage.id });
  res.json(await ctrl.findById(opp.id, req));
});

/** Mark Won only with configured evidence, then create the project. */
ctrl.markWon = asyncHandler(async (req, res) => {
  const opp = await queryOne('SELECT * FROM opportunities WHERE id = ?', [req.params.id]);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  if (opp.won_at) throw new ApiError(409, 'Opportunity is already Won');
  const b = req.body || {};
  const evidenceRequired = (await getNumber('won_evidence_required', 1)) === 1;
  if (evidenceRequired && !b.win_evidence && !req.file) {
    throw new ApiError(400, 'Confirmation evidence (PO / signed proposal / contract reference or file) is required to mark Won');
  }
  const won = await queryOne("SELECT * FROM funnel_statuses WHERE stage_type = 'won' ORDER BY sort_order LIMIT 1");
  if (!won) throw new ApiError(400, 'No "Won" stage configured in Funnel Status master');
  if (req.file) {
    await query(
      `INSERT INTO attachments (entity_type, entity_id, doc_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES ('opportunity', ?, 'Win Evidence', ?, ?, ?, ?, ?, ?)`,
      [opp.id, req.file.originalname, req.file.filename, publicPath(req.file), req.file.mimetype, req.file.size, req.user.id]
    );
  }
  await query(
    'UPDATE opportunities SET funnel_status_id = ?, probability = 100, won_at = NOW(), stage_changed_at = NOW(), win_evidence = ?, expected_value = COALESCE(?, expected_value) WHERE id = ?',
    [won.id, b.win_evidence || (req.file ? req.file.originalname : null), b.confirmed_value || null, opp.id]
  );
  await recordStage(opp.id, opp.funnel_status_id, won.id, 100, `Won – ${b.win_evidence || 'evidence uploaded'}`, req.user.id);
  const projectId = await createProjectFromOpportunity(opp.id, req, b);
  if (opp.lead_id) {
    const lead = await queryOne('SELECT created_by, lead_code FROM leads WHERE id = ?', [opp.lead_id]);
    if (lead && lead.created_by && lead.created_by !== opp.owner_id) {
      await notify(lead.created_by, 'Your lead was won 🎉', `${lead.lead_code} → ${opp.opp_code} ${opp.title}`, `/opportunities/${opp.id}`, 'lead');
    }
  }
  const finance = await query(
    "SELECT e.id FROM employees e JOIN departments d ON d.id = e.department_id JOIN roles r ON r.id = e.role_id WHERE d.code = 'FIN' AND e.active_status = 1 AND r.level <= 3"
  );
  await notify(finance.map((f) => f.id), 'New confirmed project', `${opp.opp_code} won – set up invoicing schedule`, `/projects/${projectId}`, 'finance');
  await logAudit(req, 'won', 'opportunities', opp.id, { project_id: projectId, evidence: b.win_evidence });
  res.json({ message: 'Opportunity Won and project created', project_id: projectId });
});

ctrl.detail = asyncHandler(async (req, res) => {
  const opp = await ctrl.findById(req.params.id, req);
  if (!opp) throw new ApiError(404, 'Opportunity not found');
  const [history, activities, proposals] = await Promise.all([
    query(
      `SELECT h.*, f1.name AS from_stage, f2.name AS to_stage, e.full_name AS changed_by_name
         FROM opportunity_stage_history h LEFT JOIN funnel_statuses f1 ON f1.id = h.from_status_id
         LEFT JOIN funnel_statuses f2 ON f2.id = h.to_status_id LEFT JOIN employees e ON e.id = h.changed_by
        WHERE h.opportunity_id = ? ORDER BY h.id DESC`,
      [opp.id]
    ),
    query(
      `SELECT a.*, e.full_name AS owner_name FROM activities a LEFT JOIN employees e ON e.id = a.owner_id
        WHERE (a.related_type = 'opportunity' AND a.related_id = ?) OR (a.related_type = 'lead' AND a.related_id = ?)
        ORDER BY a.activity_date DESC`,
      [opp.id, opp.lead_id || 0]
    ),
    query('SELECT id, proposal_code, title, version, status, total_amount, margin_pct, sent_date, is_latest FROM proposals WHERE opportunity_id = ? ORDER BY id DESC', [opp.id]),
  ]);
  res.json({ ...opp, history, activities, proposals });
});

/** Kanban board: stages with their opportunities and totals. */
ctrl.pipeline = asyncHandler(async (req, res) => {
  const stages = await query('SELECT * FROM funnel_statuses WHERE status = 1 ORDER BY sort_order');
  const scope = await scopeClause(req.user, ['t.owner_id']);
  let where = ' WHERE 1=1' + scope.sql;
  const params = [...scope.params];
  ['owner_id', 'service_id', 'lead_source_id'].forEach((f) => {
    if (req.query[f]) { where += ` AND t.${f} = ?`; params.push(req.query[f]); }
  });
  if (req.query.search) { where += ' AND (t.title LIKE ? OR co.name LIKE ?)'; params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = await query(`SELECT ${SELECT} FROM opportunities t ${JOINS} ${where} ORDER BY t.expected_close_date IS NULL, t.expected_close_date`, params);
  const board = stages.map((s) => {
    const items = rows.filter((r) => r.funnel_status_id === s.id);
    return {
      ...s,
      items,
      count: items.length,
      value: items.reduce((a, r) => a + num(r.expected_value), 0),
      weighted: items.reduce((a, r) => a + num(r.weighted_value), 0),
    };
  });
  res.json(board);
});

module.exports = ctrl;
