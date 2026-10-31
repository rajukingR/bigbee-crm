/** Label / value grid for detail pages. items: [{label, value, full?}] */
export default function DetailGrid({ items, cols = 3 }) {
  const colClass = { 2: 'sm:grid-cols-2', 3: 'sm:grid-cols-2 lg:grid-cols-3', 4: 'sm:grid-cols-2 lg:grid-cols-4' }[cols];
  return (
    <dl className={`grid grid-cols-1 gap-x-6 gap-y-4 ${colClass}`}>
      {items
        .filter((i) => !i.hidden)
        .map((i) => (
          <div key={i.label} className={i.full ? 'sm:col-span-full' : ''}>
            <dt className="text-xs font-medium text-slate-500">{i.label}</dt>
            <dd className="mt-0.5 whitespace-pre-line break-words text-sm text-ink">{i.value === null || i.value === undefined || i.value === '' ? '—' : i.value}</dd>
          </div>
        ))}
    </dl>
  );
}
