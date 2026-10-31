const { query, queryOne } = require('../config/db');
const { asyncHandler, num } = require('../utils/helpers');
const { salesMetrics } = require('../utils/metrics');
const { projectFinancials } = require('../utils/finance');
const { getNumber } = require('../utils/settings');
const { getSubordinateIds, visibleUserIds } = require('../utils/scope');
const RD = require('../utils/roleDashboards');

const ym = (d) => d.toISOString().slice(0, 7);
function monthRange(monthStr) {
  const [y, m] = monthStr.split('-').map(Number);
  const start = new Date(Date.UTC(y, m - 1, 1));
  const end = new Date(Date.UTC(y, m, 0));
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}
const change = (cur, prev) => (num(prev) ? Math.round(((num(cur) - num(prev)) / Math.abs(num(prev))) * 10000) / 100 : null);

async function monthFigures(month) {
  const { start, end } = monthRange(month);
  const [rev, bills, exp, paid, won] = await Promise.all([
    queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM invoices WHERE status <> 'Cancelled' AND invoice_date BETWEEN ? AND ?", [start, end]),
    queryOne('SELECT COALESCE(SUM(amount),0) AS v FROM vendor_bills WHERE bill_date BETWEEN ? AND ?', [start, end]),
    queryOne("SELECT COALESCE(SUM(amount),0) AS v FROM expenses WHERE status IN ('Approved','Reimbursed') AND expense_date BETWEEN ? AND ?", [start, end]),
    queryOne('SELECT COALESCE(SUM(amount),0) AS v FROM receipts WHERE receipt_date BETWEEN ? AND ?', [start, end]),
    queryOne('SELECT COALESCE(SUM(expected_value),0) AS v FROM opportunities WHERE won_at BETWEEN ? AND ?', [start, `${end} 23:59:59`]),
  ]);
  const revenue = num(rev.v);
  const cost = num(bills.v) + num(exp.v);
  return { month, revenue, vendor_cost: cost, margin: revenue - cost, invoices_paid: num(paid.v), confirmed_business: num(won.v) };
}

/** Company-wide executive dashboard. */
async function executive(req) {
  const month = req.query.month || ym(new Date());
  const [y, m] = month.split('-').map(Number);
  const prevMonth = ym(new Date(Date.UTC(y, m - 2, 1)));
  const cur = await monthFigures(month);
  const prev = await monthFigures(prevMonth);

  const months = parseInt(req.query.months, 10) || 6;
  const trend = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    const f = await monthFigures(ym(d));
    trend.push({ month: f.month, label: d.toLocaleString('en-US', { month: 'short', timeZone: 'UTC' }), revenue: f.revenue, expense: f.vendor_cost, margin: f.margin, confirmed: f.confirmed_business });
  }

  const yearStart = `${y}-01-01`;
  const yearEnd = `${y}-12-31`;
  const fyTarget = await queryOne(
    "SELECT COALESCE(SUM(target_value),0) AS v, COALESCE(MAX(incentive_pct),0) AS inc FROM targets WHERE scope = 'Company' AND period_start <= ? AND period_end >= ?",
    [yearEnd, yearStart]
  );
  let targetValue = num(fyTarget.v);
  if (!targetValue) {
    const t = await queryOne("SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Employee' AND period_start >= ? AND period_end <= ?", [yearStart, yearEnd]);
    targetValue = num(t.v);
  }
  const yearSales = await salesMetrics({}, yearStart, yearEnd);
  const incentive = await queryOne(
    `SELECT COALESCE(SUM(o.expected_value * t.incentive_pct / 100),0) AS v FROM opportunities o
       JOIN targets t ON t.employee_id = o.owner_id AND o.won_at BETWEEN t.period_start AND CONCAT(t.period_end, ' 23:59:59')
      WHERE o.won_at BETWEEN ? AND ?`,
    [yearStart, `${yearEnd} 23:59:59`]
  );

  const margin = await getNumber('margin_threshold_pct', 20);
  const { start, end } = monthRange(month);
  let top = await projectFinancials(
    "AND p.status <> 'Cancelled' AND ((p.event_start BETWEEN ? AND ?) OR (p.created_at BETWEEN ? AND ?))",
    [start, end, start, `${end} 23:59:59`],
    margin
  );
  top = top.sort((a, b) => b.revised_value - a.revised_value).slice(0, 5);

  const [overdueTasks, risks, overdueMilestones, finance] = await Promise.all([
    queryOne("SELECT COUNT(*) AS n FROM tasks WHERE status NOT IN ('Completed','Cancelled') AND due_date < NOW()"),
    query(
      `SELECT x.id, x.title, x.severity, x.escalation_type, x.created_at, p.project_code, p.id AS project_id FROM escalations x
         LEFT JOIN projects p ON p.id = x.project_id WHERE x.status IN ('Open','In Progress')
        ORDER BY FIELD(x.severity,'Critical','High','Medium','Low'), x.id DESC LIMIT 5`
    ),
    queryOne("SELECT COUNT(*) AS n FROM milestones WHERE status NOT IN ('Completed','Cancelled') AND planned_date < CURDATE()"),
    queryOne(`SELECT COALESCE(SUM(total_amount - received_amount),0) AS outstanding,
                     COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN total_amount - received_amount ELSE 0 END),0) AS overdue
                FROM invoices WHERE status NOT IN ('Cancelled','Paid','Draft')`),
  ]);
  const activeProjects = await queryOne("SELECT COUNT(*) AS n FROM projects WHERE status IN ('Handover Pending','Planning','In Progress','Event Live')");

  return {
    type: 'executive',
    month,
    kpis: {
      revenue: cur.revenue, revenue_change: change(cur.revenue, prev.revenue),
      vendor_cost: cur.vendor_cost, vendor_cost_change: change(cur.vendor_cost, prev.vendor_cost),
      margin: cur.margin, margin_change: change(cur.margin, prev.margin),
      invoices_paid: cur.invoices_paid, invoices_paid_change: change(cur.invoices_paid, prev.invoices_paid),
    },
    trend,
    trend_total: trend.reduce((a, t) => a + t.revenue, 0),
    distribution: { income: cur.revenue, expense: cur.vendor_cost, margin: Math.max(cur.margin, 0) },
    bd_target: {
      year: y,
      target: targetValue,
      achieved: yearSales.won_value,
      remaining: Math.max(targetValue - yearSales.won_value, 0),
      incentive: num(incentive.v),
    },
    snapshot: {
      pipeline_unweighted: yearSales.pipeline_unweighted,
      pipeline_weighted: yearSales.pipeline_weighted,
      forecast: yearSales.forecast,
      confirmed_month: cur.confirmed_business,
      receivable_outstanding: num(finance.outstanding),
      receivable_overdue: num(finance.overdue),
      overdue_tasks: overdueTasks.n,
      overdue_milestones: overdueMilestones.n,
      active_projects: activeProjects.n,
    },
    risks,
    top_projects: top,
  };
}

/**
 * Role-based dashboard. Everyone uses the same login; the dashboard is chosen
 * from the user's department / role. Admin and MD can open any role's view
 * (?view=bd, ?view=finance …) with company-wide data.
 */
exports.main = asyncHandler(async (req, res) => {
  const home = await RD.viewFor(req.user);
  const canSwitch = req.user.is_super_admin || home === 'executive';
  let view = home;
  if (req.query.view && canSwitch && RD.VIEWS.some((v) => v.key === req.query.view)) view = req.query.view;
  const ids = canSwitch ? null : await visibleUserIds(req.user);
  const data = view === 'executive' ? await executive(req) : await RD[view](req, ids);
  res.json({
    ...data,
    type: view,
    home,
    views: canSwitch ? RD.VIEWS : null,
    scope: canSwitch ? 'all' : req.user.data_scope,
  });
});

/** Manager dashboard: team scorecards, follow-ups and funnel. */
exports.manager = asyncHandler(async (req, res) => {
  let ids;
  if (req.user.is_super_admin || req.user.data_scope === 'all') {
    const params = [];
    let where = 'WHERE e.active_status = 1 AND e.is_super_admin = 0';
    if (req.query.department_id) { where += ' AND e.department_id = ?'; params.push(req.query.department_id); }
    if (req.query.manager_id) {
      const subs = await getSubordinateIds(Number(req.query.manager_id));
      ids = [Number(req.query.manager_id), ...subs];
    } else {
      ids = (await query(`SELECT e.id FROM employees e ${where}`, params)).map((r) => r.id);
    }
  } else {
    ids = [req.user.id, ...(await getSubordinateIds(req.user.id))];
  }
  if (!ids.length) return res.json({ members: [], followups: [], funnel: [], totals: {} });

  const from = req.query.from || monthRange(ym(new Date())).start;
  const to = req.query.to || monthRange(ym(new Date())).end;
  const ph = ids.map(() => '?').join(',');
  const people = await query(
    `SELECT e.id, e.full_name, e.designation, e.photo, r.name AS role_name, d.name AS department_name, m.full_name AS manager_name
       FROM employees e LEFT JOIN roles r ON r.id = e.role_id LEFT JOIN departments d ON d.id = e.department_id
       LEFT JOIN employees m ON m.id = e.reports_to WHERE e.id IN (${ph}) ORDER BY r.level, e.full_name`,
    ids
  );
  const members = [];
  for (const p of people) {
    const m = await salesMetrics({ employeeIds: [p.id] }, from, to);
    const t = await queryOne(
      `SELECT COUNT(*) AS open_tasks, SUM(due_date < NOW()) AS overdue_tasks,
              (SELECT COUNT(*) FROM tasks WHERE owner_id = ? AND status = 'Completed' AND completed_at BETWEEN ? AND ?) AS done_tasks
         FROM tasks WHERE owner_id = ? AND status NOT IN ('Completed','Cancelled')`,
      [p.id, from, `${to} 23:59:59`, p.id]
    );
    const target = await queryOne(
      "SELECT COALESCE(SUM(target_value),0) AS v FROM targets WHERE scope = 'Employee' AND employee_id = ? AND period_start <= ? AND period_end >= ?",
      [p.id, to, from]
    );
    members.push({
      ...p, ...m,
      target: num(target.v),
      achievement_pct: num(target.v) ? Math.round((m.won_value / num(target.v)) * 1000) / 10 : null,
      open_tasks: num(t.open_tasks), overdue_tasks: num(t.overdue_tasks), done_tasks: num(t.done_tasks),
    });
  }
  const followups = await query(
    `SELECT * FROM (
       SELECT 'lead' AS type, l.id, l.lead_code AS code, COALESCE(l.company_name, l.contact_name) AS name, l.next_action, l.next_follow_up AS due, e.full_name AS owner_name
         FROM leads l LEFT JOIN employees e ON e.id = l.owner_id
        WHERE l.owner_id IN (${ph}) AND l.is_converted = 0 AND l.next_follow_up IS NOT NULL AND DATE(l.next_follow_up) <= CURDATE()
       UNION ALL
       SELECT 'opportunity', o.id, o.opp_code, o.title, o.next_action, o.next_follow_up, e.full_name
         FROM opportunities o LEFT JOIN employees e ON e.id = o.owner_id LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id
        WHERE o.owner_id IN (${ph}) AND f.stage_type IN ('open','hold') AND o.next_follow_up IS NOT NULL AND DATE(o.next_follow_up) <= CURDATE()
       UNION ALL
       SELECT 'task', t.id, CONCAT('TSK', t.id), t.title, t.status, t.due_date, e.full_name
         FROM tasks t LEFT JOIN employees e ON e.id = t.owner_id
        WHERE t.owner_id IN (${ph}) AND t.status NOT IN ('Completed','Cancelled') AND t.due_date IS NOT NULL AND DATE(t.due_date) <= CURDATE()
     ) x ORDER BY due LIMIT 50`,
    [...ids, ...ids, ...ids]
  );
  const funnel = await query(
    `SELECT f.id, f.name, f.color, f.stage_type, COUNT(o.id) AS count, COALESCE(SUM(o.expected_value),0) AS value
       FROM funnel_statuses f LEFT JOIN opportunities o ON o.funnel_status_id = f.id AND o.owner_id IN (${ph})
      WHERE f.status = 1 GROUP BY f.id ORDER BY f.sort_order`,
    ids
  );
  const totals = members.reduce((a, mbr) => {
    ['won_value', 'pipeline_weighted', 'pipeline_unweighted', 'target', 'leads', 'qualified_leads', 'meetings', 'calls', 'proposals_sent', 'overdue_followups', 'overdue_tasks'].forEach((k) => (a[k] = (a[k] || 0) + num(mbr[k])));
    return a;
  }, {});
  res.json({ from, to, members, followups, funnel, totals });
});
