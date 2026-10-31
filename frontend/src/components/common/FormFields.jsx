import { useLookups } from '../../context/LookupContext';
import useRemoteOptions from '../../hooks/useRemoteOptions';

export function Field({ label, required, help, error, children, className = '' }) {
  return (
    <div className={className}>
      {label && (
        <label className="label">
          {label}
          {required && <span className="text-red-500"> *</span>}
        </label>
      )}
      {children}
      {help && !error && <p className="mt-1 text-[11px] text-slate-400">{help}</p>}
      {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
    </div>
  );
}

export function Input(props) {
  return <input {...props} className={`input ${props.className || ''}`} value={props.value ?? ''} />;
}

export function Textarea(props) {
  return <textarea rows={3} {...props} className={`input ${props.className || ''}`} value={props.value ?? ''} />;
}

export function Select({ options = [], placeholder = 'Select…', allowEmpty = true, ...props }) {
  return (
    <select {...props} value={props.value ?? ''} className={`input pr-8 ${props.className || ''}`}>
      {allowEmpty && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={`${o.value}`} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function Checkbox({ label, checked, onChange, disabled }) {
  return (
    <label className="inline-flex cursor-pointer items-center gap-2 text-sm text-slate-700">
      <input type="checkbox" className="h-4 w-4 rounded border-slate-300 accent-brand" checked={!!Number(checked) || checked === true} onChange={(e) => onChange(e.target.checked ? 1 : 0)} disabled={disabled} />
      {label}
    </label>
  );
}

/** Select whose options come from lookups (masters / employees / departments / roles). */
function LookupSelect({ lookup, labelKey = 'name', filter, ...props }) {
  const { lookups } = useLookups();
  let rows = lookups[lookup] || [];
  if (filter) rows = rows.filter(filter);
  const options = rows.map((r) => ({ value: r.id, label: typeof labelKey === 'function' ? labelKey(r) : r[labelKey] }));
  return <Select options={options} {...props} />;
}

/** Select whose options come from an API list endpoint. */
function RemoteSelect({ remote, values, ...props }) {
  const params = remote.params ? remote.params(values || {}) : {};
  const enabled = remote.enabledIf ? remote.enabledIf(values || {}) : true;
  const { options, loading } = useRemoteOptions(remote.endpoint, { label: remote.label, params, enabled });
  return <Select options={options} placeholder={loading ? 'Loading…' : props.placeholder || 'Select…'} {...props} />;
}

/**
 * Render a list of field definitions.
 * field: { name, label, type, options, lookup, remote, required, col:'full', hidden(values), disabled, help, placeholder }
 */
export function FormRenderer({ fields, values, onChange, errors = {} }) {
  const set = (name) => (e) => onChange(name, e && e.target ? e.target.value : e);
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
      {fields.map((f) => {
        if (f.hidden && f.hidden(values)) return null;
        if (f.type === 'section') {
          return (
            <div key={f.label} className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500 sm:col-span-2">
              {f.label}
            </div>
          );
        }
        const common = {
          name: f.name,
          value: values[f.name],
          onChange: set(f.name),
          disabled: typeof f.disabled === 'function' ? f.disabled(values) : f.disabled,
          placeholder: f.placeholder,
          required: f.required,
        };
        let control;
        switch (f.type) {
          case 'textarea':
            control = <Textarea {...common} rows={f.rows || 3} />;
            break;
          case 'select':
            if (f.lookup) control = <LookupSelect {...common} lookup={f.lookup} labelKey={f.labelKey} filter={f.filter ? (r) => f.filter(r, values) : undefined} />;
            else if (f.remote) control = <RemoteSelect {...common} remote={f.remote} values={values} />;
            else control = <Select {...common} options={f.options || []} allowEmpty={f.allowEmpty !== false} />;
            break;
          case 'checkbox':
            control = <Checkbox label={f.checkboxLabel || f.label} checked={values[f.name]} onChange={(v) => onChange(f.name, v)} disabled={common.disabled} />;
            break;
          case 'date':
            control = <Input {...common} type="date" value={values[f.name] ? String(values[f.name]).slice(0, 10) : ''} />;
            break;
          case 'datetime':
            control = <Input {...common} type="datetime-local" value={values[f.name] ? String(values[f.name]).replace(' ', 'T').slice(0, 16) : ''} />;
            break;
          case 'file':
            control = (
              <input
                type="file"
                accept={f.accept || 'image/*,application/pdf'}
                onChange={(e) => onChange(f.name, e.target.files[0] || null)}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-brand-50 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand"
              />
            );
            break;
          case 'color':
            control = <Input {...common} type="color" className="h-10 p-1" />;
            break;
          case 'custom':
            control = f.render(values, onChange);
            break;
          default:
            control = <Input {...common} type={f.type || 'text'} step={f.step} min={f.min} max={f.max} />;
        }
        return (
          <Field
            key={f.name}
            label={f.type === 'checkbox' ? null : f.label}
            required={f.required}
            help={f.help}
            error={errors[f.name]}
            className={f.col === 'full' || f.type === 'textarea' ? 'sm:col-span-2' : ''}
          >
            {control}
          </Field>
        );
      })}
    </div>
  );
}
