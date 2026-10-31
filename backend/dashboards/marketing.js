/** Marketing dashboard: leads generated, qualification, spend, CPL, campaigns, sources. */
const { query, queryOne } = require('../config/db');
const { num } = require('../utils/helpers');
const { inIds, monthRange, lastMonths, change } = require('./helpers');

module.exports = async function marketing(ids) {
  const cur = monthRange(0);
  const prev = monthRange(-1);
  const y = new Date().getFullYear();
  const l = inIds('l.created_by', ids);
  const c = inIds('c.owner_id', ids);

  const count = (from, to, extra = '') =>
    queryOne(`SELECT COUNT(*) AS n FROM leads l WHERE l.created_at BETWEEN ? AND ? ${extra} ${l.sql}`, [from, to, ...l.params]);

  const [lc, lp, qc, spend, ytdLeads, active] = await Promise.all([
    count(cur.start, cur.endTs),
    count(prev.start, prev.endTs),
    count(cur.start, cur.endTs, "AND l.qualification = 'Qualified'"),
    queryOne(`SELECT COALESCE(SUM(c.actual_spend),0) AS v, COALESCE(SUM(c.budget),0) AS b FROM campaigns c WHERE YEAR(COALESCE(c.start_date, c.created_at)) = ? ${c.sql}`, [y, ...c.params]),
    queryOne(`SELECT COUNT(*) AS n FROM leads l WHERE l.campaign_id IS NOT NULL AND YEAR(l.created_at) = ? ${l.sql}`, [y, ...l.params]),
    queryOne(`SELECT COUNT(*) AS n FROM campaigns c WHERE c.status = 'Active' ${c.sql}`, c.params),
  ]);

  const trend = [];
  for (const m of lastMonths(6)) {
    const r = await queryOne(
      `SELECT COUNT(*) AS leads, COALESCE(SUM(l.qualification = 'Qualified'),0) AS qualified FROM leads l WHERE l.created_at BETWEEN ? AND ? ${l.sql}`,
      [m.start, m.endTs, ...l.params]
    );
    trend.push({ label: m.label, leads: num(r.leads), qualified: num(r.qualified) });
  }

  const [bySource, campaigns, recentLeads] = await Promise.all([
    query(
      `SELECT COALESCE(s.name, 'Not set') AS name, COUNT(l.id) AS value FROM leads l LEFT JOIN lead_sources s ON s.id = l.lead_source_id
        WHERE YEAR(l.created_at) = ? ${l.sql} GROUP BY s.name ORDER BY value DESC LIMIT 8`,
      [y, ...l.params]
    ),
    query(
      `SELECT c.id, c.campaign_code, c.name, c.status, c.actual_spend, c.budget, ch.name AS channel_name,
              (SELECT COUNT(*) FROM leads x WHERE x.campaign_id = c.id) AS leads,
              (SELECT COUNT(*) FROM leads x WHERE x.campaign_id = c.id AND x.qualification = 'Qualified') AS qualified,
              (SELECT COALESCE(SUM(o.expected_value),0) FROM opportunities o WHERE o.campaign_id = c.id AND o.won_at IS NOT NULL) AS won_revenue
         FROM campaigns c LEFT JOIN marketing_channels ch ON ch.id = c.channel_id
        WHERE c.status IN ('Active','Planned','Paused') ${c.sql} ORDER BY c.status = 'Active' DESC, c.id DESC LIMIT 6`,
      c.params
    ),
    query(
      `SELECT l.id, l.lead_code, COALESCE(l.company_name, l.contact_name) AS name, l.created_at, s.name AS source_name,
              e.full_name AS owner_name, st.name AS status_name, st.color AS status_color, l.qualification
         FROM leads l LEFT JOIN lead_sources s ON s.id = l.lead_source_id LEFT JOIN employees e ON e.id = l.owner_id
         LEFT JOIN lead_statuses st ON st.id = l.lead_status_id
        WHERE 1=1 ${l.sql} ORDER BY l.id DESC LIMIT 6`,
      l.params
    ),
  ]);

  return {
    type: 'marketing',
    title: 'Marketing Dashboard',
    kpis: {
      leads: num(lc.n),
      leads_change: change(lc.n, lp.n),
      qualified: num(qc.n),
      qualified_pct: num(lc.n) ? Math.round((num(qc.n) / num(lc.n)) * 1000) / 10 : 0,
      spend: num(spend.v),
      budget: num(spend.b),
      cpl: num(ytdLeads.n) ? Math.round(num(spend.v) / num(ytdLeads.n)) : null,
      active_campaigns: num(active.n),
    },
    trend,
    by_source: bySource,
    campaigns: campaigns.map((x) => ({ ...x, cpl: num(x.leads) ? Math.round(num(x.actual_spend) / num(x.leads)) : null })),
    recent_leads: recentLeads,
  };
};
