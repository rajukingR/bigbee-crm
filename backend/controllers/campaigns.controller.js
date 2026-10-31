const { query } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, num } = require('../utils/helpers');

const METRICS = `
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = t.id) AS leads,
  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = t.id AND l.qualification = 'Qualified') AS qualified_leads,
  (SELECT COUNT(*) FROM opportunities o WHERE o.campaign_id = t.id) AS opportunities,
  (SELECT COALESCE(SUM(pr.total_amount),0) FROM proposals pr JOIN opportunities o ON o.id = pr.opportunity_id
     WHERE o.campaign_id = t.id AND pr.is_latest = 1) AS proposal_value,
  (SELECT COUNT(*) FROM opportunities o WHERE o.campaign_id = t.id AND o.won_at IS NOT NULL) AS wins,
  (SELECT COALESCE(SUM(o.expected_value),0) FROM opportunities o WHERE o.campaign_id = t.id AND o.won_at IS NOT NULL) AS won_revenue`;

function withRoi(r) {
  const spend = num(r.actual_spend);
  const leads = num(r.leads);
  const wins = num(r.wins);
  const rev = num(r.won_revenue);
  return {
    ...r,
    cost_per_lead: leads ? Math.round(spend / leads) : null,
    cost_per_qualified_lead: num(r.qualified_leads) ? Math.round(spend / num(r.qualified_leads)) : null,
    cost_per_acquisition: wins ? Math.round(spend / wins) : null,
    lead_to_opp_pct: leads ? Math.round((num(r.opportunities) / leads) * 1000) / 10 : 0,
    win_rate_pct: num(r.opportunities) ? Math.round((wins / num(r.opportunities)) * 1000) / 10 : 0,
    // ROI only shown when an attribution method is defined
    roas: r.attribution_method && spend ? Math.round((rev / spend) * 100) / 100 : null,
    roi_pct: r.attribution_method && spend ? Math.round(((rev - spend) / spend) * 1000) / 10 : null,
    budget_utilisation_pct: num(r.budget) ? Math.round((spend / num(r.budget)) * 1000) / 10 : null,
  };
}

const ctrl = crudController({
  table: 'campaigns',
  module: 'campaigns',
  select: `t.*, ct.name AS campaign_type_name, ch.name AS channel_name, ad.name AS advertising_type_name, o.full_name AS owner_name, ${METRICS}`,
  joins: `LEFT JOIN campaign_types ct ON ct.id = t.campaign_type_id LEFT JOIN marketing_channels ch ON ch.id = t.channel_id
          LEFT JOIN advertising_types ad ON ad.id = t.advertising_type_id LEFT JOIN employees o ON o.id = t.owner_id`,
  fields: ['name', 'campaign_type_id', 'channel_id', 'advertising_type_id', 'objective', 'target_audience', 'start_date', 'end_date', 'budget', 'actual_spend', 'impressions', 'clicks', 'attribution_method', 'status', 'owner_id', 'notes'],
  trackCreator: true,
  required: ['name'],
  searchFields: ['t.name', 't.campaign_code', 'ch.name'],
  filters: { status: 't.status', channel_id: 't.channel_id', campaign_type_id: 't.campaign_type_id', owner_id: 't.owner_id' },
  dateField: 't.start_date',
  codeField: 'campaign_code',
  codePrefix: 'CMPN',
  transformRow: withRoi,
  beforeSave: async (data, req, existing) => {
    if (!existing && !data.owner_id) data.owner_id = req.user.id;
    return data;
  },
});

/** ROI summary by channel. */
ctrl.roiByChannel = asyncHandler(async (req, res) => {
  const params = [];
  let where = ' WHERE 1=1';
  if (req.query.from) { where += ' AND t.start_date >= ?'; params.push(req.query.from); }
  if (req.query.to) { where += ' AND t.start_date <= ?'; params.push(req.query.to); }
  const rows = await query(`SELECT t.*, ch.name AS channel_name, ${METRICS} FROM campaigns t LEFT JOIN marketing_channels ch ON ch.id = t.channel_id ${where}`, params);
  const by = {};
  rows.forEach((r) => {
    const k = r.channel_name || 'Unassigned';
    if (!by[k]) by[k] = { channel_name: k, campaigns: 0, budget: 0, actual_spend: 0, leads: 0, qualified_leads: 0, opportunities: 0, wins: 0, won_revenue: 0, proposal_value: 0, attribution_method: 'Last Touch' };
    by[k].campaigns += 1;
    ['budget', 'actual_spend', 'leads', 'qualified_leads', 'opportunities', 'wins', 'won_revenue', 'proposal_value'].forEach((f) => (by[k][f] += num(r[f])));
  });
  // Leads with a source but no campaign (organic / referral etc.)
  const bySource = await query(
    `SELECT s.name AS source_name, COUNT(l.id) AS leads, SUM(l.qualification = 'Qualified') AS qualified_leads,
            SUM(l.is_converted) AS opportunities,
            COALESCE(SUM((SELECT o.expected_value FROM opportunities o WHERE o.id = l.opportunity_id AND o.won_at IS NOT NULL)),0) AS won_revenue
       FROM leads l LEFT JOIN lead_sources s ON s.id = l.lead_source_id GROUP BY s.name ORDER BY leads DESC`
  );
  res.json({ channels: Object.values(by).map(withRoi), sources: bySource });
});

module.exports = ctrl;
