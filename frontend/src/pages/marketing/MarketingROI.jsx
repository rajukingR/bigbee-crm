import { useState } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts';
import { LuDownload } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import StatCard from '../../components/common/StatCard';
import { inr, lakhs, num, pct } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { LuMegaphone, LuUsers, LuTarget, LuIndianRupee } from 'react-icons/lu';

const COLS = [
  { key: 'channel_name', label: 'Channel' },
  { key: 'campaigns', label: 'Campaigns' },
  { key: 'actual_spend', label: 'Spend' },
  { key: 'leads', label: 'Leads' },
  { key: 'qualified_leads', label: 'Qualified Leads' },
  { key: 'opportunities', label: 'Opportunities' },
  { key: 'proposal_value', label: 'Proposal Value' },
  { key: 'wins', label: 'Wins' },
  { key: 'won_revenue', label: 'Attributed Won Revenue' },
  { key: 'cost_per_lead', label: 'CPL' },
  { key: 'cost_per_acquisition', label: 'CPA' },
  { key: 'roas', label: 'ROAS' },
  { key: 'roi_pct', label: 'ROI %' },
];

export default function MarketingROI() {
  const { can } = useAuth();
  const [f, setF] = useState({ from: `${new Date().getFullYear()}-01-01`, to: new Date().toISOString().slice(0, 10) });
  const { data, loading } = useFetch('/campaigns/roi', f);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const tot = data.channels.reduce((a, c) => {
    ['actual_spend', 'leads', 'qualified_leads', 'wins', 'won_revenue'].forEach((k) => (a[k] = (a[k] || 0) + Number(c[k] || 0)));
    return a;
  }, {});
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} />
        <span className="text-xs text-slate-400">to</span>
        <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} />
        {can('campaigns', 'export') && (
          <button className="btn-outline ml-auto !py-1.5" onClick={() => exportCsv('marketing_roi', COLS, data.channels, { module: 'campaigns', filters: f })}>
            <LuDownload size={14} /> Export
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Marketing Spend" value={lakhs(tot.actual_spend)} icon={LuMegaphone} />
        <StatCard label="Leads / Qualified" value={`${num(tot.leads)} / ${num(tot.qualified_leads)}`} icon={LuUsers} sub={tot.leads ? `CPL ${inr(tot.actual_spend / tot.leads)}` : 'CPL N/A'} />
        <StatCard label="Wins" value={num(tot.wins)} icon={LuTarget} sub={tot.wins ? `CPA ${inr(tot.actual_spend / tot.wins)}` : 'CPA N/A'} />
        <StatCard label="Attributed Won Revenue" value={lakhs(tot.won_revenue)} icon={LuIndianRupee} sub={tot.actual_spend ? `ROAS ${(tot.won_revenue / tot.actual_spend).toFixed(2)}x` : 'ROAS N/A'} />
      </div>

      <div className="card p-5">
        <h3 className="card-title mb-4">Spend vs Attributed Revenue by Channel</h3>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data.channels}>
              <CartesianGrid stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="channel_name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => lakhs(v)} />
              <Tooltip formatter={(v) => inr(v)} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="actual_spend" name="Spend" fill="#64748b" radius={[4, 4, 0, 0]} />
              <Bar dataKey="won_revenue" name="Won Revenue" fill="#ff4400" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card">
        <div className="px-5 pt-5"><h3 className="card-title">Channel ROI (campaign-attributed)</h3></div>
        <div className="overflow-x-auto p-2">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>{['Channel', 'Campaigns', 'Spend', 'Leads', 'Qualified', 'Opps', 'Proposal Value', 'Wins', 'Won Revenue', 'CPL', 'CPA', 'ROAS', 'ROI'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.channels.map((c) => (
                <tr key={c.channel_name} className="border-b border-line">
                  <td className="table-cell font-medium">{c.channel_name}</td>
                  <td className="table-cell">{c.campaigns}</td>
                  <td className="table-cell">{inr(c.actual_spend)}</td>
                  <td className="table-cell">{c.leads}</td>
                  <td className="table-cell">{c.qualified_leads}</td>
                  <td className="table-cell">{c.opportunities}</td>
                  <td className="table-cell">{inr(c.proposal_value)}</td>
                  <td className="table-cell">{c.wins}</td>
                  <td className="table-cell">{inr(c.won_revenue)}</td>
                  <td className="table-cell">{c.cost_per_lead === null ? 'N/A' : inr(c.cost_per_lead)}</td>
                  <td className="table-cell">{c.cost_per_acquisition === null ? 'N/A' : inr(c.cost_per_acquisition)}</td>
                  <td className="table-cell">{c.roas === null ? 'N/A' : `${c.roas}x`}</td>
                  <td className={`table-cell ${c.roi_pct !== null && c.roi_pct < 0 ? 'text-red-600' : 'text-green-700'}`}>{c.roi_pct === null ? 'N/A' : pct(c.roi_pct)}</td>
                </tr>
              ))}
              {data.channels.length === 0 && <tr><td colSpan={13} className="py-8 text-center text-sm text-slate-400">No campaigns in this period</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="px-5 pt-5">
          <h3 className="card-title">Lead Source Contribution</h3>
          <p className="text-xs text-slate-500">Directly attributable: revenue from opportunities converted from leads of each source.</p>
        </div>
        <div className="overflow-x-auto p-2">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>{['Source', 'Leads', 'Qualified', 'Converted', 'Conversion', 'Won Revenue'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.sources.map((s) => (
                <tr key={s.source_name || 'none'} className="border-b border-line">
                  <td className="table-cell font-medium">{s.source_name || 'Not set'}</td>
                  <td className="table-cell">{s.leads}</td>
                  <td className="table-cell">{Number(s.qualified_leads) || 0}</td>
                  <td className="table-cell">{Number(s.opportunities) || 0}</td>
                  <td className="table-cell">{pct(s.leads ? (Number(s.opportunities) / s.leads) * 100 : 0)}</td>
                  <td className="table-cell">{inr(s.won_revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
