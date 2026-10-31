import { LuTarget, LuTrendingUp, LuUserPlus, LuPhoneCall } from 'react-icons/lu';
import StatCard from '../../../components/common/StatCard';
import Badge from '../../../components/common/Badge';
import { Panel, ListRows, Bars, ProgressRow, MiniTable, QuickActions, NotificationsPanel } from '../../../components/dashboard/Widgets';
import { lakhs, inr, num, pct, fmtDate, fmtDateTime, isOverdue } from '../../../utils/format';

const ACTIONS = [
  { title: 'Add Lead / Enquiry', sub: 'Capture a new enquiry', to: '/leads?new=1', module: 'leads', action: 'create' },
  { title: 'Create Quotation', sub: 'Proposal for an opportunity', to: '/proposals/new', module: 'proposals', action: 'create' },
  { title: "Today's Follow-ups", sub: 'Calls & meetings due', to: '/follow-ups', module: 'activities' },
  { title: 'Sales Funnel', sub: 'Move deals across stages', to: '/opportunities', module: 'opportunities' },
];

/** Business Development: targets, pipeline, follow-ups, closing deals, team. */
export default function BDDashboard({ d }) {
  const k = d.kpis;
  const t = d.target;
  const yearPct = t.year_target ? (t.year_won / t.year_target) * 100 : 0;
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Won Business (This Month)" value={lakhs(k.won_month)} icon={LuTarget} sub={k.month_target ? `Target ${lakhs(k.month_target)} · ${pct((k.won_month / k.month_target) * 100)}` : 'No monthly target set'} />
        <StatCard label="Weighted Pipeline" value={lakhs(k.pipeline_weighted)} icon={LuTrendingUp} sub={`Unweighted ${lakhs(k.pipeline_unweighted)}`} />
        <StatCard label="Open Leads" value={num(k.open_leads)} icon={LuUserPlus} sub={`${k.new_leads_month} new this month`} />
        <StatCard label="Follow-ups Due" value={num(k.followups_due)} icon={LuPhoneCall} sub={k.overdue_followups ? `${k.overdue_followups} overdue` : 'None overdue'} />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <div className="card p-5">
          <h3 className="card-title mb-5">BD Target</h3>
          <div className="mb-5 flex items-end justify-between">
            <span className="text-[13px] font-medium text-ink">This Year</span>
            <span className="text-[22px] font-semibold text-ink">{t.year_target ? lakhs(t.year_target) : 'Not set'}</span>
          </div>
          <div className="space-y-4">
            <ProgressRow label="Achieved" value={lakhs(t.year_won)} pct={yearPct} color="bg-green-500" />
            <ProgressRow label="Remaining" value={lakhs(t.gap)} pct={t.year_target ? (t.gap / t.year_target) * 100 : 0} color="bg-yellow-500" />
            <div className="flex justify-between rounded-md bg-slate-50 px-3 py-2 text-[12px]">
              <span>Pipeline coverage</span>
              <span className={t.coverage_actual !== null && t.coverage_actual < t.coverage_required ? 'font-semibold text-red-600' : 'font-semibold text-green-700'}>
                {t.coverage_actual === null ? '—' : `${t.coverage_actual}x`} / {t.coverage_required}x
              </span>
            </div>
            <div className="flex justify-between text-[12px] text-slate-600">
              <span>Forecast {lakhs(t.forecast)}</span>
              <span>Win rate {pct(t.win_rate)}</span>
            </div>
          </div>
        </div>
        <Panel title="Open Pipeline by Stage" to="/opportunities" linkText="Funnel">
          <Bars data={d.funnel.map((f) => ({ label: `${f.name} (${f.count})`, value: Number(f.value), color: f.color }))} format={lakhs} />
        </Panel>
        <NotificationsPanel />
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <Panel title="Follow-ups Due" to="/follow-ups">
          <ListRows
            empty="No follow-ups due today 🎉"
            rows={d.followups.map((f) => ({
              key: `${f.type}-${f.id}`,
              title: `${f.code} · ${f.name || ''}`,
              sub: f.next_action || f.type,
              right: fmtDateTime(f.due),
              rightClass: isOverdue(f.due) ? 'font-medium text-red-600' : 'text-slate-500',
              to: f.type === 'lead' ? `/leads/${f.id}` : `/opportunities/${f.id}`,
            }))}
          />
        </Panel>
        <Panel title="Closing This Month" to="/opportunities">
          <ListRows
            empty="No deals expected to close this month"
            rows={d.closing.map((o) => ({ key: o.id, title: o.title, sub: `${o.company_name || ''} · ${o.stage_name} · ${fmtDate(o.expected_close_date)}`, right: lakhs(o.expected_value), rightClass: 'font-semibold text-ink', to: `/opportunities/${o.id}` }))}
          />
        </Panel>
        <QuickActions actions={ACTIONS} />
      </div>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        {d.team.length > 0 ? (
          <Panel title="Team Leaderboard (This Month)" to="/manager-dashboard" className="xl:col-span-2">
            <MiniTable
              rows={d.team}
              cols={[
                ['Employee', (r) => <div><div className="font-medium text-ink">{r.name}</div><div className="text-xs text-slate-500">{r.role}</div></div>],
                ['Won', (r) => inr(r.won), 'right'],
                ['Wtd. Pipeline', (r) => inr(r.pipeline), 'right'],
                ['Meetings', (r) => r.meetings, 'right'],
                ['Overdue F/U', (r) => <span className={r.overdue ? 'text-red-600' : ''}>{r.overdue}</span>, 'right'],
              ]}
            />
          </Panel>
        ) : (
          <Panel title="My Activity (This Month)" className="xl:col-span-2">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
              {[['Calls', d.activity.calls], ['Meetings', d.activity.meetings], ['Emails', d.activity.emails], ['Proposals', d.activity.proposals], ['Qualified Leads', d.activity.qualified]].map(([l, v]) => (
                <div key={l} className="rounded-md border border-line p-3">
                  <div className="text-[11px] text-slate-500">{l}</div>
                  <div className="text-lg font-semibold">{num(v)}</div>
                </div>
              ))}
            </div>
          </Panel>
        )}
        <Panel title="Recent Leads" to="/leads">
          <ListRows rows={d.recent_leads.map((l) => ({ key: l.id, title: `${l.lead_code} · ${l.name || ''}`, sub: l.source_name || '—', right: <Badge color={l.status_color}>{l.status_name}</Badge>, to: `/leads/${l.id}` }))} empty="No open leads" />
        </Panel>
      </div>
    </div>
  );
}
