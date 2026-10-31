import { LuMegaphone, LuUsers, LuCircleCheck, LuIndianRupee } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import { Panel, ListRows, Bars, MiniTable, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { lakhs, inr, num } from '../../../utils/format';

const ACTIONS = [
  { title: 'Add Enquiry', sub: 'Inbound / marketing lead (auto-assigned to BD)', to: '/leads?new=1', module: 'leads', action: 'create' },
  { title: 'New Campaign', sub: 'Plan spend & channel', to: '/marketing/campaigns', module: 'campaigns', action: 'create' },
  { title: 'Marketing ROI', sub: 'Spend vs attributed revenue', to: '/marketing/roi', module: 'campaigns' },
  { title: 'Import Leads', sub: 'Bulk upload from CSV', to: '/admin/import', module: 'import', action: 'create' },
];

/** Marketing: spend, leads generated, source mix, campaign performance. */
export default function MarketingDashboard({ d }) {
  const k = d.kpis;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Campaign Spend (This Year)" value={lakhs(k.spend)} icon={LuMegaphone} sub={`Budget ${lakhs(k.budget)} · ${k.active_campaigns} active`} />
        <StatCard label="Leads Generated (This Month)" value={num(k.leads_month)} icon={LuUsers} sub={`${k.converted_month} converted to opportunity`} />
        <StatCard label="Qualified Leads (This Month)" value={num(k.qualified_month)} icon={LuCircleCheck} sub={k.leads_month ? `${Math.round((k.qualified_month / k.leads_month) * 100)}% qualification rate` : '—'} />
        <StatCard label="Cost per Lead" value={k.cpl === null ? 'N/A' : inr(k.cpl)} icon={LuIndianRupee} sub="Spend ÷ leads" />
      </div>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Leads by Source (This Year)" to="/reports" linkText="Reports">
          <Bars data={d.by_source.map((s) => ({ label: s.label, value: Number(s.value) }))} />
        </Panel>
        <QuickActions actions={ACTIONS} />
        <NotificationsPanel />
      </div>
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <Panel title="Active & Planned Campaigns" to="/marketing/campaigns" className="xl:col-span-2">
          <MiniTable
            rows={d.campaigns}
            empty="No active campaigns"
            cols={[
              ['Campaign', (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-slate-500">{r.channel_name || '—'}</div></div>],
              ['Spend', (r) => inr(r.actual_spend), 'right'],
              ['Leads', (r) => `${r.leads} (${r.qualified} q)`, 'right'],
              ['CPL', (r) => (r.cpl === null ? 'N/A' : inr(r.cpl)), 'right'],
              ['Won Revenue', (r) => inr(r.won_revenue), 'right'],
              ['Status', (r) => <Badge>{r.status}</Badge>],
            ]}
          />
        </Panel>
        <Panel title="Latest Enquiries & BD Owner" to="/leads">
          <ListRows rows={d.recent_leads.map((l) => ({ key: l.id, title: `${l.lead_code} · ${l.name || ''}`, sub: `${l.source_name || '—'} → ${l.owner_name || 'Unassigned'}`, right: <Badge color={l.status_color}>{l.status_name}</Badge>, to: `/leads/${l.id}` }))} empty="No leads yet" />
        </Panel>
      </div>
    </div>
  );
}
