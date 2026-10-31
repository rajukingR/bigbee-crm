import { Fragment, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuSave } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { useLookups } from '../../context/LookupContext';
import Loader from '../../components/common/Loader';
import { Select } from '../../components/common/FormFields';
import { DATA_SCOPES } from '../../utils/constants';

const ACTION_LABELS = { view: 'View', create: 'Create', edit: 'Edit', delete: 'Delete', export: 'Export', approve: 'Approve' };

export default function Permissions() {
  const { can, refresh } = useAuth();
  const { lookups } = useLookups();
  const [params, setParams] = useSearchParams();
  const [meta, setMeta] = useState({ modules: [], actions: [] });
  const [roleId, setRoleId] = useState(params.get('role') || '');
  const [matrix, setMatrix] = useState(null);
  const [role, setRole] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const roles = lookups.roles || [];
  const editable = can('permissions', 'edit');

  useEffect(() => {
    api.get('/permissions/modules').then((r) => setMeta(r.data)).catch(showError);
  }, []);

  useEffect(() => {
    if (!roleId && roles.length) setRoleId(String(roles[0].id));
  }, [roles, roleId]);

  useEffect(() => {
    if (!roleId) return;
    setParams({ role: roleId }, { replace: true });
    setLoading(true);
    api
      .get(`/permissions/role/${roleId}`)
      .then((r) => {
        setMatrix(r.data.permissions);
        setRole(r.data.role);
      })
      .catch(showError)
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roleId]);

  const groups = useMemo(() => {
    const g = {};
    meta.modules.forEach((m) => (g[m.group] = g[m.group] || []).push(m));
    return g;
  }, [meta]);

  const toggle = (module, action) => setMatrix((m) => ({ ...m, [module]: { ...m[module], [action]: !m[module][action] } }));
  const toggleRow = (module) => {
    const allOn = meta.actions.every((a) => matrix[module][a]);
    setMatrix((m) => ({ ...m, [module]: Object.fromEntries(meta.actions.map((a) => [a, !allOn])) }));
  };
  const toggleCol = (action) => {
    const allOn = meta.modules.every((m) => matrix[m.key][action]);
    setMatrix((mx) => {
      const out = { ...mx };
      meta.modules.forEach((m) => (out[m.key] = { ...out[m.key], [action]: !allOn }));
      return out;
    });
  };

  const save = async () => {
    setSaving(true);
    try {
      await api.put(`/permissions/role/${roleId}`, { permissions: matrix });
      toast.success('Permissions saved');
      refresh();
    } catch (e) {
      showError(e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="mr-auto text-[15px] text-ink">Role Permissions</div>
        <Select
          value={roleId}
          onChange={(e) => setRoleId(e.target.value)}
          options={roles.map((r) => ({ value: r.id, label: r.name }))}
          allowEmpty={false}
          className="!w-64"
        />
        {editable && (
          <button className="btn-primary" onClick={save} disabled={saving || !matrix}>
            <LuSave size={15} /> {saving ? 'Saving…' : 'Save Permissions'}
          </button>
        )}
      </div>

      {role && (
        <div className="rounded-md border border-line bg-white px-4 py-3 text-sm text-slate-600">
          <span className="font-medium text-ink">{role.name}</span> · Data visibility:{' '}
          <span className="font-medium">{(DATA_SCOPES.find((d) => d.value === role.data_scope) || {}).label}</span>
          {role.is_system ? <span className="ml-2 text-xs text-slate-400">(system role – full access)</span> : null}
        </div>
      )}

      {loading || !matrix ? (
        <Loader />
      ) : (
        <div className="overflow-x-auto rounded-md bg-white shadow-[0_1px_3px_rgba(0,0,0,0.12)]">
          <table className="min-w-full">
            <thead className="border-b border-slate-200">
              <tr>
                <th className="px-4 py-4 text-left text-[14px] font-normal text-slate-800">Module</th>
                {meta.actions.map((a) => (
                  <th key={a} className="px-3 py-4 text-center text-[14px] font-normal text-slate-800">
                    <button disabled={!editable} onClick={() => toggleCol(a)} className="hover:text-brand">
                      {ACTION_LABELS[a]}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-4 text-center text-[14px] font-normal text-slate-800">All</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(groups).map(([group, mods]) => (
                <Fragment key={group}>
                  <tr className="bg-slate-50">
                    <td colSpan={meta.actions.length + 2} className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {group}
                    </td>
                  </tr>
                  {mods.map((m) => (
                    <tr key={m.key} className="border-b border-line">
                      <td className="px-4 py-2.5 text-sm text-ink">{m.label}</td>
                      {meta.actions.map((a) => (
                        <td key={a} className="px-3 py-2.5 text-center">
                          <input type="checkbox" className="h-4 w-4 accent-brand" checked={!!matrix[m.key][a]} disabled={!editable} onChange={() => toggle(m.key, a)} />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 text-center">
                        <input type="checkbox" className="h-4 w-4 accent-brand" checked={meta.actions.every((a) => matrix[m.key][a])} disabled={!editable} onChange={() => toggleRow(m.key)} />
                      </td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
