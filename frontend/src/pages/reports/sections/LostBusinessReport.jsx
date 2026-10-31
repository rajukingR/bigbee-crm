import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend } from 'recharts';
import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import ReportTable from './ReportTable';
import { inr, fmtDate } from '../../../utils/format';

const COLORS = ['#ff4400', '#f97316', '#eab308', '#64748b', '#0ea5e9', '#8b5cf6', '#22c55e', '#ef4444'];
const g = (label) => [
  { key: 'name', label },
  { key: 'count', label: 'Count' },
  { key: 'value', label: 'Lost Value', render: (r) => inr(r.value) },
];

export default function LostBusinessReport({ filters }) {
  const { data, loading } = useFetch('/reports/lost-business', filters);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-2 text-sm font-semibold">Lost Value by Reason</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={data.by_reason.map((r) => ({ ...r, value: Number(r.value) }))} dataKey="value" nameKey="name" innerRadius={55} outerRadius={95}>
                  {data.by_reason.map((r, i) => <Cell key={r.name} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(v) => inr(v)} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>
        <ReportTable title="By Reason" exportName="lost_by_reason" filters={filters} rows={data.by_reason} columns={g('Reason')} />
        <ReportTable title="By Competitor" exportName="lost_by_competitor" filters={filters} rows={data.by_competitor} columns={g('Competitor')} />
        <ReportTable title="By Lead Source" exportName="lost_by_source" filters={filters} rows={data.by_source} columns={g('Source')} />
        <ReportTable title="By Industry" exportName="lost_by_industry" filters={filters} rows={data.by_industry} columns={g('Industry')} />
        <ReportTable title="By Service Line" exportName="lost_by_service" filters={filters} rows={data.by_service} columns={g('Service')} />
        <ReportTable title="By Owner" exportName="lost_by_owner" filters={filters} rows={data.by_owner} columns={g('Owner')} />
      </div>
      <ReportTable
        title="Lost Opportunities"
        exportName="lost_opportunities"
        filters={filters}
        rows={data.rows}
        columns={[
          { key: 'opp_code', label: 'ID' },
          { key: 'title', label: 'Opportunity' },
          { key: 'company', label: 'Client' },
          { key: 'lost_value', label: 'Lost Value', render: (r) => inr(r.lost_value) },
          { key: 'reason', label: 'Reason' },
          { key: 'competitor', label: 'Competitor' },
          { key: 'owner', label: 'Owner' },
          { key: 'lost_on', label: 'Lost On', render: (r) => fmtDate(r.lost_on) },
        ]}
      />
    </div>
  );
}
