import { useState } from 'react';
import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import ReportTable from './ReportTable';
import { inr, pct } from '../../../utils/format';

const DEPTS = [
  { code: 'BD', label: 'Business Development' },
  { code: 'CS', label: 'Client Servicing' },
  { code: 'OPS', label: 'Operations & Production' },
  { code: 'CRE', label: 'Creative' },
  { code: 'FIN', label: 'Finance' },
  { code: 'MKT', label: 'Marketing' },
];

const money = (k) => (r) => inr(r[k]);
const percent = (k) => (r) => pct(r[k]);

const COLS = {
  BD: [['target', 'Target', money('target')], ['won_business', 'Won', money('won_business')], ['weighted_pipeline', 'Weighted Pipeline', money('weighted_pipeline')], ['unweighted_pipeline', 'Unweighted', money('unweighted_pipeline')], ['qualified_leads', 'Qualified Leads'], ['meetings', 'Meetings'], ['proposals', 'Proposals'], ['conversion_pct', 'Conversion', percent('conversion_pct')], ['overdue_followups', 'Overdue F/U'], ['forecast', 'Forecast', money('forecast')]],
  CS: [['active_projects', 'Active Projects'], ['client_approvals_pending', 'Approvals Pending'], ['milestone_adherence_pct', 'Milestone Adherence', percent('milestone_adherence_pct')], ['escalations', 'Escalations'], ['client_satisfaction', 'Client Satisfaction (/5)'], ['repeat_opportunities', 'Repeat Opportunities']],
  OPS: [['active_projects', 'Active Projects'], ['project_readiness_pct', 'Readiness', percent('project_readiness_pct')], ['on_time_task_pct', 'On-time Tasks', percent('on_time_task_pct')], ['budget_adherence_pct', 'Budget Adherence', percent('budget_adherence_pct')], ['incidents', 'Incidents'], ['projects_closed', 'Projects Closed']],
  CRE: [['briefs_assigned', 'Briefs Assigned'], ['concepts_delivered', 'Delivered'], ['revision_comments', 'Revision Comments'], ['avg_turnaround_days', 'Avg Turnaround (days)'], ['deadlines_met_pct', 'Deadlines Met', percent('deadlines_met_pct')], ['overdue', 'Overdue']],
  FIN: [['invoices_raised', 'Invoices Raised'], ['invoiced_value', 'Invoiced', money('invoiced_value')], ['collections', 'Collections', money('collections')], ['overdue_receivables', 'Overdue Receivables', money('overdue_receivables')], ['vendor_payments', 'Vendor Payments', money('vendor_payments')], ['financial_closures', 'Financial Closures']],
  MKT: [['spend', 'Spend', money('spend')], ['leads', 'Leads'], ['qualified_leads', 'Qualified'], ['opportunities', 'Opportunities'], ['won_revenue', 'Won Revenue', money('won_revenue')], ['cost_per_lead', 'Cost per Lead', (r) => (r.cost_per_lead === null ? 'N/A' : inr(r.cost_per_lead))]],
};

export default function ScorecardReport({ filters }) {
  const [dept, setDept] = useState('BD');
  const { data, loading } = useFetch('/reports/scorecards', { ...filters, department: dept });
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        {DEPTS.map((d) => (
          <button key={d.code} onClick={() => setDept(d.code)} className={`rounded-full border px-3 py-1 text-xs font-medium ${dept === d.code ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600'}`}>
            {d.label}
          </button>
        ))}
      </div>
      {loading && !data ? (
        <Loader />
      ) : (
        data && (
          <ReportTable
            title={`${DEPTS.find((d) => d.code === dept).label} Scorecard`}
            exportName={`scorecard_${dept.toLowerCase()}`}
            filters={filters}
            rows={data.rows}
            columns={[{ key: 'employee', label: 'Employee' }, { key: 'role', label: 'Role' }, ...COLS[dept].map(([key, label, render]) => ({ key, label, render }))]}
          />
        )
      )}
    </div>
  );
}
