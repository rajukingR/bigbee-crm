import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useLookups } from '../../context/LookupContext';
import { Select } from '../../components/common/FormFields';
import SalesFunnelReport from './sections/SalesFunnelReport';
import LeadActivityReport from './sections/LeadActivityReport';
import ProjectStatusReport from './sections/ProjectStatusReport';
import LostBusinessReport from './sections/LostBusinessReport';
import ScorecardReport from './sections/ScorecardReport';
import VendorCommitmentsReport from './sections/VendorCommitmentsReport';
import { Achievement } from '../crm/Targets';
import Profitability from '../finance/Profitability';
import Receivables from '../finance/Receivables';
import MarketingROI from '../marketing/MarketingROI';

const today = () => new Date().toISOString().slice(0, 10);
const PRESETS = {
  day: () => [today(), today()],
  week: () => {
    const d = new Date();
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return [d.toISOString().slice(0, 10), today()];
  },
  month: () => [`${today().slice(0, 7)}-01`, today()],
  quarter: () => {
    const d = new Date();
    const q = Math.floor(d.getMonth() / 3) * 3;
    return [`${d.getFullYear()}-${String(q + 1).padStart(2, '0')}-01`, today()];
  },
  year: () => [`${new Date().getFullYear()}-01-01`, today()],
};

export default function Reports() {
  const { can } = useAuth();
  const { lookups } = useLookups();
  const [tab, setTab] = useState('funnel');
  const [preset, setPreset] = useState('year');
  const [f, setF] = useState({ from: PRESETS.year()[0], to: today(), department_id: '', owner_id: '' });

  const REPORTS = [
    { key: 'funnel', label: 'Sales Funnel', show: true },
    { key: 'targets', label: 'Target Achievement', show: can('targets') || can('reports') },
    { key: 'activity', label: 'Lead Activity', show: true },
    { key: 'projects', label: 'Project Status', show: true },
    { key: 'profit', label: 'Project Profitability', show: can('profitability') },
    { key: 'receivables', label: 'Receivables & Collections', show: can('profitability') || can('invoices') },
    { key: 'vendors', label: 'Vendor Commitments', show: can('profitability') || can('purchase_orders') },
    { key: 'marketing', label: 'Marketing ROI', show: can('campaigns') },
    { key: 'lost', label: 'Lost Business', show: true },
    { key: 'scorecards', label: 'Performance Scorecards', show: true },
  ].filter((r) => r.show);

  const usesCommonFilters = ['funnel', 'activity', 'projects', 'lost', 'scorecards', 'vendors'].includes(tab);
  const params = Object.fromEntries(Object.entries(f).filter(([, v]) => v !== ''));

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-[220px_1fr]">
      <div className="card h-fit p-2">
        {REPORTS.map((r) => (
          <button key={r.key} onClick={() => setTab(r.key)} className={`block w-full rounded-md px-3 py-2 text-left text-sm ${tab === r.key ? 'bg-brand text-white' : 'text-slate-700 hover:bg-slate-50'}`}>
            {r.label}
          </button>
        ))}
      </div>
      <div className="min-w-0 space-y-4">
        {usesCommonFilters && (
          <div className="card flex flex-wrap items-center gap-2 p-3">
            <div className="inline-flex rounded-md border border-line p-0.5">
              {[['day', 'Daily'], ['week', 'Weekly'], ['month', 'Monthly'], ['quarter', 'Quarterly'], ['year', 'Yearly']].map(([k, l]) => (
                <button
                  key={k}
                  onClick={() => {
                    const [from, to] = PRESETS[k]();
                    setPreset(k);
                    setF({ ...f, from, to });
                  }}
                  className={`rounded px-2.5 py-1 text-xs ${preset === k ? 'bg-sidebar text-white' : 'text-slate-600'}`}
                >
                  {l}
                </button>
              ))}
            </div>
            <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.from} onChange={(e) => { setPreset(''); setF({ ...f, from: e.target.value }); }} />
            <span className="text-xs text-slate-400">to</span>
            <input type="date" className="input !w-auto !py-1.5 text-[13px]" value={f.to} onChange={(e) => { setPreset(''); setF({ ...f, to: e.target.value }); }} />
            <Select className="!w-48 !py-1.5 text-[13px]" placeholder="All departments" value={f.department_id} onChange={(e) => setF({ ...f, department_id: e.target.value })} options={(lookups.departments || []).map((d) => ({ value: d.id, label: d.name }))} />
            <Select className="!w-48 !py-1.5 text-[13px]" placeholder="All employees" value={f.owner_id} onChange={(e) => setF({ ...f, owner_id: e.target.value })} options={(lookups.employees || []).map((e) => ({ value: e.id, label: e.full_name }))} />
          </div>
        )}
        {tab === 'funnel' && <SalesFunnelReport filters={params} />}
        {tab === 'targets' && <div className="card p-4"><Achievement /></div>}
        {tab === 'activity' && <LeadActivityReport filters={params} />}
        {tab === 'projects' && <ProjectStatusReport filters={params} />}
        {tab === 'profit' && <Profitability />}
        {tab === 'receivables' && <Receivables />}
        {tab === 'vendors' && <VendorCommitmentsReport filters={params} />}
        {tab === 'marketing' && <MarketingROI />}
        {tab === 'lost' && <LostBusinessReport filters={params} />}
        {tab === 'scorecards' && <ScorecardReport filters={params} />}
      </div>
    </div>
  );
}
