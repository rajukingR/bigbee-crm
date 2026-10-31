import { LuDownload } from 'react-icons/lu';
import { useAuth } from '../../../context/AuthContext';
import { exportCsv } from '../../../utils/exportCsv';

/** Small table with title and CSV export used by every report section. */
export default function ReportTable({ title, columns, rows, exportName, filters }) {
  const { can } = useAuth();
  return (
    <div className="card">
      <div className="flex items-center justify-between px-5 pt-4">
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
        {can('reports', 'export') && exportName && rows.length > 0 && (
          <button className="btn-outline btn-sm" onClick={() => exportCsv(exportName, columns, rows, { module: 'reports', filters })}>
            <LuDownload size={13} /> Excel / CSV
          </button>
        )}
      </div>
      <div className="overflow-x-auto p-2">
        <table className="min-w-full">
          <thead className="border-b border-line">
            <tr>{columns.map((c) => <th key={c.key} className={`table-head ${c.align === 'right' ? 'text-right' : ''}`}>{c.label}</th>)}</tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={columns.length} className="py-6 text-center text-sm text-slate-400">No data for the selected filters</td></tr>}
            {rows.map((r, i) => (
              <tr key={r.id || i} className="border-b border-line">
                {columns.map((c) => <td key={c.key} className={`table-cell ${c.align === 'right' ? 'text-right' : ''}`}>{c.render ? c.render(r) : r[c.key] ?? '—'}</td>)}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
