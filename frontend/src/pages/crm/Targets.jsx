import { useState } from 'react';
import { LuDownload } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Tabs from '../../components/common/Tabs';
import Loader from '../../components/common/Loader';
import ProgressBar from '../../components/common/ProgressBar';
import { Select } from '../../components/common/FormFields';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { lakhs, inr, fmtDate, pct } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { toOptions } from '../../utils/constants';

const yearStart = () => `${new Date().getFullYear()}-01-01`;
const yearEnd = () => `${new Date().getFullYear()}-12-31`;

export function Achievement() {
  const { can } = useAuth();
  const [f, setF] = useState({ from: yearStart(), to: yearEnd(), scope: '' });
  const { data, loading } = useFetch('/targets/achievement', f);
  const rows = data || [];
  const cols = [
    { key: 'period', label: 'Period', exportValue: (r) => `${r.period_start} – ${r.period_end}` },
    { key: 'scope', label: 'Scope' },
    { key: 'name', label: 'For', exportValue: (r) => r.employee_name || r.department_name || 'Company' },
    { key: 'target_value', label: 'Target' },
    { key: 'won_value', label: 'Won' },
    { key: 'achievement_pct', label: 'Achievement %' },
    { key: 'gap', label: 'Gap' },
    { key: 'pipeline_weighted', label: 'Weighted Pipeline' },
    { key: 'pipeline_unweighted', label: 'Unweighted Pipeline' },
    { key: 'coverage_actual', label: 'Coverage (x)' },
    { key: 'coverage_required', label: 'Coverage Target (x)' },
    { key: 'forecast', label: 'Forecast' },
    { key: 'qualified_leads', label: 'Qualified Leads' },
    { key: 'meetings', label: 'Meetings' },
    { key: 'proposals_sent', label: 'Proposals' },
    { key: 'win_rate', label: 'Conversion %' },
    { key: 'incentive_earned', label: 'Incentive' },
  ];
  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        <Select className="!w-44 !py-1.5 text-[13px]" placeholder="All scopes" value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })} options={toOptions(['Company', 'Department', 'Employee'])} />
        {can('targets', 'export') && (
          <button className="btn-outline ml-auto !py-1.5" onClick={() => exportCsv('target_achievement', cols, rows, { module: 'targets' })}>
            <LuDownload size={14} /> Export
          </button>
        )}
      </div>
      {loading && !data ? (
        <Loader />
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>
                {['Period', 'For', 'Target', 'Won', 'Achievement', 'Gap', 'Weighted / Unweighted Pipeline', 'Coverage', 'Forecast', 'Activity', 'Conv.', 'Incentive'].map((h) => (
                  <th key={h} className="table-head">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={12} className="py-8 text-center text-sm text-slate-400">No targets in this period</td></tr>}
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="table-cell text-xs">
                    <div className="font-medium text-ink">{r.period_type}</div>
                    {fmtDate(r.period_start)} – {fmtDate(r.period_end)}
                  </td>
                  <td className="table-cell">
                    <div className="font-medium text-ink">{r.employee_name || r.department_name || 'Company'}</div>
                    <div className="text-xs text-slate-500">{r.scope}</div>
                  </td>
                  <td className="table-cell">{lakhs(r.target_value)}</td>
                  <td className="table-cell font-medium">{lakhs(r.won_value)}</td>
                  <td className="table-cell min-w-[130px]">
                    <div className="flex items-center gap-2">
                      <ProgressBar value={r.achievement_pct} color={r.achievement_pct >= 100 ? 'bg-green-500' : r.achievement_pct >= 50 ? 'bg-yellow-500' : 'bg-red-500'} />
                      <span className="text-xs">{pct(r.achievement_pct)}</span>
                    </div>
                  </td>
                  <td className="table-cell">{lakhs(r.gap)}</td>
                  <td className="table-cell">{lakhs(r.pipeline_weighted)} / {lakhs(r.pipeline_unweighted)}</td>
                  <td className="table-cell">
                    <span className={r.coverage_actual !== null && r.coverage_actual < r.coverage_required ? 'font-medium text-red-600' : 'text-green-700'}>
                      {r.coverage_actual === null ? '—' : `${r.coverage_actual}x`}
                    </span>
                    <span className="text-xs text-slate-400"> / {r.coverage_required}x</span>
                  </td>
                  <td className="table-cell">{lakhs(r.forecast)}</td>
                  <td className="table-cell text-xs">
                    {r.calls} calls · {r.meetings} mtgs · {r.proposals_sent} props
                    <div className="text-slate-400">{r.qualified_leads} qualified leads</div>
                  </td>
                  <td className="table-cell">{pct(r.win_rate)}</td>
                  <td className="table-cell">{inr(r.incentive_earned)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export default function Targets() {
  const [tab, setTab] = useState('achievement');
  return (
    <div className="space-y-4">
      <div className="card px-3">
        <Tabs active={tab} onChange={setTab} tabs={[{ key: 'achievement', label: 'Target vs Achievement' }, { key: 'manage', label: 'Manage Targets' }]} />
        {tab === 'achievement' && (
          <div className="p-4">
            <Achievement />
          </div>
        )}
      </div>
      {tab === 'manage' && (
        <CrudPage
          title="Targets"
          endpoint="/targets"
          module="targets"
          addLabel="Set Target"
          exportName="targets"
          filters={[
            { name: 'scope', label: 'All Scopes', options: toOptions(['Company', 'Department', 'Employee']) },
            { name: 'period_type', label: 'All Periods', options: toOptions(['Monthly', 'Quarterly', 'Annual']) },
            { name: 'employee_id', label: 'All Employees', lookup: 'employees', labelKey: 'full_name' },
          ]}
          columns={[
            { key: 'period_type', label: 'Period' },
            { key: 'period_start', label: 'From', render: (r) => fmtDate(r.period_start) },
            { key: 'period_end', label: 'To', render: (r) => fmtDate(r.period_end) },
            { key: 'scope', label: 'Scope' },
            { key: 'employee_name', label: 'For', render: (r) => r.employee_name || r.department_name || 'Company', exportValue: (r) => r.employee_name || r.department_name || 'Company' },
            { key: 'target_value', label: 'Target', render: (r) => inr(r.target_value) },
            { key: 'coverage_multiple', label: 'Coverage', render: (r) => `${Number(r.coverage_multiple)}x` },
            { key: 'incentive_pct', label: 'Incentive %', render: (r) => pct(r.incentive_pct) },
          ]}
          defaults={{ period_type: 'Monthly', scope: 'Employee', coverage_multiple: 5 }}
          fields={[
            { name: 'period_type', label: 'Period Type', type: 'select', options: toOptions(['Monthly', 'Quarterly', 'Annual']), allowEmpty: false },
            { name: 'scope', label: 'Scope', type: 'select', options: toOptions(['Company', 'Department', 'Employee']), allowEmpty: false },
            { name: 'period_start', label: 'Period Start', type: 'date', required: true },
            { name: 'period_end', label: 'Period End', type: 'date', required: true },
            { name: 'employee_id', label: 'Employee', type: 'select', lookup: 'employees', labelKey: 'full_name', hidden: (v) => v.scope !== 'Employee' },
            { name: 'department_id', label: 'Department', type: 'select', lookup: 'departments', hidden: (v) => v.scope !== 'Department' },
            { name: 'target_value', label: 'Target Value (₹)', type: 'number', required: true },
            { name: 'coverage_multiple', label: 'Pipeline Coverage Target (x)', type: 'number', step: '0.5' },
            { name: 'activity_target_calls', label: 'Calls Target', type: 'number' },
            { name: 'activity_target_meetings', label: 'Meetings Target', type: 'number' },
            { name: 'activity_target_proposals', label: 'Proposals Target', type: 'number' },
            { name: 'incentive_pct', label: 'Incentive % on Won', type: 'number', step: '0.1' },
            { name: 'notes', label: 'Notes', type: 'textarea' },
          ]}
          toPayload={(v) => {
            const out = { ...v };
            ['employee_name', 'department_name', 'created_at', 'updated_at', 'created_by', 'id'].forEach((k) => delete out[k]);
            if (out.scope !== 'Employee') out.employee_id = null;
            if (out.scope !== 'Department') out.department_id = null;
            return out;
          }}
        />
      )}
    </div>
  );
}
