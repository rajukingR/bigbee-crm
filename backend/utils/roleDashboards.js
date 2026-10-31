/**
 * Role-specific dashboards. Each function receives the request and the
 * visible employee ids (null = all data, e.g. Admin / MD / Finance) and
 * returns only what that role needs to act on today.
 */
const { query, queryOne } = require('../config/db');
const { num } = require('./helpers');
const { salesMetrics } = require('./metrics');
const { projectFinancials } = require('./finance');
const { getNumber, getSetting } = require('./settings');

const today = () => new Date().toISOString().slice(0, 10);
const monthStart = () => `${today().slice(0, 7)}-01`;
const monthEnd = () => {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 0)).toISOString().slice(0, 10);
};
const yearStart = () => `${new Date().getFullYear()}-01-01`;
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

/** " AND col IN (...)" for the visible ids (empty when everything is visible). */
function inIds(cols, ids) {
  if (!ids) return { sql: '', params: [] };
  if (!ids.length) return { sql: ' AND 1=0', params: [] };
  const list = Array.isArray(cols) ? cols : [cols];
  const ph = ids.map(() => '?').join(',');
  return { sql: ` AND (${list.map((c) => `${c} IN (${ph})`).join(' OR ')})`, params: list.flatMap(() => ids) };
}

async function targetFor(ids, from, to) {
  if (!ids) {
    const c = await queryOne("SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Company' AND period_start <= ? AND period_end >= ?", [to, from]);
    if (num(c.v)) return num(c.v);
    const e = await queryOne("SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Employee' AND period_start >= ? AND period_end <= ?", [from, to]);
    return num(e.v);
  }
  const s = inIds('employee_id', ids);
  const r = await queryOne(`SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Employee' AND period_start >= ? AND period_end <= ? ${s.sql}`, [from, to, ...s.params]);
  return num(r.v);
}

async function myTasks(userId, limit = 8) {
  return query(
    `SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.project_code,
            CASE WHEN t.due_date < NOW() THEN 1 ELSE 0 END AS is_overdue
       FROM tasks t LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.owner_id = ? AND t.status NOT IN ('Completed','Cancelled')
      ORDER BY t.due_date IS NULL, t.due_date LIMIT ?`,
    [userId, limit]
  );
}

async function taskCounts(ids) {
  const s = inIds('owner_id', ids);
  return queryOne(
    `SELECT COUNT(*) AS open_tasks, COALESCE(SUM(due_date < NOW()),0) AS overdue,
            COALESCE(SUM(due_date BETWEEN NOW() AND DATE_ADD(NOW(), INTERVAL 7 DAY)),0) AS due_week
       FROM tasks WHERE status NOT IN ('Completed','Cancelled') ${s.sql}`,
    s.params
  );
}

// ------------------------------------------------------------------ BD
async function bd(req, ids) {
  const who = ids ? { employeeIds: ids } : {};
  const [month, year] = await Promise.all([salesMetrics(who, monthStart(), monthEnd()), salesMetrics(who, yearStart(), yearEnd())]);
  const [monthTarget, yearTarget] = await Promise.all([targetFor(ids, monthStart(), monthEnd()), targetFor(ids, yearStart(), yearEnd())]);
  const coverage = await getNumber('pipeline_coverage_multiple', 5);
  const o = inIds('o.owner_id', ids);
  const l = inIds('l.owner_id', ids);

  const funnel = await query(
    `SELECT f.id, f.name, f.color, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value
       FROM funnel_statuses f LEFT JOIN opportunities o ON o.funnel_status_id = f.id ${o.sql}
      WHERE f.status = 1 AND f.stage_type = 'open' GROUP BY f.id ORDER BY f.sort_order`,
    o.params
  );
  const closing = await query(
    `SELECT o.id, o.opp_code, o.title, o.expected_value, o.expected_close_date, c.name AS company_name, f.name AS stage_name, f.color AS stage_color, e.full_name AS owner_name
       FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id LEFT JOIN companies c ON c.id = o.company_id
       LEFT JOIN employees e ON e.id = o.owner_id
      WHERE f.stage_type = 'open' AND o.expected_close_date BETWEEN ? AND ? ${o.sql}
      ORDER BY o.expected_value DESC LIMIT 6`,
    [monthStart(), monthEnd(), ...o.params]
  );
  const followups = await query(
    `SELECT * FROM (
       SELECT 'lead' AS type, l.id, l.lead_code AS code, COALESCE(l.company_name, l.contact_name) AS name, l.next_action, l.next_follow_up AS due, l.phone
         FROM leads l WHERE l.is_converted = 0 AND l.next_follow_up IS NOT NULL AND DATE(l.next_follow_up) <= CURDATE() ${l.sql}
       UNION ALL
       SELECT 'opportunity', o.id, o.opp_code, o.title, o.next_action, o.next_follow_up, NULL
         FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id
        WHERE f.stage_type IN ('open','hold') AND o.next_follow_up IS NOT NULL AND DATE(o.next_follow_up) <= CURDATE() ${o.sql}
     ) x ORDER BY due LIMIT 8`,
    [...l.params, ...o.params]
  );
  const openLeads = await queryOne(
    `SELECT COUNT(*) AS n, COALESCE(SUM(l.created_at >= ?),0) AS new_month FROM leads l WHERE l.is_converted = 0 AND l.qualification <> 'Disqualified' ${l.sql}`,
    [monthStart(), ...l.params]
  );
  const recentLeads = await query(
    `SELECT l.id, l.lead_code, COALESCE(l.company_name, l.contact_name) AS name, src.name AS source_name, s.name AS status_name, s.color AS status_color, l.created_at
       FROM leads l LEFT JOIN lead_statuses s ON s.id = l.lead_status_id LEFT JOIN lead_sources src ON src.id = l.lead_source_id
      WHERE l.is_converted = 0 ${l.sql} ORDER BY l.id DESC LIMIT 6`,
    l.params
  );

  // Team leaderboard for managers / heads / admin
  let team = [];
  if (!ids || ids.length > 1) {
    const people = ids
      ? await query(`SELECT e.id, e.full_name, r.name AS role_name FROM employees e LEFT JOIN roles r ON r.id = e.role_id WHERE e.active_status = 1 ${inIds('e.id', ids).sql}`, inIds('e.id', ids).params)
      : await query("SELECT e.id, e.full_name, r.name AS role_name FROM employees e JOIN departments d ON d.id = e.department_id LEFT JOIN roles r ON r.id = e.role_id WHERE d.code = 'BD' AND e.active_status = 1");
    for (const p of people) {
      const m = await salesMetrics({ employeeIds: [p.id] }, monthStart(), monthEnd());
      team.push({ id: p.id, name: p.full_name, role: p.role_name, won: m.won_value, pipeline: m.pipeline_weighted, meetings: m.meetings, overdue: m.overdue_followups });
    }
    team = team.sort((a, b) => b.won - a.won || b.pipeline - a.pipeline).slice(0, 8);
  }

  const gap = Math.max(yearTarget - year.won_value, 0);
  return {
    type: 'bd',
    kpis: {
      won_month: month.won_value,
      month_target: monthTarget,
      pipeline_weighted: month.pipeline_weighted,
      pipeline_unweighted: month.pipeline_unweighted,
      open_leads: num(openLeads.n),
      new_leads_month: num(openLeads.new_month),
      overdue_followups: month.overdue_followups,
      followups_due: followups.length,
    },
    target: {
      year_target: yearTarget, year_won: year.won_value, month_target: monthTarget, month_won: month.won_value,
      gap, coverage_required: coverage, coverage_actual: gap ? Math.round((year.pipeline_weighted / gap) * 10) / 10 : null,
      forecast: year.forecast, win_rate: year.win_rate,
    },
    activity: { calls: month.calls, meetings: month.meetings, emails: month.emails, proposals: month.proposals_sent, qualified: month.qualified_leads },
    funnel,
    closing,
    followups,
    recent_leads: recentLeads,
    team,
  };
}

// ------------------------------------------------------------------ Marketing
async function marketing(req, ids) {
  const c = inIds(['c.owner_id', 'c.created_by'], ids);
  const lc = inIds(['l.created_by', 'l.owner_id'], ids);
  const [spend, leads, bySource, campaigns, recent] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(c.actual_spend),0) AS spend, COALESCE(SUM(c.budget),0) AS budget, COUNT(*) AS n,
                     COALESCE(SUM(c.status = 'Active'),0) AS active
                FROM campaigns c WHERE (c.end_date IS NULL OR c.end_date >= ?) ${c.sql}`, [yearStart(), ...c.params]),
    queryOne(`SELECT COUNT(*) AS total, COALESCE(SUM(l.qualification = 'Qualified'),0) AS qualified, COALESCE(SUM(l.is_converted),0) AS converted,
                     COALESCE(SUM(l.owner_id IS NULL),0) AS unassigned
                FROM leads l WHERE l.created_at BETWEEN ? AND ? ${lc.sql}`, [monthStart(), `${monthEnd()} 23:59:59`, ...lc.params]),
    query(`SELECT COALESCE(s.name,'Not set') AS label, COUNT(l.id) AS value FROM leads l LEFT JOIN lead_sources s ON s.id = l.lead_source_id
            WHERE l.created_at >= ? ${lc.sql} GROUP BY s.name ORDER BY value DESC LIMIT 8`, [yearStart(), ...lc.params]),
    query(`SELECT c.id, c.campaign_code, c.name, c.status, c.budget, c.actual_spend, ch.name AS channel_name,
                  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id) AS leads,
                  (SELECT COUNT(*) FROM leads l WHERE l.campaign_id = c.id AND l.qualification = 'Qualified') AS qualified,
                  (SELECT COALESCE(SUM(o.expected_value),0) FROM opportunities o WHERE o.campaign_id = c.id AND o.won_at IS NOT NULL) AS won_revenue
             FROM campaigns c LEFT JOIN marketing_channels ch ON ch.id = c.channel_id
            WHERE c.status IN ('Active','Planned') ${c.sql} ORDER BY c.start_date DESC LIMIT 6`, c.params),
    query(`SELECT l.id, l.lead_code, COALESCE(l.company_name, l.contact_name) AS name, src.name AS source_name, e.full_name AS owner_name, s.name AS status_name, s.color AS status_color
             FROM leads l LEFT JOIN lead_sources src ON src.id = l.lead_source_id LEFT JOIN employees e ON e.id = l.owner_id
             LEFT JOIN lead_statuses s ON s.id = l.lead_status_id
            WHERE 1=1 ${lc.sql} ORDER BY l.id DESC LIMIT 6`, lc.params),
  ]);
  const total = num(leads.total);
  return {
    type: 'marketing',
    kpis: {
      spend: num(spend.spend), budget: num(spend.budget), active_campaigns: num(spend.active),
      leads_month: total, qualified_month: num(leads.qualified), converted_month: num(leads.converted),
      cpl: total ? Math.round(num(spend.spend) / Math.max(total, 1)) : null,
    },
    by_source: bySource,
    campaigns: campaigns.map((x) => ({ ...x, cpl: num(x.leads) ? Math.round(num(x.actual_spend) / num(x.leads)) : null })),
    recent_leads: recent,
  };
}

// ------------------------------------------------------------------ Client Servicing
async function cs(req, ids) {
  const p = inIds(['p.cs_owner_id', 'p.manager_id'], ids);
  const [counts, events, handovers, approvals, proposals, rating] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(p.status IN ('Planning','In Progress','Event Live','Handover Pending')),0) AS active,
                     COALESCE(SUM(p.status = 'Handover Pending'),0) AS handover_pending
                FROM projects p WHERE 1=1 ${p.sql}`, p.params),
    query(`SELECT p.id, p.project_code, p.name, c.name AS company_name, p.event_start, p.status, p.progress, p.health
             FROM projects p LEFT JOIN companies c ON c.id = p.company_id
            WHERE p.event_start BETWEEN CURDATE() AND DATE_ADD(CURDATE(), INTERVAL 45 DAY) AND p.status NOT IN ('Cancelled','Closed') ${p.sql}
            ORDER BY p.event_start LIMIT 6`, p.params),
    query(`SELECT p.id, p.project_code, p.name, h.status, h.submitted_at, e.full_name AS from_name
             FROM project_handovers h JOIN projects p ON p.id = h.project_id LEFT JOIN employees e ON e.id = h.handed_over_by
            WHERE h.status IN ('Submitted','Clarification Requested','Draft') ${ids ? inIds(['h.received_by', 'p.cs_owner_id', 'p.manager_id'], ids).sql : ''}
            ORDER BY FIELD(h.status,'Submitted','Clarification Requested','Draft'), h.id DESC LIMIT 6`,
      ids ? inIds(['h.received_by', 'p.cs_owner_id', 'p.manager_id'], ids).params : []),
    query(`SELECT m.id, m.title, m.planned_date, p.id AS project_id, p.project_code,
                  CASE WHEN m.planned_date < CURDATE() THEN 1 ELSE 0 END AS is_overdue
             FROM milestones m JOIN projects p ON p.id = m.project_id
            WHERE m.milestone_type = 'Client Approval' AND m.status NOT IN ('Completed','Cancelled') ${p.sql}
            ORDER BY m.planned_date LIMIT 6`, p.params),
    query(`SELECT pr.id, pr.proposal_code, pr.version, pr.title, pr.status, pr.total_amount, c.name AS company_name, pr.next_follow_up
             FROM proposals pr LEFT JOIN companies c ON c.id = pr.company_id
            WHERE pr.is_latest = 1 AND pr.status IN ('Draft','Pending Approval','Approved','Sent','Rejected') ${inIds(['pr.owner_id', 'pr.created_by'], ids).sql}
            ORDER BY pr.updated_at DESC LIMIT 6`, inIds(['pr.owner_id', 'pr.created_by'], ids).params),
    queryOne(`SELECT ROUND(AVG(f.rating_overall),1) AS avg, COUNT(*) AS n FROM feedback f JOIN projects p ON p.id = f.project_id WHERE f.feedback_date >= ? ${p.sql}`, [yearStart(), ...p.params]),
  ]);
  const esc = await queryOne(
    `SELECT COUNT(*) AS n FROM escalations x LEFT JOIN projects p ON p.id = x.project_id
      WHERE x.status IN ('Open','In Progress') ${ids ? inIds(['x.raised_by', 'x.escalated_to', 'p.cs_owner_id'], ids).sql : ''}`,
    ids ? inIds(['x.raised_by', 'x.escalated_to', 'p.cs_owner_id'], ids).params : []
  );
  return {
    type: 'cs',
    kpis: {
      active_projects: num(counts.active),
      handover_pending: handovers.filter((h) => h.status !== 'Draft').length,
      client_approvals: approvals.length,
      open_escalations: num(esc.n),
      satisfaction: rating.avg,
      feedback_count: num(rating.n),
    },
    events,
    handovers,
    approvals,
    proposals,
    tasks: await myTasks(req.user.id),
  };
}

// ------------------------------------------------------------------ Operations & Production
async function operations(req, ids) {
  const p = inIds(['p.ops_owner_id', 'p.manager_id'], ids);
  const x = inIds(['x.owner_id', 'p.ops_owner_id'], ids);
  const [events, overdueItems, deliveries, incidents] = await Promise.all([
    query(`SELECT p.id, p.project_code, p.name, p.event_start, p.location, p.status, p.health,
                  COUNT(x.id) AS total_items, COALESCE(SUM(x.status IN ('Ready','Done')),0) AS ready_items,
                  COALESCE(SUM(x.status = 'Issue'),0) AS issues
             FROM projects p LEFT JOIN execution_items x ON x.project_id = p.id
            WHERE p.status IN ('Planning','In Progress','Event Live') ${p.sql}
            GROUP BY p.id ORDER BY p.event_start IS NULL, p.event_start LIMIT 8`, p.params),
    query(`SELECT x.id, x.item, x.category, x.due_date, x.status, p.id AS project_id, p.project_code, e.full_name AS owner_name
             FROM execution_items x JOIN projects p ON p.id = x.project_id LEFT JOIN employees e ON e.id = x.owner_id
            WHERE x.status NOT IN ('Ready','Done') AND (x.due_date < NOW() OR x.status = 'Issue') ${x.sql}
            ORDER BY x.due_date LIMIT 8`, x.params),
    query(`SELECT po.id, po.po_code, po.delivery_date, po.delivery_status, v.name AS vendor_name, p.project_code,
                  CASE WHEN po.delivery_date < CURDATE() THEN 1 ELSE 0 END AS is_overdue
             FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id LEFT JOIN projects p ON p.id = po.project_id
            WHERE po.status IN ('Approved','Issued') AND po.delivery_status <> 'Delivered' ${p.sql}
            ORDER BY po.delivery_date IS NULL, po.delivery_date LIMIT 6`, p.params),
    queryOne(`SELECT COUNT(*) AS n FROM incidents i JOIN projects p ON p.id = i.project_id WHERE i.occurred_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) ${p.sql}`, p.params),
  ]);
  const withReadiness = events.map((e) => ({ ...e, readiness: num(e.total_items) ? Math.round((num(e.ready_items) / num(e.total_items)) * 100) : 0 }));
  const upcoming = withReadiness.filter((e) => e.event_start && e.event_start >= today());
  const t = await taskCounts(ids);
  return {
    type: 'operations',
    kpis: {
      live_projects: events.length,
      avg_readiness: withReadiness.length ? Math.round(withReadiness.reduce((a, e) => a + e.readiness, 0) / withReadiness.length) : 0,
      overdue_items: overdueItems.length,
      pending_deliveries: deliveries.length,
      incidents_30d: num(incidents.n),
      open_tasks: num(t.open_tasks),
      overdue_tasks: num(t.overdue),
    },
    events: withReadiness,
    next_event: upcoming[0] || null,
    overdue_items: overdueItems,
    deliveries,
    tasks: await myTasks(req.user.id),
  };
}

// ------------------------------------------------------------------ Procurement
async function procurement(req) {
  const [quotes, poCounts, deliveries, payables, recentQuotes] = await Promise.all([
    query(`SELECT q.requirement, q.project_id, p.project_code, COUNT(*) AS quotes, MIN(COALESCE(NULLIF(q.negotiated_amount,0), q.quoted_amount)) AS lowest
             FROM vendor_quotations q LEFT JOIN projects p ON p.id = q.project_id
            GROUP BY q.requirement, q.project_id HAVING SUM(q.is_selected) = 0 ORDER BY MAX(q.id) DESC LIMIT 6`),
    queryOne(`SELECT COALESCE(SUM(status = 'Pending Approval'),0) AS pending, COALESCE(SUM(status = 'Approved'),0) AS to_issue,
                     COALESCE(SUM(CASE WHEN status IN ('Approved','Issued','Delivered') AND po_date >= ? THEN amount ELSE 0 END),0) AS committed_month
                FROM purchase_orders`, [monthStart()]),
    query(`SELECT po.id, po.po_code, po.status, po.delivery_date, po.total_amount, v.name AS vendor_name, p.project_code,
                  CASE WHEN po.delivery_date < CURDATE() THEN 1 ELSE 0 END AS is_overdue
             FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id LEFT JOIN projects p ON p.id = po.project_id
            WHERE po.status IN ('Approved','Issued','Pending Approval') AND po.delivery_status <> 'Delivered'
            ORDER BY po.delivery_date IS NULL, po.delivery_date LIMIT 8`),
    query(`SELECT v.id, v.name, COALESCE(SUM(b.total_amount - b.paid_amount),0) AS outstanding
             FROM vendors v JOIN vendor_bills b ON b.vendor_id = v.id GROUP BY v.id HAVING outstanding > 0 ORDER BY outstanding DESC LIMIT 6`),
    query(`SELECT q.id, q.quote_code, q.requirement, q.status, COALESCE(NULLIF(q.negotiated_amount,0), q.quoted_amount) AS amount, v.name AS vendor_name
             FROM vendor_quotations q LEFT JOIN vendors v ON v.id = q.vendor_id ORDER BY q.id DESC LIMIT 6`),
  ]);
  const vendors = await queryOne("SELECT COUNT(*) AS n FROM vendors WHERE status = 'Active'");
  return {
    type: 'procurement',
    kpis: {
      awaiting_selection: quotes.length,
      po_pending_approval: num(poCounts.pending),
      po_to_issue: num(poCounts.to_issue),
      committed_month: num(poCounts.committed_month),
      active_vendors: num(vendors.n),
    },
    comparisons: quotes,
    deliveries,
    payables,
    recent_quotes: recentQuotes,
  };
}

// ------------------------------------------------------------------ Creative
async function creative(req, ids) {
  const s = inIds('t.owner_id', ids);
  const [counts, tasks, projects, done] = await Promise.all([
    taskCounts(ids),
    query(`SELECT t.id, t.title, t.status, t.priority, t.due_date, t.project_id, p.project_code, p.name AS project_name, e.full_name AS owner_name,
                  CASE WHEN t.due_date < NOW() THEN 1 ELSE 0 END AS is_overdue,
                  (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS revisions
             FROM tasks t LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN employees e ON e.id = t.owner_id
            WHERE t.status NOT IN ('Completed','Cancelled') ${s.sql}
            ORDER BY t.due_date IS NULL, t.due_date LIMIT 10`, s.params),
    query(`SELECT DISTINCT p.id, p.project_code, p.name, p.event_start, p.status
             FROM projects p JOIN tasks t ON t.project_id = p.id
            WHERE p.status NOT IN ('Closed','Cancelled','Completed') ${s.sql}
            ORDER BY p.event_start LIMIT 6`, s.params),
    queryOne(`SELECT COUNT(*) AS n, COALESCE(SUM(t.completed_at <= t.due_date),0) AS on_time
                FROM tasks t WHERE t.status = 'Completed' AND t.completed_at >= ? ${s.sql}`, [monthStart(), ...s.params]),
  ]);
  return {
    type: 'creative',
    kpis: {
      open_briefs: num(counts.open_tasks),
      due_week: num(counts.due_week),
      overdue: num(counts.overdue),
      delivered_month: num(done.n),
      on_time_pct: num(done.n) ? Math.round((num(done.on_time) / num(done.n)) * 100) : null,
    },
    tasks,
    projects,
  };
}

// ------------------------------------------------------------------ Finance
async function finance(req) {
  const [month, recv, payables, invoicesDue, approvals] = await Promise.all([
    queryOne(`SELECT (SELECT COALESCE(SUM(amount),0) FROM invoices WHERE status <> 'Cancelled' AND invoice_date BETWEEN ? AND ?) AS invoiced,
                     (SELECT COALESCE(SUM(amount),0) FROM receipts WHERE receipt_date BETWEEN ? AND ?) AS collected,
                     (SELECT COALESCE(SUM(amount),0) FROM vendor_payments WHERE payment_date BETWEEN ? AND ?) AS paid_out`,
      [monthStart(), monthEnd(), monthStart(), monthEnd(), monthStart(), monthEnd()]),
    query(`SELECT due_date, total_amount - received_amount AS outstanding FROM invoices
            WHERE status NOT IN ('Paid','Cancelled','Draft') AND total_amount - received_amount > 0`),
    queryOne("SELECT COALESCE(SUM(total_amount - paid_amount),0) AS v, COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN total_amount - paid_amount ELSE 0 END),0) AS overdue FROM vendor_bills WHERE status <> 'Paid'"),
    query(`SELECT i.id, i.invoice_no, i.due_date, i.total_amount - i.received_amount AS outstanding, c.name AS company_name, p.project_code,
                  GREATEST(DATEDIFF(CURDATE(), i.due_date),0) AS days_overdue
             FROM invoices i LEFT JOIN companies c ON c.id = i.company_id LEFT JOIN projects p ON p.id = i.project_id
            WHERE i.status NOT IN ('Paid','Cancelled','Draft') AND i.total_amount - i.received_amount > 0
              AND (i.due_date <= DATE_ADD(CURDATE(), INTERVAL 7 DAY) OR i.next_follow_up <= CURDATE())
            ORDER BY i.due_date LIMIT 8`),
    query(`SELECT a.id, a.request_type, a.title, a.amount, a.created_at, r.full_name AS requested_by_name
             FROM approvals a LEFT JOIN employees r ON r.id = a.requested_by
            WHERE a.status = 'Pending' AND a.entity_type IN ('expense','purchase_order') AND (a.approver_id = ? OR ? = 1)
            ORDER BY a.id DESC LIMIT 6`, [req.user.id, req.user.is_super_admin || req.user.data_scope === 'all' ? 1 : 0]),
  ]);
  const bucketDef = (await getSetting('ageing_buckets', '0-30,31-60,61-90,90+')).split(',').map((b) => b.trim());
  const buckets = [{ label: 'Not due', value: 0 }, ...bucketDef.map((b) => ({ label: `${b} days`, key: b, value: 0 }))];
  const t = today();
  recv.forEach((r) => {
    const out = num(r.outstanding);
    if (!r.due_date || r.due_date >= t) return void (buckets[0].value += out);
    const days = Math.floor((new Date(t) - new Date(r.due_date)) / 86400000);
    const b = buckets.slice(1).find((x) => (x.key.endsWith('+') ? days >= parseInt(x.key, 10) : days >= Number(x.key.split('-')[0]) && days <= Number(x.key.split('-')[1])));
    (b || buckets[buckets.length - 1]).value += out;
  });
  const totalRecv = recv.reduce((a, r) => a + num(r.outstanding), 0);
  const margin = await getNumber('margin_threshold_pct', 20);
  const flagged = (await projectFinancials("AND p.status NOT IN ('Cancelled')", [], margin)).filter((p) => p.flags.length).slice(0, 6);
  return {
    type: 'finance',
    kpis: {
      invoiced_month: num(month.invoiced),
      collected_month: num(month.collected),
      receivable: totalRecv,
      receivable_overdue: totalRecv - buckets[0].value,
      payable: num(payables.v),
      payable_overdue: num(payables.overdue),
      paid_out_month: num(month.paid_out),
    },
    ageing: buckets.map(({ label, value }) => ({ label, value })),
    invoices_due: invoicesDue,
    approvals,
    flagged_projects: flagged.map((p) => ({ id: p.id, project_code: p.project_code, name: p.name, flags: p.flags, actual_margin_pct: p.actual_margin_pct, budget_variance: p.budget_variance })),
  };
}

// ------------------------------------------------------------------ HR & Admin
async function hr() {
  const [counts, byDept, joiners, noManager] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(active_status = 1),0) AS active, COALESCE(SUM(active_status = 0),0) AS inactive,
                     COALESCE(SUM(active_status = 1 AND date_of_joining >= ?),0) AS joined_month
                FROM employees WHERE is_super_admin = 0`, [monthStart()]),
    query(`SELECT COALESCE(d.name,'Unassigned') AS label, COUNT(e.id) AS value FROM employees e LEFT JOIN departments d ON d.id = e.department_id
            WHERE e.active_status = 1 AND e.is_super_admin = 0 GROUP BY d.name ORDER BY value DESC`),
    query(`SELECT e.id, e.full_name, e.employee_code, e.date_of_joining, r.name AS role_name, d.name AS department_name
             FROM employees e LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id
            WHERE e.is_super_admin = 0 ORDER BY COALESCE(e.date_of_joining, e.created_at) DESC LIMIT 6`),
    query(`SELECT e.id, e.full_name, r.name AS role_name FROM employees e LEFT JOIN roles r ON r.id = e.role_id
            WHERE e.active_status = 1 AND e.is_super_admin = 0 AND e.reports_to IS NULL AND COALESCE(r.level, 9) > 1 LIMIT 6`),
  ]);
  const roles = await queryOne('SELECT COUNT(*) AS n FROM roles WHERE status = 1');
  const openWork = await queryOne(
    `SELECT COUNT(*) AS n FROM employees e WHERE e.active_status = 0 AND (
       EXISTS (SELECT 1 FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0) OR
       EXISTS (SELECT 1 FROM tasks t WHERE t.owner_id = e.id AND t.status NOT IN ('Completed','Cancelled')))`
  );
  return {
    type: 'hr',
    kpis: {
      active: num(counts.active), inactive: num(counts.inactive), joined_month: num(counts.joined_month),
      roles: num(roles.n), inactive_with_open_work: num(openWork.n),
    },
    by_department: byDept,
    joiners,
    no_manager: noManager,
  };
}

const VIEWS = [
  { key: 'executive', label: 'Executive / MD' },
  { key: 'bd', label: 'Business Development' },
  { key: 'marketing', label: 'Marketing' },
  { key: 'cs', label: 'Client Servicing' },
  { key: 'operations', label: 'Operations & Production' },
  { key: 'procurement', label: 'Procurement' },
  { key: 'creative', label: 'Creative' },
  { key: 'finance', label: 'Accounts & Finance' },
  { key: 'hr', label: 'HR & Admin' },
];

/** Which dashboard a user lands on after login. */
async function viewFor(user) {
  if (user.is_super_admin) return 'executive';
  const d = await queryOne('SELECT code FROM departments WHERE id = ?', [user.department_id]);
  const code = d ? d.code : null;
  const role = (user.role_name || '').toLowerCase();
  if (code === 'MGMT') return 'executive';
  if (role.includes('procurement')) return 'procurement';
  if (role.includes('hr & finance head')) return 'finance';
  return { BD: 'bd', MKT: 'marketing', CS: 'cs', OPS: 'operations', CRE: 'creative', FIN: 'finance', HR: 'hr' }[code] || 'bd';
}

module.exports = { bd, marketing, cs, operations, procurement, creative, finance, hr, VIEWS, viewFor };
