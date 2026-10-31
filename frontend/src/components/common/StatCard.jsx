import { LuArrowUp, LuArrowDown } from 'react-icons/lu';

/** KPI card from the reference dashboard: label, big value, orange icon tile, change %. */
export default function StatCard({ label, value, icon: Icon, change, sub, onClick, invert = false }) {
  const hasChange = change !== null && change !== undefined;
  const up = Number(change) >= 0;
  const good = invert ? !up : up;
  return (
    <div className={`card p-5 ${onClick ? 'cursor-pointer hover:border-brand/40' : ''}`} onClick={onClick}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-light text-slate-500">{label}</div>
          <div className="mt-2 truncate text-[22px] font-semibold text-ink">{value}</div>
        </div>
        {Icon && (
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-accent text-white">
            <Icon size={20} />
          </span>
        )}
      </div>
      <div className="mt-3 h-4 text-[11px]">
        {hasChange ? (
          <span className={`inline-flex items-center gap-0.5 ${good ? 'text-green-600' : 'text-red-600'}`}>
            {up ? <LuArrowUp size={11} /> : <LuArrowDown size={11} />}
            {Math.abs(Number(change)).toFixed(2).replace(/\.00$/, '')}%
          </span>
        ) : (
          sub && <span className="text-slate-500">{sub}</span>
        )}
      </div>
    </div>
  );
}
