/**
 * Project financial calculations (BRD section 8.2).
 * Pipeline, confirmed, invoiced and collected values are kept separate.
 */
const { query } = require('../config/db');

const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
const pct = (a, b) => (Number(b) ? r2((Number(a) / Number(b)) * 100) : null); // null => N/A

/** SQL that returns one row per project with all financial aggregates. */
const FIN_SQL = `
SELECT p.id, p.project_code, p.name, p.status, p.event_start, p.company_id, c.name AS company_name,
       p.proposal_value, p.confirmed_value, p.change_order_value, p.estimated_cost, p.approved_budget,
       p.bd_owner_id, p.cs_owner_id, p.ops_owner_id, p.manager_id, p.finance_owner_id,
       bd.full_name AS bd_owner_name, mg.full_name AS manager_name,
       COALESCE(po.committed,0) AS committed_cost,
       COALESCE(vb.billed,0) AS vendor_billed,
       COALESCE(vb.paid,0) AS vendor_paid,
       COALESCE(ex.expenses,0) AS other_expenses,
       COALESCE(inv.invoiced,0) AS invoiced,
       COALESCE(inv.invoiced_total,0) AS invoiced_with_tax,
       COALESCE(inv.received,0) AS received,
       COALESCE(inv.overdue,0) AS overdue_receivable
  FROM projects p
  LEFT JOIN companies c ON c.id = p.company_id
  LEFT JOIN employees bd ON bd.id = p.bd_owner_id
  LEFT JOIN employees mg ON mg.id = p.manager_id
  LEFT JOIN (SELECT project_id, SUM(amount) AS committed FROM purchase_orders
              WHERE status IN ('Approved','Issued','Delivered') GROUP BY project_id) po ON po.project_id = p.id
  LEFT JOIN (SELECT project_id, SUM(amount) AS billed, SUM(paid_amount) AS paid FROM vendor_bills GROUP BY project_id) vb ON vb.project_id = p.id
  LEFT JOIN (SELECT project_id, SUM(amount) AS expenses FROM expenses WHERE status IN ('Approved','Reimbursed') GROUP BY project_id) ex ON ex.project_id = p.id
  LEFT JOIN (SELECT project_id, SUM(amount) AS invoiced, SUM(total_amount) AS invoiced_total, SUM(received_amount) AS received,
                    SUM(CASE WHEN due_date < CURDATE() THEN total_amount - received_amount ELSE 0 END) AS overdue
               FROM invoices WHERE status <> 'Cancelled' GROUP BY project_id) inv ON inv.project_id = p.id`;

function enrich(row, marginThreshold = 20) {
  const revisedValue = r2(Number(row.confirmed_value) + Number(row.change_order_value));
  const actualCost = r2(Number(row.vendor_billed) + Number(row.other_expenses));
  const estGP = r2(revisedValue - Number(row.estimated_cost));
  const actGP = r2(revisedValue - actualCost);
  const budgetVariance = r2(Number(row.approved_budget) - actualCost);
  const receivable = r2(Number(row.invoiced_with_tax) - Number(row.received));
  const vendorOutstanding = r2(Number(row.vendor_billed) - Number(row.vendor_paid));
  const estMargin = pct(estGP, revisedValue);
  const actMargin = pct(actGP, revisedValue);
  const flags = [];
  if (actMargin !== null && actualCost > 0 && actMargin < marginThreshold) flags.push('Low margin');
  else if (estMargin !== null && estMargin < marginThreshold) flags.push('Low estimated margin');
  if (budgetVariance < 0 && Number(row.approved_budget) > 0) flags.push('Over budget');
  if (Number(row.overdue_receivable) > 0) flags.push('Overdue collection');
  return {
    ...row,
    revised_value: revisedValue,
    actual_cost: actualCost,
    remaining_budget: r2(Number(row.approved_budget) - Math.max(actualCost, Number(row.committed_cost))),
    estimated_gross_profit: estGP,
    actual_gross_profit: actGP,
    estimated_margin_pct: estMargin,
    actual_margin_pct: actMargin,
    budget_variance: budgetVariance,
    receivable_outstanding: receivable,
    vendor_outstanding: vendorOutstanding,
    uninvoiced_value: r2(revisedValue - Number(row.invoiced)),
    flags,
  };
}

async function projectFinancials(where = '', params = [], marginThreshold = 20) {
  const rows = await query(`${FIN_SQL} WHERE 1=1 ${where} ORDER BY p.id DESC`, params);
  return rows.map((r) => enrich(r, marginThreshold));
}

module.exports = { projectFinancials, enrich, FIN_SQL, r2, pct };
