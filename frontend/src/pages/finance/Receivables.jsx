import { Link } from 'react-router-dom';
import { LuDownload } from 'react-icons/lu';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import Badge from '../../components/common/Badge';
import { inr, lakhs, fmtDate } from '../../utils/format';
import { exportCsv } from '../../utils/exportCsv';

const COLS = [
  { key: 'invoice_no', label: 'Invoice' },
  { key: 'company_name', label: 'Client' },
  { key: 'project_code', label: 'Project' },
  { key: 'invoice_date', label: 'Invoice Date' },
  { key: 'due_date', label: 'Due Date' },
  { key: 'total_amount', label: 'Total' },
  { key: 'received_amount', label: 'Received' },
  { key: 'outstanding', label: 'Outstanding' },
  { key: 'days_overdue', label: 'Days Overdue' },
  { key: 'bucket', label: 'Ageing Bucket' },
  { key: 'owner_name', label: 'Owner' },
  { key: 'next_follow_up', label: 'Next Collection Action' },
];

export default function Receivables() {
  const { can } = useAuth();
  const { data, loading } = useFetch('/finance/receivables');
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const buckets = Object.entries(data.buckets);
  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-6">
        <div className="card p-4">
          <div className="text-xs text-slate-500">Total Outstanding</div>
          <div className="mt-1 text-lg font-semibold">{lakhs(data.total)}</div>
        </div>
        {buckets.map(([b, v]) => (
          <div key={b} className="card p-4">
            <div className="text-xs text-slate-500">{b === 'Not due' ? 'Not yet due' : `${b} days`}</div>
            <div className={`mt-1 text-lg font-semibold ${b !== 'Not due' && v > 0 ? 'text-red-600' : ''}`}>{lakhs(v)}</div>
          </div>
        ))}
      </div>
      <div className="card">
        <div className="flex items-center justify-between border-b border-line px-5 py-4">
          <span className="text-[15px]">Receivables & Collections</span>
          {can('invoices', 'export') && (
            <button className="btn-outline !py-1.5" onClick={() => exportCsv('receivables_ageing', COLS, data.rows, { module: 'profitability' })}>
              <LuDownload size={14} /> Export
            </button>
          )}
        </div>
        <div className="overflow-x-auto p-2">
          <table className="min-w-full">
            <thead className="border-b border-line">
              <tr>{['Invoice', 'Client / Project', 'Due Date', 'Total', 'Received', 'Outstanding', 'Ageing', 'Owner', 'Next Action'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
            </thead>
            <tbody>
              {data.rows.map((r) => (
                <tr key={r.id} className="border-b border-line">
                  <td className="table-cell font-medium">{r.invoice_no}<div className="text-xs text-slate-500">{fmtDate(r.invoice_date)}</div></td>
                  <td className="table-cell">{r.company_name}<div className="text-xs"><Link className="link" to={`/projects/${r.project_id}`}>{r.project_code}</Link></div></td>
                  <td className="table-cell">{fmtDate(r.due_date)}</td>
                  <td className="table-cell">{inr(r.total_amount)}</td>
                  <td className="table-cell">{inr(r.received_amount)}</td>
                  <td className="table-cell font-medium">{inr(r.outstanding)}</td>
                  <td className="table-cell"><Badge>{r.bucket === 'Not due' ? 'Not due' : 'Overdue'}</Badge> <span className="text-xs">{r.bucket}{r.days_overdue ? ` (${r.days_overdue}d)` : ''}</span></td>
                  <td className="table-cell">{r.owner_name || '—'}</td>
                  <td className="table-cell">{fmtDate(r.next_follow_up)}</td>
                </tr>
              ))}
              {data.rows.length === 0 && <tr><td colSpan={9} className="py-8 text-center text-sm text-slate-400">No outstanding invoices 🎉</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
