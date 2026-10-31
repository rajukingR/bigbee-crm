/** Client Servicing dashboard: projects, handovers to accept, client approvals, escalations, proposals, upcoming events. */
const { query, queryOne } = require('../config/db');
const { num } = require('../utils/helpers');
const { inIds, anyIn, today, addDays } = require('./helpers');

const ACTIVE = "('Handover Pending','Planning','In Progress','Event Live')";

module.exports = async function servicing(ids) {
  const pj = anyIn(['p.cs_owner_id', 'p.manager_id'], ids);
  const recv = inIds('h.received_by', ids);
  const prop = inIds('pr.owner_id', ids);

  const [active, handovers, approvals, escalations, rating] = await Promise.all([
    queryOne(`SELECT COUNT(*) AS n FROM projects p WHERE p.status IN ${ACTIVE} ${pj.sql}`, pj.params),
    queryOne(`SELECT COUNT(*) AS n FROM project_handovers h WHERE h.status IN ('Submitted','Clarification Requested') ${recv.sql}`, recv.params),
    queryOne(
      `SELECT COUNT(*) AS n FROM milestones m JOIN projects p ON p.id = m.project_id
        WHERE m.milestone_type = 'Client Approval' AND m.status NOT IN ('Completed','Cancelled') ${pj.sql}`,
      pj.params
    ),
    queryOne(
      `SELECT COUNT(*) AS n FROM escalations x LEFT JOIN projects p ON p.id = x.project_id
        WHERE x.status IN ('Open','In Progress') ${ids === null ? '' : anyIn(['p.cs_owner_id', 'p.manager_id', 'x.raised_by', 'x.escalated_to'], ids).sql}`,
      ids === null ? [] : anyIn(['p.cs_owner_id', 'p.manager_id', 'x.raised_by', 'x.escalated_to'], ids).params
    ),
    queryOne(
      `SELECT ROUND(AVG(f.rating_overall),1) AS v, COUNT(*) AS n FROM feedback f JOIN projects p ON p.id = f.project_id
        WHERE f.feedback_date >= DATE_SUB(CURDATE(), INTERVAL 180 DAY) ${pj.sql}`,
      pj.params
    ),
  ]);

  const [upcoming, handoverList, proposals, byStatus, changes] = await Promise.all([
    query(
      `SELECT p.id, p.project_code, p.name, p.event_start, p.status, p.health, p.progress, c.name AS company_name
         FROM projects p LEFT JOIN companies c ON c.id = p.company_id
        WHERE p.status IN ${ACTIVE} AND p.event_start BETWEEN ? AND ? ${pj.sql} ORDER BY p.event_start LIMIT 6`,
      [today(), addDays(60), ...pj.params]
    ),
    query(
      `SELECT h.project_id, h.status, h.submitted_at, p.project_code, p.name, e.full_name AS handed_over_by_name
         FROM project_handovers h JOIN projects p ON p.id = h.project_id LEFT JOIN employees e ON e.id = h.handed_over_by
        WHERE h.status IN ('Submitted','Clarification Requested') ${recv.sql} ORDER BY h.submitted_at LIMIT 5`,
      recv.params
    ),
    query(
      `SELECT pr.id, pr.proposal_code, pr.version, pr.title, pr.status, pr.total_amount, c.name AS company_name
         FROM proposals pr LEFT JOIN companies c ON c.id = pr.company_id
        WHERE pr.is_latest = 1 AND pr.status IN ('Draft','Pending Approval','Approved','Sent','Rejected') ${prop.sql}
        ORDER BY pr.updated_at DESC LIMIT 6`,
      prop.params
    ),
    query(`SELECT p.status AS name, COUNT(*) AS value FROM projects p WHERE p.status <> 'Cancelled' ${pj.sql} GROUP BY p.status`, pj.params),
    query(
      `SELECT cr.id, cr.title, cr.status, cr.revenue_impact, p.project_code, p.id AS project_id FROM change_requests cr JOIN projects p ON p.id = cr.project_id
        WHERE cr.status = 'Requested' ${pj.sql} ORDER BY cr.id DESC LIMIT 5`,
      pj.params
    ),
  ]);

  return {
    type: 'servicing',
    title: 'Client Servicing Dashboard',
    kpis: {
      active_projects: num(active.n),
      handovers_pending: num(handovers.n),
      client_approvals: num(approvals.n),
      open_escalations: num(escalations.n),
      satisfaction: rating.v === null ? null : Number(rating.v),
      feedback_count: num(rating.n),
    },
    upcoming,
    handovers: handoverList,
    proposals,
    by_status: byStatus,
    change_requests: changes,
  };
};
