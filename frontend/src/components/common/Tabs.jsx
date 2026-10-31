export default function Tabs({ tabs, active, onChange }) {
  return (
    <div className="flex gap-1 overflow-x-auto border-b border-line">
      {tabs
        .filter((t) => !t.hidden)
        .map((t) => (
          <button
            key={t.key}
            onClick={() => onChange(t.key)}
            className={`whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition ${
              active === t.key ? 'border-brand text-brand' : 'border-transparent text-slate-500 hover:text-ink'
            }`}
          >
            {t.label}
            {t.count !== undefined && <span className="ml-1.5 rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{t.count}</span>}
          </button>
        ))}
    </div>
  );
}
