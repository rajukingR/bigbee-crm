/**
 * Shared sales metric calculations used by targets, dashboards and reports.
 * "who" filter: { employeeIds: [..] } or { departmentId } or {} (company).
 */
const { queryOne } = require('../config/db');

function ownerFilter(who, col = 'o.owner_id') {
  if (who.employeeIds && who.employeeIds.length) {
    return { sql: ` AND ${col} IN (${who.employeeIds.map(() => '?').join(',')})`, params: who.employeeIds };
  }
  if (who.departmentId) {
    return { sql: ` AND ${col} IN (SELECT id FROM employees WHERE department_id = ?)`, params: [who.departmentId] };
  }
  return { sql: '', params: [] };
}

async function salesMetrics(who, from, to) {
  const f = ownerFilter(who);
  const won = await queryOne(
    `SELECT COALESCE(SUM(o.expected_value),0) AS v, COUNT(*) AS n FROM opportunities o
      WHERE o.won_at BETWEEN ? AND ? ${f.sql}`,
    [from, `${to} 23:59:59`, ...f.params]
  );
  const pipe = await queryOne(
    `SELECT COALESCE(SUM(o.expected_value),0) AS unweighted,
            COALESCE(SUM(o.expected_value * COALESCE(o.probability, fs.probability, 0) / 100),0) AS weighted,
            COUNT(*) AS n
       FROM opportunities o JOIN funnel_statuses fs ON fs.id = o.funnel_status_id
      WHERE fs.stage_type = 'open' ${f.sql}`,
    f.params
  );
  const pipePeriod = await queryOne(
    `SELECT COALESCE(SUM(o.expected_value * COALESCE(o.probability, fs.probability, 0) / 100),0) AS weighted
       FROM opportunities o JOIN funnel_statuses fs ON fs.id = o.funnel_status_id
      WHERE fs.stage_type = 'open' AND o.expected_close_date BETWEEN ? AND ? ${f.sql}`,
    [from, to, ...f.params]
  );
  const lost = await queryOne(
    `SELECT COUNT(*) AS n, COALESCE(SUM(COALESCE(o.lost_value, o.expected_value)),0) AS v
       FROM opportunities o JOIN funnel_statuses fs ON fs.id = o.funnel_status_id
      WHERE fs.stage_type = 'lost' AND o.stage_changed_at BETWEEN ? AND ? ${f.sql}`,
    [from, `${to} 23:59:59`, ...f.params]
  );
  const lf = ownerFilter(who, 'l.owner_id');
  const leads = await queryOne(
    `SELECT COUNT(*) AS total, SUM(l.qualification = 'Qualified') AS qualified
       FROM leads l WHERE l.created_at BETWEEN ? AND ? ${lf.sql}`,
    [from, `${to} 23:59:59`, ...lf.params]
  );
  const af = ownerFilter(who, 'a.owner_id');
  const acts = await queryOne(
    `SELECT SUM(a.activity_type = 'Call') AS calls, SUM(a.activity_type = 'Meeting') AS meetings,
            SUM(a.activity_type = 'Email') AS emails, SUM(a.activity_type = 'Proposal Sent') AS proposals_logged, COUNT(*) AS total
       FROM activities a WHERE a.activity_date BETWEEN ? AND ? ${af.sql}`,
    [from, `${to} 23:59:59`, ...af.params]
  );
  const pf = ownerFilter(who, 'p.owner_id');
  const props = await queryOne(
    `SELECT COUNT(*) AS n, COALESCE(SUM(p.total_amount),0) AS v FROM proposals p
      WHERE p.sent_date BETWEEN ? AND ? ${pf.sql}`,
    [from, to, ...pf.params]
  );
  const of = ownerFilter(who, 'o.owner_id');
  const overdue = await queryOne(
    `SELECT COUNT(*) AS n FROM opportunities o JOIN funnel_statuses fs ON fs.id = o.funnel_status_id
      WHERE fs.stage_type IN ('open','hold') AND o.next_follow_up < NOW() ${of.sql}`,
    of.params
  );
  const overdueLeads = await queryOne(
    `SELECT COUNT(*) AS n FROM leads l WHERE l.is_converted = 0 AND l.next_follow_up < NOW() ${lf.sql}`,
    lf.params
  );
  const closedCount = Number(won.n) + Number(lost.n);
  return {
    won_value: Number(won.v),
    won_count: Number(won.n),
    lost_value: Number(lost.v),
    lost_count: Number(lost.n),
    pipeline_unweighted: Number(pipe.unweighted),
    pipeline_weighted: Number(pipe.weighted),
    pipeline_count: Number(pipe.n),
    forecast: Number(won.v) + Number(pipePeriod.weighted),
    leads: Number(leads.total || 0),
    qualified_leads: Number(leads.qualified || 0),
    calls: Number(acts.calls || 0),
    meetings: Number(acts.meetings || 0),
    emails: Number(acts.emails || 0),
    activities: Number(acts.total || 0),
    proposals_sent: Number(props.n || 0),
    proposal_value: Number(props.v || 0),
    win_rate: closedCount ? Math.round((Number(won.n) / closedCount) * 1000) / 10 : 0,
    overdue_followups: Number(overdue.n) + Number(overdueLeads.n),
  };
}

module.exports = { salesMetrics, ownerFilter };
