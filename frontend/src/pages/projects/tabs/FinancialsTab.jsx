import { Link } from 'react-router-dom';
import useFetch from '../../../hooks/useFetch';
import { useAuth } from '../../../context/AuthContext';
import Badge from '../../../components/common/Badge';
import { inr, pct, fmtDate } from '../../../utils/format';

function Mini({ title, rows, cols, link }) {
  return (
    <div className="rounded-lg border border-line">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5">
        <span className="text-sm font-semibold">{title}</span>
        {link && <Link to={link} className="text-xs text-brand">Manage</Link>}
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead>
            <tr>{cols.map((c) => <th key={c[0]} className="table-head !py-2">{c[0]}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={cols.length} className="py-4 text-center text-xs text-slate-400">None</td></tr>}
            {rows.map((r) => (
              <tr key={r.id} className="border-t border-line">
                {cols.map((c) => <td key={c[0]} className="table-cell !py-2 text-xs">{c[1](r)}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** Project P&L: proposal vs confirmed vs invoiced vs collected, budget vs committed vs actual. */
export default function FinancialsTab({ data }) {
  const { can } = useAuth();
  const f = data.financials;
  const pid = data.project.id;
  const inv = useFetch('/invoices', { project_id: pid, all: 1 }, { enabled: can('invoices') });
  const pos = useFetch('/purchase-orders', { project_id: pid, all: 1 }, { enabled: can('purchase_orders') });
  const bills = useFetch('/vendor-bills', { project_id: pid, all: 1 }, { enabled: can('vendor_bills') });
  const exps = useFetch('/expenses', { project_id: pid, all: 1 }, { enabled: can('expenses') });
  if (!f) return <div className="py-8 text-center text-sm text-slate-400">You do not have access to project financials.</div>;

  const Box = ({ label, value, sub, tone }) => (
    <div className="rounded-lg border border-line p-4">
      <div className="text-xs text-slate-500">{label}</div>
      <div className={`mt-1 text-lg font-semibold ${tone || 'text-ink'}`}>{value}</div>
      {sub && <div className="text-[11px] text-slate-500">{sub}</div>}
    </div>
  );

  return (
    <div className="space-y-5">
      {f.flags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {f.flags.map((x) => (
            <span key={x} className="chip bg-red-50 text-red-700 ring-1 ring-red-200">{x}</span>
          ))}
        </div>
      )}
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Revenue</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Box label="Original Proposal Value" value={inr(f.proposal_value)} />
          <Box label="Confirmed Contract Value" value={inr(f.confirmed_value)} />
          <Box label="Approved Change Orders" value={inr(f.change_order_value)} />
          <Box label="Revised Project Value" value={inr(f.revised_value)} />
          <Box label="Not yet invoiced" value={inr(f.uninvoiced_value)} />
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Cost & Budget</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Box label="Estimated Direct Cost" value={inr(f.estimated_cost)} />
          <Box label="Approved Budget" value={inr(f.approved_budget)} />
          <Box label="Committed (POs)" value={inr(f.committed_cost)} />
          <Box label="Actual Cost (bills + expenses)" value={inr(f.actual_cost)} />
          <Box label="Budget Variance" value={inr(f.budget_variance)} tone={f.budget_variance < 0 ? 'text-red-600' : 'text-green-700'} sub={f.budget_variance < 0 ? 'Overrun' : 'Underrun'} />
        </div>
      </div>
      <div>
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Profitability & Cash</div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
          <Box label="Estimated Gross Profit" value={inr(f.estimated_gross_profit)} sub={`Margin ${pct(f.estimated_margin_pct)}`} />
          <Box label="Actual Gross Profit" value={inr(f.actual_gross_profit)} sub={`Margin ${pct(f.actual_margin_pct)}`} tone={f.actual_gross_profit < 0 ? 'text-red-600' : 'text-green-700'} />
          <Box label="Invoiced (excl. tax)" value={inr(f.invoiced)} sub={`incl. tax ${inr(f.invoiced_with_tax)}`} />
          <Box label="Collected" value={inr(f.received)} />
          <Box label="Receivable Outstanding" value={inr(f.receivable_outstanding)} sub={`Vendor payable ${inr(f.vendor_outstanding)}`} tone={f.receivable_outstanding > 0 ? 'text-amber-600' : 'text-ink'} />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        {can('invoices') && (
          <Mini title="Client Invoices" link="/finance/invoices" rows={(inv.data && inv.data.data) || []} cols={[['Invoice', (r) => r.invoice_no], ['Type', (r) => r.invoice_type], ['Due', (r) => fmtDate(r.due_date)], ['Total', (r) => inr(r.total_amount)], ['Received', (r) => inr(r.received_amount)], ['Status', (r) => <Badge>{r.status}</Badge>]]} />
        )}
        {can('purchase_orders') && (
          <Mini title="Purchase / Work Orders" link="/vendors/purchase-orders" rows={(pos.data && pos.data.data) || []} cols={[['PO', (r) => r.po_code], ['Vendor', (r) => r.vendor_name], ['Amount', (r) => inr(r.amount)], ['Billed', (r) => inr(r.billed_amount)], ['Status', (r) => <Badge>{r.status}</Badge>]]} />
        )}
        {can('vendor_bills') && (
          <Mini title="Vendor Bills" link="/vendors/bills" rows={(bills.data && bills.data.data) || []} cols={[['Bill', (r) => r.bill_no], ['Vendor', (r) => r.vendor_name], ['Total', (r) => inr(r.total_amount)], ['Paid', (r) => inr(r.paid_amount)], ['Status', (r) => <Badge>{r.status}</Badge>]]} />
        )}
        {can('expenses') && (
          <Mini title="Other Expenses" link="/finance/expenses" rows={(exps.data && exps.data.data) || []} cols={[['Code', (r) => r.expense_code], ['Category', (r) => r.category || '—'], ['Amount', (r) => inr(r.amount)], ['Status', (r) => <Badge>{r.status}</Badge>]]} />
        )}
      </div>
    </div>
  );
}
