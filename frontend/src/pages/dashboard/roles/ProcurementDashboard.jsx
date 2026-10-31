import { LuColumns3, LuShieldCheck, LuSend, LuWallet } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import { Panel, ListRows, Bars, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { lakhs, inr, num, fmtDate } from '../../../utils/format';

const ACTIONS = [
  { title: 'Compare Quotations', sub: 'Select vendor per requirement', to: '/vendors/quotations', module: 'quotations' },
  { title: 'Create Purchase Order', sub: 'From a selected quotation', to: '/vendors/purchase-orders', module: 'purchase_orders', action: 'create' },
  { title: 'Add Vendor', sub: 'Vendor master & compliance docs', to: '/vendors', module: 'vendors', action: 'create' },
  { title: 'Vendor Bills', sub: 'Bills against POs', to: '/vendors/bills', module: 'vendor_bills' },
];

/** Procurement: quotations to decide, POs to approve / issue, deliveries, payables. */
export default function ProcurementDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Requirements Awaiting Selection" value={num(k.awaiting_selection)} icon={LuColumns3} sub={`${k.active_vendors} active vendors`} />
        <StatCard label="POs Pending Approval" value={num(k.po_pending_approval)} icon={LuShieldCheck} sub="Above approval limit / budget" />
        <StatCard label="Approved POs to Issue" value={num(k.po_to_issue)} icon={LuSend} sub="Send to vendor" />
        <StatCard label="Committed (This Month)" value={lakhs(k.committed_month)} icon={LuWallet} sub="Approved / issued PO value" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Quotations Awaiting Selection" to="/vendors/quotations">
          <ListRows
            empty="Every requirement has a selected vendor"
            rows={d.comparisons.map((q, i) => ({ key: i, title: q.requirement, sub: `${q.project_code || 'No project'} · ${q.quotes} quote(s)`, right: `Lowest ${inr(q.lowest)}`, to: '/vendors/quotations' }))}
          />
        </Panel>
        <Panel title="Purchase Orders in Flight" to="/vendors/purchase-orders">
          <ListRows
            empty="No open POs"
            rows={d.deliveries.map((p) => ({ key: p.id, title: `${p.po_code} · ${p.vendor_name}`, sub: `${p.project_code || '—'} · ${inr(p.total_amount)}`, right: <span className="flex flex-col items-end gap-0.5"><Badge>{p.status}</Badge><span className={Number(p.is_overdue) ? 'text-red-600' : ''}>{fmtDate(p.delivery_date)}</span></span>, to: '/vendors/purchase-orders' }))}
          />
        </Panel>
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Top Vendor Payables" to="/vendors/bills">
          <Bars data={d.payables.map((v) => ({ label: v.name, value: Number(v.outstanding) }))} format={lakhs} />
        </Panel>
        <Panel title="Recent Quotations" to="/vendors/quotations">
          <ListRows rows={d.recent_quotes.map((q) => ({ key: q.id, title: `${q.vendor_name} · ${q.requirement}`, sub: q.quote_code, right: <span className="flex flex-col items-end gap-0.5">{inr(q.amount)}<Badge>{q.status}</Badge></span>, to: '/vendors/quotations' }))} empty="No quotations yet" />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>
    </div>
  );
}
