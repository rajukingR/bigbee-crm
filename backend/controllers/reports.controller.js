const { query } = require('../config/db');
const { asyncHandler, ApiError, num } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { getNumber } = require('../utils/settings');
const { visibleUserIds } = require('../utils/scope');

function range(q) {
  const today = new Date().toISOString().slice(0, 10);
  const yearStart = `${today.slice(0, 4)}-01-01`;
  return { from: q.from || yearStart, to: q.to || today, toEnd: `${q.to || today} 23:59:59` };
}

async function ownerScope(req, col) {
  const ids = await visibleUserIds(req.user);
  let sql = '';
  const params = [];
  if (ids) { sql += ` AND ${col} IN (${ids.map(() => '?').join(',')})`; params.push(...ids); }
  if (req.query.owner_id) { sql += ` AND ${col} = ?`; params.push(req.query.owner_id); }
  if (req.query.department_id) { sql += ` AND ${col} IN (SELECT id FROM employees WHERE department_id = ?)`; params.push(req.query.department_id); }
  return { sql, params };
}

const REPORTS = {
  /** Lead counts / value by stage, conversion, ageing, source, industry, owner, close month. */
  'sales-funnel': async (req) => {
    const { from, toEnd } = range(req.query);
    const s = await ownerScope(req, 'o.owner_id');
    const JOINS = `FROM opportunities o LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id
      LEFT JOIN companies c ON c.id = o.company_id LEFT JOIN industries i ON i.id = c.industry_id
      LEFT JOIN lead_sources s ON s.id = o.lead_source_id LEFT JOIN employees e ON e.id = o.owner_id`;
    const WHERE = ` WHERE o.created_at BETWEEN ? AND ? ${s.sql}`;
    const base = JOINS + WHERE;
    const p = [from, toEnd, ...s.params];
    const byStage = await query(
      `SELECT f.name AS stage, f.sort_order, f.stage_type, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value,
              COALESCE(SUM(o.expected_value * COALESCE(o.probability, f.probability, 0) / 100),0) AS weighted,
              ROUND(AVG(DATEDIFF(NOW(), o.stage_changed_at))) AS avg_age_days
         ${base} GROUP BY f.id, f.name, f.sort_order, f.stage_type ORDER BY f.sort_order`,
      p
    );
    // Stage conversion: share of opportunities that ever reached each stage
    const reached = await query(
      `SELECT f.name AS stage, f.sort_order, COUNT(DISTINCT h.opportunity_id) AS reached
         FROM opportunity_stage_history h JOIN funnel_statuses f ON f.id = h.to_status_id
         JOIN opportunities o ON o.id = h.opportunity_id
        WHERE o.created_at BETWEEN ? AND ? ${s.sql} GROUP BY f.id, f.name, f.sort_order ORDER BY f.sort_order`,
      p
    );
    const total = reached.length ? Math.max(...reached.map((r) => num(r.reached))) : 0;
    const conversion = reached.map((r) => ({ ...r, pct: total ? Math.round((num(r.reached) / total) * 1000) / 10 : 0 }));
    const by = (col, label) =>
      query(`SELECT ${col} AS ${label}, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value,
                    SUM(f.stage_type = 'won') AS won, SUM(f.stage_type = 'lost') AS lost
               ${base} GROUP BY ${col} ORDER BY value DESC`, p);
    const [bySource, byOwner, byIndustry, byMonth] = await Promise.all([
      by("COALESCE(s.name, 'Unknown')", 'source'),
      by("COALESCE(e.full_name, 'Unassigned')", 'owner'),
      by("COALESCE(i.name, 'Unknown')", 'industry'),
      query(`SELECT DATE_FORMAT(o.expected_close_date, '%Y-%m') AS month, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value,
                    COALESCE(SUM(o.expected_value * COALESCE(o.probability, f.probability, 0) / 100),0) AS weighted
               ${base} AND f.stage_type = 'open' AND o.expected_close_date IS NOT NULL
               GROUP BY DATE_FORMAT(o.expected_close_date, '%Y-%m') ORDER BY month`, p),
    ]);
    return { by_stage: byStage, conversion, by_source: bySource, by_owner: byOwner, by_industry: byIndustry, by_close_month: byMonth };
  },

  /** Calls, meetings, proposals, next actions, overdue follow-ups and inactive leads per owner. */
  'lead-activity': async (req) => {
    const { from, toEnd } = range(req.query);
    const s = await ownerScope(req, 'e.id');
    const inactiveDays = Math.floor(await getNumber('inactive_lead_days', 7));
    const rows = await query(
      `SELECT e.id, e.full_name AS owner, d.name AS department,
         (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.created_at BETWEEN ? AND ?) AS leads_created,
         (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0) AS open_leads,
         (SELECT COUNT(*) FROM activities a WHERE a.owner_id = e.id AND a.activity_type = 'Call' AND a.activity_date BETWEEN ? AND ?) AS calls,
         (SELECT COUNT(*) FROM activities a WHERE a.owner_id = e.id AND a.activity_type = 'Meeting' AND a.activity_date BETWEEN ? AND ?) AS meetings,
         (SELECT COUNT(*) FROM activities a WHERE a.owner_id = e.id AND a.activity_type = 'Email' AND a.activity_date BETWEEN ? AND ?) AS emails,
         (SELECT COUNT(*) FROM proposals p WHERE p.owner_id = e.id AND p.sent_date BETWEEN ? AND ?) AS proposals_sent,
         (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0 AND l.next_follow_up < NOW()) AS overdue_followups,
         (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0 AND l.next_follow_up IS NULL) AS no_next_action,
         (SELECT COUNT(*) FROM leads l WHERE l.owner_id = e.id AND l.is_converted = 0
              AND COALESCE(l.last_activity_at, l.created_at) < DATE_SUB(NOW(), INTERVAL ${inactiveDays} DAY)) AS inactive_leads
       FROM employees e LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.active_status = 1 ${s.sql}
      HAVING leads_created + open_leads + calls + meetings + emails + proposals_sent > 0
      ORDER BY open_leads DESC`,
      [from, toEnd, from, toEnd, from, toEnd, from, toEnd, from, toEnd.slice(0, 10), ...s.params]
    );
    return { rows };
  },

  /** Project health, event dates, progress, overdue milestones, pending client/vendor actions, escalations. */
  'project-status': async (req) => {
    const s = await ownerScope(req, 'p.manager_id');
    const rows = await query(
      `SELECT p.id, p.project_code, p.name, c.name AS company, p.status, p.health, p.progress, p.event_start, p.event_end,
              m.full_name AS manager,
              (SELECT COUNT(*) FROM milestones x WHERE x.project_id = p.id AND x.status NOT IN ('Completed','Cancelled') AND x.planned_date < CURDATE()) AS overdue_milestones,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status NOT IN ('Completed','Cancelled') AND t.due_date < NOW()) AS overdue_tasks,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'Waiting for Client') AS pending_client,
              (SELECT COUNT(*) FROM tasks t WHERE t.project_id = p.id AND t.status = 'Waiting for Vendor') AS pending_vendor,
              (SELECT COUNT(*) FROM escalations e WHERE e.project_id = p.id AND e.status IN ('Open','In Progress')) AS open_escalations
         FROM projects p LEFT JOIN companies c ON c.id = p.company_id LEFT JOIN employees m ON m.id = p.manager_id
        WHERE p.status NOT IN ('Cancelled') ${req.query.status ? 'AND p.status = ?' : ''} ${s.sql}
        ORDER BY p.event_start IS NULL, p.event_start`,
      [...(req.query.status ? [req.query.status] : []), ...s.params]
    );
    return { rows };
  },

  /** Lost value and reason by source, industry, service line, competitor and owner. */
  'lost-business': async (req) => {
    const { from, toEnd } = range(req.query);
    const s = await ownerScope(req, 'o.owner_id');
    const base = `FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id AND f.stage_type = 'lost'
      LEFT JOIN loss_reasons r ON r.id = o.loss_reason_id LEFT JOIN lead_sources s ON s.id = o.lead_source_id
      LEFT JOIN companies c ON c.id = o.company_id LEFT JOIN industries i ON i.id = c.industry_id
      LEFT JOIN services sv ON sv.id = o.service_id LEFT JOIN employees e ON e.id = o.owner_id
      WHERE o.stage_changed_at BETWEEN ? AND ? ${s.sql}`;
    const p = [from, toEnd, ...s.params];
    const g = (col) => query(`SELECT COALESCE(${col}, 'Not specified') AS name, COUNT(*) AS count, COALESCE(SUM(COALESCE(o.lost_value, o.expected_value)),0) AS value ${base} GROUP BY ${col} ORDER BY value DESC`, p);
    const [byReason, bySource, byIndustry, byService, byCompetitor, byOwner, rows] = await Promise.all([
      g('r.name'), g('s.name'), g('i.name'), g('sv.name'), g('o.competitor'), g('e.full_name'),
      query(`SELECT o.opp_code, o.title, c.name AS company, COALESCE(o.lost_value, o.expected_value) AS lost_value, r.name AS reason,
                    o.competitor, e.full_name AS owner, o.loss_notes, o.stage_changed_at AS lost_on ${base} ORDER BY o.stage_changed_at DESC`, p),
    ]);
    return { by_reason: byReason, by_source: bySource, by_industry: byIndustry, by_service: byService, by_competitor: byCompetitor, by_owner: byOwner, rows };
  },

  /** Department scorecards (BD, CS, Operations, Creative, Finance, Marketing). */
  scorecards: async (req) => {
    const { from, to, toEnd } = range(req.query);
    const dept = req.query.department || 'BD';
    const s = await ownerScope(req, 'e.id');
    const people = await query(
      `SELECT e.id, e.full_name, r.name AS role_name FROM employees e JOIN departments d ON d.id = e.department_id
       LEFT JOIN roles r ON r.id = e.role_id WHERE d.code = ? AND e.active_status = 1 ${s.sql} ORDER BY r.level, e.full_name`,
      [dept, ...s.params]
    );
    const rows = [];
    for (const p of people) {
      const id = p.id;
      let m = {};
      if (dept === 'BD') {
        const [[won], [pipe], [lq], [mt], [pr], [od], [tg]] = await Promise.all([
          query('SELECT COALESCE(SUM(expected_value),0) AS v, COUNT(*) AS n FROM opportunities WHERE owner_id = ? AND won_at BETWEEN ? AND ?', [id, from, toEnd]),
          query(`SELECT COALESCE(SUM(o.expected_value),0) AS u, COALESCE(SUM(o.expected_value*COALESCE(o.probability,f.probability,0)/100),0) AS w
                   FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id WHERE o.owner_id = ? AND f.stage_type = 'open'`, [id]),
          query("SELECT COUNT(*) AS n FROM leads WHERE owner_id = ? AND qualification = 'Qualified' AND created_at BETWEEN ? AND ?", [id, from, toEnd]),
          query("SELECT COUNT(*) AS n FROM activities WHERE owner_id = ? AND activity_type = 'Meeting' AND activity_date BETWEEN ? AND ?", [id, from, toEnd]),
          query('SELECT COUNT(*) AS n FROM proposals WHERE owner_id = ? AND sent_date BETWEEN ? AND ?', [id, from, to]),
          query('SELECT COUNT(*) AS n FROM leads WHERE owner_id = ? AND is_converted = 0 AND next_follow_up < NOW()', [id]),
          query("SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope='Employee' AND employee_id = ? AND period_start <= ? AND period_end >= ?", [id, to, from]),
        ]);
        const closed = await query(
          "SELECT SUM(f.stage_type='won') AS w, SUM(f.stage_type='lost') AS l FROM opportunities o JOIN funnel_statuses f ON f.id=o.funnel_status_id WHERE o.owner_id = ? AND o.stage_changed_at BETWEEN ? AND ?",
          [id, from, toEnd]
        );
        const cl = num(closed[0].w) + num(closed[0].l);
        m = { target: num(tg.v), won_business: num(won.v), weighted_pipeline: num(pipe.w), unweighted_pipeline: num(pipe.u), qualified_leads: lq.n, meetings: mt.n, proposals: pr.n, conversion_pct: cl ? Math.round((num(closed[0].w) / cl) * 1000) / 10 : 0, overdue_followups: od.n, forecast: num(won.v) + num(pipe.w) };
      } else if (dept === 'CS') {
        const [[ap], [pend], [ms], [esc], [sat], [rep]] = await Promise.all([
          query("SELECT COUNT(*) AS n FROM projects WHERE cs_owner_id = ? AND status IN ('Planning','In Progress','Event Live','Handover Pending')", [id]),
          query("SELECT COUNT(*) AS n FROM milestones m JOIN projects p ON p.id = m.project_id WHERE p.cs_owner_id = ? AND m.milestone_type = 'Client Approval' AND m.status NOT IN ('Completed','Cancelled')", [id]),
          query("SELECT COUNT(*) AS total, SUM(m.status = 'Completed' AND m.actual_date <= m.planned_date) AS on_time FROM milestones m JOIN projects p ON p.id = m.project_id WHERE p.cs_owner_id = ? AND m.planned_date BETWEEN ? AND ?", [id, from, to]),
          query('SELECT COUNT(*) AS n FROM escalations x JOIN projects p ON p.id = x.project_id WHERE p.cs_owner_id = ? AND x.created_at BETWEEN ? AND ?', [id, from, toEnd]),
          query('SELECT ROUND(AVG(f.rating_overall),1) AS v FROM feedback f JOIN projects p ON p.id = f.project_id WHERE p.cs_owner_id = ? AND f.feedback_date BETWEEN ? AND ?', [id, from, to]),
          query('SELECT COUNT(*) AS n FROM feedback f JOIN projects p ON p.id = f.project_id WHERE p.cs_owner_id = ? AND f.repeat_business = 1 AND f.feedback_date BETWEEN ? AND ?', [id, from, to]),
        ]);
        m = { active_projects: ap.n, client_approvals_pending: pend.n, milestone_adherence_pct: num(ms.total) ? Math.round((num(ms.on_time) / num(ms.total)) * 100) : null, escalations: esc.n, client_satisfaction: sat.v, repeat_opportunities: rep.n };
      } else if (dept === 'OPS') {
        const [[pr], [tk], [inc], [cl], [bud]] = await Promise.all([
          query("SELECT COUNT(*) AS n FROM projects WHERE ops_owner_id = ? AND status IN ('Planning','In Progress','Event Live')", [id]),
          query("SELECT COUNT(*) AS total, SUM(completed_at <= due_date) AS on_time FROM tasks WHERE owner_id = ? AND status = 'Completed' AND completed_at BETWEEN ? AND ?", [id, from, toEnd]),
          query('SELECT COUNT(*) AS n FROM incidents i JOIN projects p ON p.id = i.project_id WHERE p.ops_owner_id = ? AND i.occurred_at BETWEEN ? AND ?', [id, from, toEnd]),
          query("SELECT COUNT(*) AS n FROM projects WHERE ops_owner_id = ? AND status = 'Closed' AND closed_at BETWEEN ? AND ?", [id, from, toEnd]),
          query(`SELECT COUNT(*) AS total, SUM(p.approved_budget >= COALESCE((SELECT SUM(b.amount) FROM vendor_bills b WHERE b.project_id = p.id),0)) AS within
                   FROM projects p WHERE p.ops_owner_id = ? AND p.approved_budget > 0`, [id]),
        ]);
        const readiness = await query(
          `SELECT ROUND(AVG(r),0) AS v FROM (SELECT SUM(x.status IN ('Ready','Done'))/COUNT(*)*100 AS r FROM execution_items x JOIN projects p ON p.id = x.project_id
             WHERE p.ops_owner_id = ? AND p.status IN ('Planning','In Progress','Event Live') GROUP BY p.id) z`,
          [id]
        );
        m = { active_projects: pr.n, project_readiness_pct: readiness[0].v, on_time_task_pct: num(tk.total) ? Math.round((num(tk.on_time) / num(tk.total)) * 100) : null, budget_adherence_pct: num(bud.total) ? Math.round((num(bud.within) / num(bud.total)) * 100) : null, incidents: inc.n, projects_closed: cl.n };
      } else if (dept === 'CRE') {
        const [[as], [dl], [od]] = await Promise.all([
          query('SELECT COUNT(*) AS n FROM tasks WHERE owner_id = ? AND created_at BETWEEN ? AND ?', [id, from, toEnd]),
          query("SELECT COUNT(*) AS n, SUM(completed_at <= due_date) AS on_time, ROUND(AVG(DATEDIFF(completed_at, created_at)),1) AS turnaround FROM tasks WHERE owner_id = ? AND status = 'Completed' AND completed_at BETWEEN ? AND ?", [id, from, toEnd]),
          query("SELECT COUNT(*) AS n FROM tasks WHERE owner_id = ? AND status NOT IN ('Completed','Cancelled') AND due_date < NOW()", [id]),
        ]);
        const rev = await query('SELECT COUNT(*) AS n FROM task_comments c JOIN tasks t ON t.id = c.task_id WHERE t.owner_id = ? AND c.created_at BETWEEN ? AND ?', [id, from, toEnd]);
        m = { briefs_assigned: as.n, concepts_delivered: dl.n, revision_comments: rev[0].n, avg_turnaround_days: dl.turnaround, deadlines_met_pct: num(dl.n) ? Math.round((num(dl.on_time) / num(dl.n)) * 100) : null, overdue: od.n };
      } else if (dept === 'FIN') {
        const [[ir], [col], [od], [vp], [cl]] = await Promise.all([
          query('SELECT COUNT(*) AS n, COALESCE(SUM(amount),0) AS v FROM invoices WHERE created_by = ? AND invoice_date BETWEEN ? AND ?', [id, from, to]),
          query('SELECT COALESCE(SUM(amount),0) AS v FROM receipts WHERE created_by = ? AND receipt_date BETWEEN ? AND ?', [id, from, to]),
          query("SELECT COALESCE(SUM(total_amount - received_amount),0) AS v FROM invoices WHERE owner_id = ? AND status NOT IN ('Paid','Cancelled') AND due_date < CURDATE()", [id]),
          query('SELECT COALESCE(SUM(amount),0) AS v FROM vendor_payments WHERE created_by = ? AND payment_date BETWEEN ? AND ?', [id, from, to]),
          query("SELECT COUNT(*) AS n FROM projects WHERE finance_owner_id = ? AND status = 'Closed' AND closed_at BETWEEN ? AND ?", [id, from, toEnd]),
        ]);
        m = { invoices_raised: ir.n, invoiced_value: num(ir.v), collections: num(col.v), overdue_receivables: num(od.v), vendor_payments: num(vp.v), financial_closures: cl.n };
      } else if (dept === 'MKT') {
        const [[sp], [ld], [q], [op], [wn]] = await Promise.all([
          query('SELECT COALESCE(SUM(actual_spend),0) AS v FROM campaigns WHERE owner_id = ? AND start_date BETWEEN ? AND ?', [id, from, to]),
          query('SELECT COUNT(*) AS n FROM leads WHERE created_by = ? AND created_at BETWEEN ? AND ?', [id, from, toEnd]),
          query("SELECT COUNT(*) AS n FROM leads WHERE created_by = ? AND qualification = 'Qualified' AND created_at BETWEEN ? AND ?", [id, from, toEnd]),
          query('SELECT COUNT(*) AS n FROM leads WHERE created_by = ? AND is_converted = 1 AND created_at BETWEEN ? AND ?', [id, from, toEnd]),
          query('SELECT COALESCE(SUM(o.expected_value),0) AS v FROM leads l JOIN opportunities o ON o.id = l.opportunity_id WHERE l.created_by = ? AND o.won_at IS NOT NULL AND l.created_at BETWEEN ? AND ?', [id, from, toEnd]),
        ]);
        m = { spend: num(sp.v), leads: ld.n, qualified_leads: q.n, opportunities: op.n, won_revenue: num(wn.v), cost_per_lead: ld.n ? Math.round(num(sp.v) / ld.n) : null };
      }
      rows.push({ employee: p.full_name, role: p.role_name, ...m });
    }
    return { department: dept, rows };
  },
};

exports.run = asyncHandler(async (req, res) => {
  const fn = REPORTS[req.params.report];
  if (!fn) throw new ApiError(404, 'Unknown report');
  res.json(await fn(req));
});

exports.logExport = asyncHandler(async (req, res) => {
  await logAudit(req, 'export', req.body.module || 'reports', null, { report: req.body.report, rows: req.body.rows, filters: req.body.filters });
  res.json({ ok: true });
});
