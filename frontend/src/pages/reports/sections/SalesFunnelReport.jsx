import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';
import useFetch from '../../../hooks/useFetch';
import Loader from '../../../components/common/Loader';
import ReportTable from './ReportTable';
import { inr, lakhs, pct } from '../../../utils/format';

const groupCols = (k, label) => [
  { key: k, label },
  { key: 'count', label: 'Opportunities' },
  { key: 'value', label: 'Value', render: (r) => inr(r.value) },
  { key: 'won', label: 'Won', render: (r) => Number(r.won) || 0 },
  { key: 'lost', label: 'Lost', render: (r) => Number(r.lost) || 0 },
];

export default function SalesFunnelReport({ filters }) {
  const { data, loading } = useFetch('/reports/sales-funnel', filters);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <div className="card p-5">
          <h3 className="mb-3 text-sm font-semibold">Value by Stage</h3>
          <div className="h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.by_stage}>
                <CartesianGrid stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="stage" tick={{ fontSize: 10 }} interval={0} angle={-20} textAnchor="end" height={60} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => lakhs(v)} />
                <Tooltip formatter={(v) => inr(v)} />
                <Bar dataKey="value" name="Value" fill="#ff4400" radius={[4, 4, 0, 0]} />
                <Bar dataKey="weighted" name="Weighted" fill="#f97316" fillOpacity={0.45} radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <ReportTable
          title="Stage Conversion (reached each stage)"
          exportName="stage_conversion"
          filters={filters}
          rows={data.conversion}
          columns={[
            { key: 'stage', label: 'Stage' },
            { key: 'reached', label: 'Opportunities reached' },
            { key: 'pct', label: '% of funnel', render: (r) => pct(r.pct) },
          ]}
        />
      </div>
      <ReportTable
        title="Funnel by Stage"
        exportName="sales_funnel_by_stage"
        filters={filters}
        rows={data.by_stage}
        columns={[
          { key: 'stage', label: 'Stage' },
          { key: 'count', label: 'Count' },
          { key: 'value', label: 'Unweighted', render: (r) => inr(r.value) },
          { key: 'weighted', label: 'Weighted', render: (r) => inr(r.weighted) },
          { key: 'avg_age_days', label: 'Avg. age in stage (days)' },
        ]}
      />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
        <ReportTable title="By Lead Source" exportName="funnel_by_source" filters={filters} rows={data.by_source} columns={groupCols('source', 'Source')} />
        <ReportTable title="By Owner" exportName="funnel_by_owner" filters={filters} rows={data.by_owner} columns={groupCols('owner', 'Owner')} />
        <ReportTable title="By Industry" exportName="funnel_by_industry" filters={filters} rows={data.by_industry} columns={groupCols('industry', 'Industry')} />
        <ReportTable
          title="Open Pipeline by Expected Close Month"
          exportName="funnel_by_close_month"
          filters={filters}
          rows={data.by_close_month}
          columns={[
            { key: 'month', label: 'Month' },
            { key: 'count', label: 'Opportunities' },
            { key: 'value', label: 'Value', render: (r) => inr(r.value) },
            { key: 'weighted', label: 'Weighted', render: (r) => inr(r.weighted) },
          ]}
        />
      </div>
    </div>
  );
}
