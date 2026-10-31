import { useState } from 'react';
import { Link } from 'react-router-dom';
import { LuDownload, LuSearch } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import { Select } from '../../components/common/FormFields';
import { inr, lakhs, pct } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';
import { PROJECT_STATUSES, toOptions } from '../../utils/constants';

const COLS = [
  { key: 'project_code', label: 'Project' },
  { key: 'name', label: 'Name' },
  { key: 'company_name', label: 'Client' },
  { key: 'status', label: 'Status' },
  { key: 'revised_value', label: 'Approved Value' },
  { key: 'estimated_cost', label: 'Estimated Cost' },
  { key: 'committed_cost', label: 'Committed Cost' },
  { key: 'actual_cost', label: 'Actual Cost' },
  { key: 'estimated_gross_profit', label: 'Est. Gross Profit' },
  { key: 'estimated_margin_pct', label: 'Est. Margin %' },
  { key: 'actual_gross_profit', label: 'Actual Gross Profit' },
  { key: 'actual_margin_pct', label: 'Actual Margin %' },
  { key: 'budget_variance', label: 'Budget Variance' },
  { key: 'invoiced', label: 'Invoiced' },
  { key: 'received', label: 'Collected' },
  { key: 'receivable_outstanding', label: 'Receivable' },
  { key: 'vendor_outstanding', label: 'Vendor Payable' },
  { key: 'flags', label: 'Flags', exportValue: (r) => r.flags.join('; ') },
];

export default function Profitability() {
  const { can } = useAuth();
  const [f, setF] = useState({ status: '', flag: '', from: '', to: '', search: '' });
  const { data, loading } = useFetch('/finance/profitability', f);
  const summary = useFetch('/finance/summary');
  const t = data ? data.totals : {};
  const s = summary.data || {};

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        {[
          ['Pipeline (weighted)', lakhs(s.pipeline_weighted)],
          ['Confirmed Business', lakhs(s.confirmed_business)],
          ['Invoiced', lakhs(s.invoiced)],
          ['Collected (cash)', lakhs(s.collected)],
          ['Receivable', lakhs(s.receivable_outstanding)],
          ['Vendor Payable', lakhs(s.vendor_outstanding)],
        ].map(([l, v]) => (
          <div key={l} className="card p-4">
            <div className="text-xs text-slate-500">{l}</div>
            <div className="mt-1 text-lg font-semibold text-ink">{v}</div>
          </div>
        ))}
      </div>
      <p className="-mt-2 text-xs text-slate-500">Pipeline, confirmed business, invoiced revenue and cash collected are reported separately – the full project value is never counted as cash.</p>

      <div className="card">
        <div className="flex flex-wrap items-center gap-2 border-b border-line px-5 py-4">
          <span className="mr-auto text-[15px]">Project Profitability</span>
          <div className="relative">
            <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input className="input !w-44 !py-1.5 pl-8 text-[13px]" placeholder="Search…" value={f.search} onChange={(e) => setF({ ...f, search: e.target.value })} />
          </div>
          <Select className="!w-40 !py-1.5 text-[13px]" placeholder="All status" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })} options={toOptions(PROJECT_STATUSES)} />
          <Select className="!w-44 !py-1.5 text-[13px]" placeholder="All projects" value={f.flag} onChange={(e) => setF({ ...f, flag: e.target.value })} options={toOptions(['Low margin', 'Low estimated margin', 'Over budget', 'Overdue collection'])} />
          <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.from} onChange={(e) => setF({ ...f, from: e.target.value })} title="Event from" />
          <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.to} onChange={(e) => setF({ ...f, to: e.target.value })} title="Event to" />
          {can('profitability', 'export') && data && (
            <button className="btn-outline !py-1.5" onClick={() => exportCsv('project_profitability', COLS, data.rows, { module: 'profitability', filters: f })}>
              <LuDownload size={14} /> Export
            </button>
          )}
        </div>
        {loading && !data ? (
          <Loader />
        ) : (
          <div className="overflow-x-auto p-2">
            <table className="min-w-full">
              <thead className="border-b border-line">
                <tr>
                  {['Project', 'Approved Value', 'Est. Cost', 'Committed', 'Actual Cost', 'Est. GP / %', 'Actual GP / %', 'Budget Var.', 'Invoiced / Collected', 'Receivable', 'Flags'].map((h) => (
                    <th key={h} className="table-head">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.rows.map((r) => (
                  <tr key={r.id} className="border-b border-line">
                    <td className="table-cell">
                      <Link to={`/projects/${r.id}`} className="link font-medium">{r.project_code}</Link>
                      <div className="text-xs text-slate-500">{r.name}</div>
                    </td>
                    <td className="table-cell">{inr(r.revised_value)}</td>
                    <td className="table-cell">{inr(r.estimated_cost)}</td>
                    <td className="table-cell">{inr(r.committed_cost)}</td>
                    <td className="table-cell">{inr(r.actual_cost)}</td>
                    <td className="table-cell">{inr(r.estimated_gross_profit)}<div className="text-xs text-slate-500">{pct(r.estimated_margin_pct)}</div></td>
                    <td className="table-cell"><span className={r.actual_gross_profit < 0 ? 'text-red-600' : ''}>{inr(r.actual_gross_profit)}</span><div className="text-xs text-slate-500">{pct(r.actual_margin_pct)}</div></td>
                    <td className={`table-cell ${r.budget_variance < 0 ? 'text-red-600' : 'text-green-700'}`}>{inr(r.budget_variance)}</td>
                    <td className="table-cell">{inr(r.invoiced)}<div className="text-xs text-slate-500">{inr(r.received)}</div></td>
                    <td className="table-cell">{inr(r.receivable_outstanding)}</td>
                    <td className="table-cell">{r.flags.length ? r.flags.map((x) => <div key={x}><Badge>{x === 'Over budget' || x === 'Overdue collection' ? 'Overdue' : 'Pending'}</Badge> <span className="text-xs">{x}</span></div>) : <span className="text-xs text-green-700">OK</span>}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && <tr><td colSpan={11} className="py-8 text-center text-sm text-slate-400">No projects</td></tr>}
              </tbody>
              {data.rows.length > 0 && (
                <tfoot className="border-t-2 border-line bg-slate-50 font-medium">
                  <tr>
                    <td className="table-cell">Total</td>
                    <td className="table-cell">{inr(t.revised_value)}</td>
                    <td className="table-cell">{inr(t.estimated_cost)}</td>
                    <td className="table-cell">{inr(t.committed_cost)}</td>
                    <td className="table-cell">{inr(t.actual_cost)}</td>
                    <td className="table-cell">{inr(t.estimated_gross_profit)}<div className="text-xs">{pct(t.estimated_margin_pct)}</div></td>
                    <td className="table-cell">{inr(t.actual_gross_profit)}<div className="text-xs">{pct(t.actual_margin_pct)}</div></td>
                    <td className="table-cell" />
                    <td className="table-cell">{inr(t.invoiced)}<div className="text-xs">{inr(t.received)}</div></td>
                    <td className="table-cell">{inr(t.receivable_outstanding)}</td>
                    <td className="table-cell" />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
