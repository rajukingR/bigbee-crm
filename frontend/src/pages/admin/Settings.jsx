import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { LuSave } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';

export default function Settings() {
  const { can } = useAuth();
  const [rows, setRows] = useState(null);
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api
      .get('/settings')
      .then((r) => {
        setRows(r.data);
        setValues(Object.fromEntries(r.data.map((s) => [s.setting_key, s.setting_value])));
      })
      .catch(showError);
  }, []);

  if (!rows) return <Loader />;
  const groups = rows.reduce((a, s) => ({ ...a, [s.setting_group]: [...(a[s.setting_group] || []), s] }), {});

  const save = async () => {
    setSaving(true);
    try {
      await api.put('/settings', { settings: values });
      toast.success('Settings saved');
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">Approval limits, automation rules and defaults. Funnel stages, probabilities, lead sources and other dropdowns are managed under Masters.</p>
        {can('settings', 'edit') && (
          <button className="btn-primary" onClick={save} disabled={saving}>
            <LuSave size={15} /> {saving ? 'Saving…' : 'Save Settings'}
          </button>
        )}
      </div>
      {Object.entries(groups).map(([g, list]) => (
        <div key={g} className="card p-5">
          <h3 className="card-title mb-4">{g}</h3>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {list.map((s) => (
              <div key={s.setting_key}>
                <label className="label">{s.label || s.setting_key}</label>
                <input className="input" value={values[s.setting_key] ?? ''} disabled={!can('settings', 'edit')} onChange={(e) => setValues({ ...values, [s.setting_key]: e.target.value })} />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
