/** BD / Sales dashboard: targets, pipeline, follow-ups, closing deals, team leaderboard. */
const { query, queryOne } = require('../config/db');
const { num } = require('../utils/helpers');
const { salesMetrics } = require('../utils/metrics');
const { inIds, monthRange, lastMonths, change } = require('./helpers');

module.exports = async function sales(ids) {
  const who = ids === null ? {} : { employeeIds: ids };
  const cur = monthRange(0);
  const prev = monthRange(-1);
  const y = new Date().getFullYear();
  const [mCur, mPrev, mYear] = await Promise.all([
    salesMetrics(who, cur.start, cur.end),
    salesMetrics(who, prev.start, prev.end),
    salesMetrics(who, `${y}-01-01`, `${y}-12-31`),
  ]);

  const tOwner = inIds('employee_id', ids);
  const tMonth = await queryOne(
    `SELECT COALESCE(SUM(target_value),0) AS v, COALESCE(MAX(incentive_pct),0) AS inc FROM targets
      WHERE scope = 'Employee' AND period_start <= ? AND period_end >= ? AND period_type = 'Monthly' ${tOwner.sql}`,
    [cur.end, cur.start, ...tOwner.params]
  );
  let tYear = await queryOne(
    `SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE period_type = 'Annual' AND period_start <= ? AND period_end >= ?
       AND ${ids === null ? "scope = 'Company'" : `scope = 'Employee' ${tOwner.sql}`}`,
    [`${y}-12-31`, `${y}-01-01`, ...(ids === null ? [] : tOwner.params)]
  );
  if (!num(tYear.v)) {
    tYear = await queryOne(
      `SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Employee' AND period_start >= ? AND period_end <= ? ${tOwner.sql}`,
      [`${y}-01-01`, `${y}-12-31`, ...tOwner.params]
    );
  }

  const o = inIds('o.owner_id', ids);
  const l = inIds('l.owner_id', ids);
  const p = inIds('p.owner_id', ids);

  const trend = [];
  for (const m of lastMonths(6)) {
    const [w, pr] = await Promise.all([
      queryOne(`SELECT COALESCE(SUM(o.expected_value),0) AS v FROM opportunities o WHERE o.won_at BETWEEN ? AND ? ${o.sql}`, [m.start, m.endTs, ...o.params]),
      queryOne(`SELECT COALESCE(SUM(p.total_amount),0) AS v FROM proposals p WHERE p.sent_date BETWEEN ? AND ? ${p.sql}`, [m.start, m.end, ...p.params]),
    ]);
    trend.push({ label: m.label, won: num(w.v), proposals: num(pr.v) });
  }

  const [funnel, followups, closing, recentLeads, followToday] = await Promise.all([
    query(
      `SELECT f.id, f.name, f.color, f.stage_type, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value
         FROM funnel_statuses f LEFT JOIN opportunities o ON o.funnel_status_id = f.id ${o.sql}
        WHERE f.status = 1 GROUP BY f.id ORDER BY f.sort_order`,
      o.params
    ),
    query(
      `SELECT * FROM (
         SELECT 'lead' AS type, l.id, l.lead_code AS code, COALESCE(l.company_name, l.contact_name) AS name, l.next_action, l.next_follow_up AS due, l.phone
           FROM leads l WHERE l.is_converted = 0 AND l.next_follow_up IS NOT NULL AND DATE(l.next_follow_up) <= CURDATE() ${l.sql}
         UNION ALL
         SELECT 'opportunity', o.id, o.opp_code, o.title, o.next_action, o.next_follow_up, NULL
           FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id
          WHERE f.stage_type IN ('open','hold') AND o.next_follow_up IS NOT NULL AND DATE(o.next_follow_up) <= CURDATE() ${o.sql}
       ) x ORDER BY due LIMIT 8`,
      [...l.params, ...o.params]
    ),
    query(
      `SELECT o.id, o.opp_code, o.title, o.expected_value, o.expected_close_date, c.name AS company_name, f.name AS stage_name, f.color AS stage_color,
              COALESCE(o.probability, f.probability, 0) AS probability, e.full_name AS owner_name
         FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id LEFT JOIN companies c ON c.id = o.company_id
         LEFT JOIN employees e ON e.id = o.owner_id
        WHERE f.stage_type = 'open' AND o.expected_close_date BETWEEN ? AND ? ${o.sql}
        ORDER BY o.expected_value DESC LIMIT 6`,
      [cur.start, cur.end, ...o.params]
    ),
    query(
      `SELECT l.id, l.lead_code, COALESCE(l.company_name, l.contact_name) AS name, l.expected_budget, l.created_at, s.name AS status_name, s.color AS status_color, e.full_name AS owner_name
         FROM leads l LEFT JOIN lead_statuses s ON s.id = l.lead_status_id LEFT JOIN employees e ON e.id = l.owner_id
        WHERE l.is_converted = 0 ${l.sql} ORDER BY l.id DESC LIMIT 6`,
      l.params
    ),
    queryOne(
      `SELECT (SELECT COUNT(*) FROM leads l WHERE l.is_converted = 0 AND DATE(l.next_follow_up) = CURDATE() ${l.sql})
            + (SELECT COUNT(*) FROM opportunities o WHERE DATE(o.next_follow_up) = CURDATE() ${o.sql}) AS n`,
      [...l.params, ...o.params]
    ),
  ]);

  let team = [];
  if (ids === null || ids.length > 1) {
    const e = inIds('e.id', ids);
    team = await query(
      `SELECT e.id, e.full_name, r.name AS role_name,
         (SELECT COALESCE(SUM(expected_value),0) FROM opportunities WHERE owner_id = e.id AND won_at BETWEEN ? AND ?) AS won,
         (SELECT COALESCE(SUM(o.expected_value * COALESCE(o.probability, f.probability, 0) / 100),0)
            FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id WHERE o.owner_id = e.id AND f.stage_type = 'open') AS pipeline,
         (SELECT COUNT(*) FROM activities a WHERE a.owner_id = e.id AND a.activity_date BETWEEN ? AND ?) AS activities
         FROM employees e JOIN departments d ON d.id = e.department_id LEFT JOIN roles r ON r.id = e.role_id
        WHERE d.code = 'BD' AND e.active_status = 1 ${e.sql} ORDER BY won DESC, pipeline DESC LIMIT 6`,
      [cur.start, cur.endTs, cur.start, cur.endTs, ...e.params]
    );
  }

  const monthTarget = num(tMonth.v);
  return {
    type: 'sales',
    title: 'Sales Dashboard',
    kpis: {
      won: mCur.won_value,
      won_change: change(mCur.won_value, mPrev.won_value),
      pipeline_weighted: mCur.pipeline_weighted,
      pipeline_unweighted: mCur.pipeline_unweighted,
      followups_today: num(followToday.n),
      overdue_followups: mCur.overdue_followups,
      month_target: monthTarget,
      achievement_pct: monthTarget ? Math.round((mCur.won_value / monthTarget) * 1000) / 10 : null,
    },
    activity: { calls: mCur.calls, meetings: mCur.meetings, proposals: mCur.proposals_sent, qualified_leads: mCur.qualified_leads, win_rate: mCur.win_rate },
    target: {
      year: y,
      target: num(tYear.v),
      achieved: mYear.won_value,
      remaining: Math.max(num(tYear.v) - mYear.won_value, 0),
      incentive: Math.round((mYear.won_value * num(tMonth.inc)) / 100),
    },
    trend,
    funnel,
    followups,
    closing,
    recent_leads: recentLeads,
    team,
  };
};
