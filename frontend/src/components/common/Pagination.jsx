import { LuChevronLeft, LuChevronRight } from 'react-icons/lu';

export default function Pagination({ page, total, limit, onPage, onLimit }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  const nums = [];
  const start = Math.max(1, Math.min(page - 2, pages - 4));
  for (let i = start; i <= Math.min(pages, start + 4); i++) nums.push(i);
  const from = total ? (page - 1) * limit + 1 : 0;
  const to = Math.min(total, page * limit);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-4">
      <div className="text-xs text-slate-500">
        Showing {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-1.5">
        <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Previous page">
          <LuChevronLeft size={16} />
        </button>
        {nums.map((n) => (
          <button
            key={n}
            onClick={() => onPage(n)}
            className={`flex h-8 min-w-[32px] items-center justify-center rounded-full px-2 text-sm ${n === page ? 'bg-[#1976d2] text-white' : 'text-slate-600 hover:bg-slate-100'}`}
          >
            {n}
          </button>
        ))}
        <button className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100 disabled:opacity-40" disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Next page">
          <LuChevronRight size={16} />
        </button>
      </div>
      {onLimit ? (
        <select className="rounded-md border border-line bg-white px-2 py-1 text-xs" value={limit} onChange={(e) => onLimit(Number(e.target.value))}>
          {[10, 25, 50, 100].map((n) => (
            <option key={n} value={n}>
              {n} / page
            </option>
          ))}
        </select>
      ) : (
        <span />
      )}
    </div>
  );
}
