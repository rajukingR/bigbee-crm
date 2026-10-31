import EmptyState from './EmptyState';
import Loader from './Loader';

/**
 * columns: [{ key, label, render?: (row, index) => node, align?: 'right'|'center', className? }]
 * variant: 'default' (dashboard tables) | 'master' (centered headers like Employee Master)
 */
export default function DataTable({ columns, rows, loading, emptyText = 'No data available', onRowClick, variant = 'default', rowKey = 'id', startIndex = 0, rowClass }) {
  const master = variant === 'master';
  const align = (c) => (c.align === 'right' ? 'text-right' : c.align === 'center' || master ? 'text-center' : 'text-left');
  return (
    <div className={`overflow-x-auto ${master ? 'rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]' : ''}`}>
      <table className="min-w-full">
        <thead className={master ? 'border-b border-slate-200' : 'border-b border-line'}>
          <tr>
            {columns.map((c) => (
              <th
                key={c.key || c.label}
                className={
                  master
                    ? `whitespace-nowrap px-4 py-4 text-[14px] font-normal text-slate-800 ${align(c)}`
                    : `table-head ${align(c)}`
                }
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading ? (
            <tr>
              <td colSpan={columns.length}>
                <Loader />
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className={master ? 'py-3 text-center text-[14px] text-slate-800' : ''}>
                {master ? emptyText : <EmptyState text={emptyText} />}
              </td>
            </tr>
          ) : (
            rows.map((r, i) => (
              <tr
                key={r[rowKey] ?? i}
                onClick={onRowClick ? () => onRowClick(r) : undefined}
                className={`border-b border-line last:border-0 ${onRowClick ? 'cursor-pointer hover:bg-slate-50' : ''} ${rowClass ? rowClass(r) : ''}`}
              >
                {columns.map((c) => (
                  <td key={c.key || c.label} className={`table-cell ${align(c)} ${c.className || ''} ${master ? 'text-[14px]' : ''}`}>
                    {c.render ? c.render(r, startIndex + i) : r[c.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
