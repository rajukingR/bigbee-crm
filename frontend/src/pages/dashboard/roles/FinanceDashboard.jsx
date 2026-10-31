import { LuReceipt, LuHandCoins, LuClock, LuWallet } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import { Panel, ListRows, Bars, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { lakhs, inr, fmtDate, fmtDateTime, pct } from '../../../utils/format';

const ACTIONS = [
  { title: 'Raise Invoice', sub: 'Advance / milestone / final', to: '/finance/invoices', module: 'invoices', action: 'create' },
  { title: 'Record Receipt', sub: 'Allocate client payments', to: '/finance/invoices', module: 'invoices', action: 'edit' },
  { title: 'Vendor Payments', sub: 'Pay bills against POs', to: '/vendors/bills', module: 'vendor_bills' },
  { title: 'Project Profitability', sub: 'Margins, budget variance', to: '/finance/profitability', module: 'profitability' },
];

/** Accounts & Finance: invoicing, collections, ageing, payables, approvals, flagged projects. */
export default function FinanceDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Invoiced (This Month)" value={lakhs(k.invoiced_month)} icon={LuReceipt} sub="Excl. GST" />
        <StatCard label="Collected (This Month)" value={lakhs(k.collected_month)} icon={LuHandCoins} sub="Cash received" />
        <StatCard label="Receivables Outstanding" value={lakhs(k.receivable)} icon={LuClock} sub={`${lakhs(k.receivable_overdue)} overdue`} />
        <StatCard label="Vendor Payables" value={lakhs(k.payable)} icon={LuWallet} sub={`${lakhs(k.payable_overdue)} overdue · paid ${lakhs(k.paid_out_month)} this month`} />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Receivables Ageing" to="/finance/receivables">
          <Bars data={d.ageing.map((b, i) => ({ label: b.label, value: Number(b.value), color: i === 0 ? '#22c55e' : i === 1 ? '#eab308' : '#ef4444' }))} format={lakhs} />
        </Panel>
        <Panel title="Collections Due / Overdue" to="/finance/invoices">
          <ListRows
            empty="No collections due this week"
            rows={d.invoices_due.map((i) => ({ key: i.id, title: `${i.invoice_no} · ${i.company_name || ''}`, sub: `${i.project_code || ''} · due ${fmtDate(i.due_date)}`, right: <span className="flex flex-col items-end">{inr(i.outstanding)}{Number(i.days_overdue) > 0 && <span className="text-red-600">{i.days_overdue}d overdue</span>}</span>, to: '/finance/invoices' }))}
          />
        </Panel>
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Approvals Waiting for Me" to="/admin/approvals">
          <ListRows
            empty="No pending approvals"
            rows={d.approvals.map((a) => ({ key: a.id, title: a.title, sub: `${a.request_type} · ${a.requested_by_name} · ${fmtDateTime(a.created_at)}`, right: a.amount !== null ? inr(a.amount) : '', to: '/admin/approvals' }))}
          />
        </Panel>
        <Panel title="Projects Needing Attention" to="/finance/profitability">
          <ListRows
            empty="No margin / budget / collection flags"
            rows={d.flagged_projects.map((p) => ({ key: p.id, title: `${p.project_code} · ${p.name}`, sub: `Margin ${pct(p.actual_margin_pct)} · variance ${inr(p.budget_variance)}`, right: <span className="flex flex-col items-end gap-0.5">{p.flags.map((f) => <span key={f} className="chip bg-red-50 text-red-700 ring-1 ring-red-200">{f}</span>)}</span>, to: `/projects/${p.id}` }))}
          />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
    </div>
  );
}
