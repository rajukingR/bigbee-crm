import { useState } from 'react';
import { LuEye } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import ExecutiveDashboard from './roles/ExecutiveDashboard';
import BDDashboard from './roles/BDDashboard';
import MarketingDashboard from './roles/MarketingDashboard';
import CSDashboard from './roles/CSDashboard';
import OperationsDashboard from './roles/OperationsDashboard';
import ProcurementDashboard from './roles/ProcurementDashboard';
import CreativeDashboard from './roles/CreativeDashboard';
import FinanceDashboard from './roles/FinanceDashboard';
import HRDashboard from './roles/HRDashboard';

const PAGES = {
  bd: BDDashboard,
  marketing: MarketingDashboard,
  cs: CSDashboard,
  operations: OperationsDashboard,
  procurement: ProcurementDashboard,
  creative: CreativeDashboard,
  finance: FinanceDashboard,
  hr: HRDashboard,
};

const TITLES = {
  executive: 'Company Overview',
  bd: 'Business Development',
  marketing: 'Marketing',
  cs: 'Client Servicing',
  operations: 'Operations & Production',
  procurement: 'Procurement',
  creative: 'Creative',
  finance: 'Accounts & Finance',
  hr: 'HR & Admin',
};

/**
 * Same login for everyone – the backend decides which dashboard a user gets
 * from their department / role. Admin & MD can view any role's dashboard.
 */
export default function Dashboard() {
  const { user } = useAuth();
  const [view, setView] = useState('');
  const [months, setMonths] = useState(6);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const { data, loading } = useFetch('/dashboard', { view: view || undefined, months, month });

  if (loading && !data) return <Loader />;
  if (!data) return null;
  const Page = PAGES[data.type];
  const scopeText = data.scope === 'all' ? 'company-wide data' : data.scope === 'team' ? 'you and your team' : 'your records';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-[15px] font-medium text-ink">{TITLES[data.type]} Dashboard</div>
          <div className="text-xs text-slate-500">
            {user.full_name} · {user.role_name || 'Admin'} · showing {scopeText}
          </div>
        </div>
        {data.views && (
          <label className="flex items-center gap-2 text-[13px] text-slate-600">
            <LuEye size={15} /> View dashboard as
            <select className="rounded-md border border-line bg-white px-2.5 py-1.5 text-[13px]" value={view || data.type} onChange={(e) => setView(e.target.value)}>
              {data.views.map((v) => (
                <option key={v.key} value={v.key}>
                  {v.label}
                  {v.key === data.home ? ' (mine)' : ''}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      {loading && <div className="text-xs text-slate-400">Refreshing…</div>}
      {data.type === 'executive' ? <ExecutiveDashboard d={data} months={months} setMonths={setMonths} month={month} setMonth={setMonth} /> : Page ? <Page d={data} /> : null}
    </div>
  );
}
