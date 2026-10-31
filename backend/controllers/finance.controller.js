const { query, queryOne } = require('../config/db');
const { asyncHandler, num } = require('../utils/helpers');
const { projectFinancials } = require('../utils/finance');
const { getNumber, getSetting } = require('../utils/settings');
const { scopeClause } = require('../utils/scope');

/** Project P&L for every visible project, with flags. */
exports.profitability = asyncHandler(async (req, res) => {
  const margin = await getNumber('margin_threshold_pct', 20);
  const s = await scopeClause(req.user, ['p.bd_owner_id', 'p.cs_owner_id', 'p.ops_owner_id', 'p.manager_id', 'p.finance_owner_id']);
  let where = s.sql;
  const params = [...s.params];
  if (req.query.status) { where += ' AND p.status = ?'; params.push(req.query.status); }
  if (req.query.from) { where += ' AND p.event_start >= ?'; params.push(req.query.from); }
  if (req.query.to) { where += ' AND p.event_start <= ?'; params.push(req.query.to); }
  if (req.query.search) { where += ' AND (p.name LIKE ? OR p.project_code LIKE ? OR c.name LIKE ?)'; params.push(...Array(3).fill(`%${req.query.search}%`)); }
  let rows = await projectFinancials(where, params, margin);
  if (req.query.flag) rows = rows.filter((r) => r.flags.includes(req.query.flag));
  const totals = rows.reduce(
    (a, r) => {
      ['revised_value', 'estimated_cost', 'approved_budget', 'committed_cost', 'actual_cost', 'estimated_gross_profit', 'actual_gross_profit', 'invoiced', 'received', 'receivable_outstanding', 'vendor_outstanding'].forEach((k) => (a[k] = (a[k] || 0) + num(r[k])));
      return a;
    },
    {}
  );
  totals.actual_margin_pct = totals.revised_value ? Math.round((totals.actual_gross_profit / totals.revised_value) * 1000) / 10 : null;
  totals.estimated_margin_pct = totals.revised_value ? Math.round((totals.estimated_gross_profit / totals.revised_value) * 1000) / 10 : null;
  res.json({ rows, totals, margin_threshold: margin });
});

/** Outstanding invoices in configurable ageing buckets (by due date). */
exports.receivables = asyncHandler(async (req, res) => {
  const bucketDef = (await getSetting('ageing_buckets', '0-30,31-60,61-90,90+')).split(',').map((b) => b.trim());
  const rows = await query(
    `SELECT i.*, p.project_code, p.name AS project_name, c.name AS company_name, o.full_name AS owner_name,
            ROUND(i.total_amount - i.received_amount, 2) AS outstanding, GREATEST(DATEDIFF(CURDATE(), i.due_date), 0) AS days_overdue
       FROM invoices i LEFT JOIN projects p ON p.id = i.project_id LEFT JOIN companies c ON c.id = i.company_id
       LEFT JOIN employees o ON o.id = i.owner_id
      WHERE i.status NOT IN ('Paid','Cancelled','Draft') AND i.total_amount - i.received_amount > 0
      ORDER BY i.due_date`
  );
  const bucketOf = (days, due) => {
    if (!due || new Date(due) >= new Date(new Date().toDateString())) return 'Not due';
    for (const b of bucketDef) {
      if (b.endsWith('+')) { if (days >= parseInt(b, 10)) return b; continue; }
      const [lo, hi] = b.split('-').map(Number);
      if (days >= lo && days <= hi) return b;
    }
    return bucketDef[bucketDef.length - 1];
  };
  const buckets = { 'Not due': 0 };
  bucketDef.forEach((b) => (buckets[b] = 0));
  const data = rows.map((r) => {
    const bucket = bucketOf(r.days_overdue, r.due_date);
    buckets[bucket] = (buckets[bucket] || 0) + num(r.outstanding);
    return { ...r, bucket };
  });
  res.json({ rows: data, buckets, total: data.reduce((a, r) => a + num(r.outstanding), 0) });
});

/** Purchase orders: committed, billed, paid and balance per PO. */
exports.vendorCommitments = asyncHandler(async (req, res) => {
  const rows = await query(
    `SELECT po.id, po.po_code, po.status, po.delivery_status, po.delivery_date, po.amount, po.total_amount,
            v.name AS vendor_name, p.project_code, p.name AS project_name,
            COALESCE(SUM(b.total_amount),0) AS billed, COALESCE(SUM(b.paid_amount),0) AS paid
       FROM purchase_orders po LEFT JOIN vendors v ON v.id = po.vendor_id LEFT JOIN projects p ON p.id = po.project_id
       LEFT JOIN vendor_bills b ON b.po_id = po.id
      WHERE po.status IN ('Approved','Issued','Delivered')
      GROUP BY po.id ORDER BY po.id DESC`
  );
  res.json(rows.map((r) => ({ ...r, balance_to_bill: num(r.total_amount) - num(r.billed), payable: num(r.billed) - num(r.paid) })));
});

/** Pipeline vs confirmed vs invoiced vs collected – reported separately. */
exports.summary = asyncHandler(async (req, res) => {
  const [pipe, confirmed, inv, payables] = await Promise.all([
    queryOne(`SELECT COALESCE(SUM(o.expected_value),0) AS unweighted, COALESCE(SUM(o.expected_value * COALESCE(o.probability, f.probability,0)/100),0) AS weighted
                FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id WHERE f.stage_type = 'open'`),
    queryOne("SELECT COALESCE(SUM(confirmed_value + change_order_value),0) AS v FROM projects WHERE status <> 'Cancelled'"),
    queryOne(`SELECT COALESCE(SUM(amount),0) AS invoiced, COALESCE(SUM(received_amount),0) AS collected,
                     COALESCE(SUM(total_amount - received_amount),0) AS outstanding,
                     COALESCE(SUM(CASE WHEN due_date < CURDATE() THEN total_amount - received_amount ELSE 0 END),0) AS overdue
                FROM invoices WHERE status <> 'Cancelled'`),
    queryOne('SELECT COALESCE(SUM(total_amount),0) AS billed, COALESCE(SUM(paid_amount),0) AS paid FROM vendor_bills'),
  ]);
  res.json({
    pipeline_unweighted: num(pipe.unweighted),
    pipeline_weighted: num(pipe.weighted),
    confirmed_business: num(confirmed.v),
    invoiced: num(inv.invoiced),
    collected: num(inv.collected),
    receivable_outstanding: num(inv.outstanding),
    receivable_overdue: num(inv.overdue),
    vendor_billed: num(payables.billed),
    vendor_paid: num(payables.paid),
    vendor_outstanding: num(payables.billed) - num(payables.paid),
  });
});
