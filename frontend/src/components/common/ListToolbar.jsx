import { LuSearch, LuDownload, LuPlus } from 'react-icons/lu';
import { Select } from './FormFields';
import { useLookups } from '../../context/LookupContext';
import useRemoteOptions from '../../hooks/useRemoteOptions';

function FilterSelect({ f, value, onChange }) {
  const { lookups } = useLookups();
  const remote = useRemoteOptions(f.remote ? f.remote.endpoint : null, { label: f.remote ? f.remote.label : undefined, enabled: !!f.remote });
  let options = f.options || [];
  if (f.lookup) options = (lookups[f.lookup] || []).map((r) => ({ value: r.id, label: r[f.labelKey || 'name'] }));
  if (f.remote) options = remote.options;
  return (
    <Select
      value={value}
      onChange={(e) => onChange(f.name, e.target.value)}
      options={options}
      placeholder={f.label}
      className="!w-auto min-w-[140px] max-w-[200px] !py-1.5 text-[13px]"
    />
  );
}

/** Search box, filter dropdowns, export and add buttons. */
export default function ListToolbar({ title, search, onSearch, filters = [], filterValues = {}, onFilter, onExport, onAdd, addLabel = 'Add', extra }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {title && <div className="mr-auto text-[15px] text-ink">{title}</div>}
      {!title && <div className="mr-auto" />}
      {filters.map((f) =>
        f.type === 'date' ? (
          <input
            key={f.name}
            type="date"
            title={f.label}
            value={filterValues[f.name] || ''}
            onChange={(e) => onFilter(f.name, e.target.value)}
            className="input !w-auto !py-1.5 text-[13px]"
          />
        ) : (
          <FilterSelect key={f.name} f={f} value={filterValues[f.name]} onChange={onFilter} />
        )
      )}
      {onSearch && (
        <div className="relative">
          <LuSearch className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
          <input value={search} onChange={(e) => onSearch(e.target.value)} placeholder="Search..." className="input !w-48 !py-1.5 pl-8 text-[13px]" />
        </div>
      )}
      {extra}
      {onExport && (
        <button className="btn-outline !py-1.5" onClick={onExport} title="Export to Excel (CSV)">
          <LuDownload size={15} /> Export
        </button>
      )}
      {onAdd && (
        <button className="btn-primary !py-2" onClick={onAdd}>
          <LuPlus size={15} /> {addLabel}
        </button>
      )}
    </div>
  );
}
