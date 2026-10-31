import { useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LuDownload, LuUpload, LuFileSpreadsheet } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import { exportCsv } from '../../utils/exportCsv';

const LABELS = { companies: 'Companies', contacts: 'Contacts', leads: 'Leads & Enquiries', vendors: 'Vendors' };

export default function ImportData() {
  const { can } = useAuth();
  const { data: types } = useFetch('/import/types');
  const [type, setType] = useState('companies');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const input = useRef(null);
  const t = (types || []).find((x) => x.key === type);

  const template = async () => {
    try {
      const res = await api.get(`/import/template/${type}`, { responseType: 'blob' });
      const url = URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${type}_template.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (e) {
      showError(e);
    }
  };

  const upload = async (file) => {
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    setBusy(true);
    setResult(null);
    try {
      const { data } = await api.post(`/import/${type}`, fd);
      setResult(data);
      toast.success(`${data.imported} of ${data.total} rows imported`);
    } catch (e) {
      showError(e);
    } finally {
      setBusy(false);
      if (input.current) input.current.value = '';
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Object.entries(LABELS).map(([k, l]) => (
          <button key={k} onClick={() => { setType(k); setResult(null); }} className={`card flex items-center gap-3 p-4 text-left ${type === k ? 'border-brand ring-2 ring-brand/20' : 'hover:border-brand/40'}`}>
            <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-white"><LuFileSpreadsheet size={18} /></span>
            <span className="text-sm font-medium">{l}</span>
          </button>
        ))}
      </div>

      <div className="card p-5">
        <h3 className="card-title">Import {LABELS[type]}</h3>
        <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm text-slate-600">
          <li>Download the CSV template and fill it in Excel (keep the header row).</li>
          <li>Dropdown values (industry, source, service, category…) must match the Masters exactly. Owners are matched by employee email.</li>
          <li>Save as <b>CSV UTF-8</b> and upload. Duplicates are skipped and reported in the error list.</li>
        </ol>
        {t && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {t.columns.map((c) => (
              <span key={c} className={`chip ${c.endsWith('*') ? 'bg-brand-50 text-brand' : 'bg-slate-100 text-slate-600'}`}>{c}</span>
            ))}
          </div>
        )}
        <div className="mt-5 flex flex-wrap gap-2">
          <button className="btn-outline" onClick={template}><LuDownload size={15} /> Download Template</button>
          {can('import', 'create') && (
            <>
              <input ref={input} type="file" accept=".csv" className="hidden" onChange={(e) => upload(e.target.files[0])} />
              <button className="btn-primary" onClick={() => input.current && input.current.click()} disabled={busy}>
                <LuUpload size={15} /> {busy ? 'Importing…' : 'Upload CSV'}
              </button>
            </>
          )}
        </div>
      </div>

      {result && (
        <div className="card p-5">
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-md bg-slate-50 p-3"><div className="text-xs text-slate-500">Rows</div><div className="text-lg font-semibold">{result.total}</div></div>
            <div className="rounded-md bg-green-50 p-3"><div className="text-xs text-green-700">Imported</div><div className="text-lg font-semibold text-green-700">{result.imported}</div></div>
            <div className="rounded-md bg-red-50 p-3"><div className="text-xs text-red-700">Failed</div><div className="text-lg font-semibold text-red-700">{result.failed}</div></div>
          </div>
          {result.ignored_columns.length > 0 && <p className="mt-3 text-xs text-amber-700">Ignored columns: {result.ignored_columns.join(', ')}</p>}
          {result.errors.length > 0 && (
            <>
              <div className="mt-4 flex items-center justify-between">
                <h4 className="text-sm font-semibold">Error report</h4>
                <button className="btn-outline btn-sm" onClick={() => exportCsv(`${type}_import_errors`, [{ key: 'row', label: 'Row' }, { key: 'error', label: 'Error' }, { key: 'data', label: 'Data', exportValue: (r) => JSON.stringify(r.data) }], result.errors)}>
                  <LuDownload size={13} /> Download errors
                </button>
              </div>
              <div className="mt-2 max-h-80 overflow-y-auto">
                <table className="min-w-full">
                  <thead className="border-b border-line"><tr><th className="table-head">Row</th><th className="table-head">Error</th></tr></thead>
                  <tbody>
                    {result.errors.map((e) => (
                      <tr key={e.row} className="border-b border-line"><td className="table-cell">{e.row}</td><td className="table-cell text-red-600">{e.error}</td></tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
