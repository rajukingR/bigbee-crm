import { useEffect, useRef, useState } from 'react';
import toast from 'react-hot-toast';
import { LuPencil, LuTrash2, LuEye } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import usePagedList from '../../hooks/usePagedList';
import { invalidateOptions } from '../../hooks/useRemoteOptions';
import { exportCsv } from '../../utils/exportCsv';
import DataTable from './DataTable';
import Pagination from './Pagination';
import ListToolbar from './ListToolbar';
import Modal from './Modal';
import ConfirmDialog from './ConfirmDialog';
import { FormRenderer } from './FormFields';

/**
 * Generic list + add/edit modal + delete for a REST resource.
 * Each page passes its own columns / fields so every screen stays in its own file.
 */
export default function CrudPage({
  title,
  endpoint,
  module,
  columns,
  fields = [],
  defaults = {},
  toForm,
  toPayload,
  multipart = false,
  filters = [],
  initialFilters = {},
  addLabel = 'Add',
  variant = 'default',
  rowActions,
  onRowClick,
  viewAction,
  canEditRow = () => true,
  canDeleteRow = () => true,
  exportName,
  modalSize = 'md',
  formTitle,
  afterSave,
  validate,
  showSerial = true,
  toolbarExtra,
  topContent,
  hideAdd = false,
  confirmMessage,
  onAddClick,
  onEditClick,
  reloadKey,
  initialAdd = null,
}) {
  const { can } = useAuth();
  const list = usePagedList(endpoint, { initialFilters, limit: 10 });
  const [form, setForm] = useState(null); // { id?, values }
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [errors, setErrors] = useState({});
  const [forceDup, setForceDup] = useState(false);

  // allow the parent page to trigger a reload by changing reloadKey
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    list.reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reloadKey]);

  // open the add form straight away (e.g. /leads?new=1)
  useEffect(() => {
    if (initialAdd) {
      setForm({ values: { ...(typeof defaults === 'function' ? defaults() : defaults), ...initialAdd } });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const canCreate = can(module, 'create') && !hideAdd;
  const canEdit = can(module, 'edit');
  const canDelete = can(module, 'delete');
  const canExport = can(module, 'export') && exportName;

  const openAdd = () => {
    if (onAddClick) return onAddClick();
    setErrors({});
    setForceDup(false);
    setForm({ values: typeof defaults === 'function' ? defaults() : { ...defaults } });
    return null;
  };
  const openEdit = (row) => {
    if (onEditClick) return onEditClick(row);
    setErrors({});
    setForceDup(false);
    setForm({ id: row.id, row, values: toForm ? toForm(row) : { ...row } });
    return null;
  };

  const save = async () => {
    const v = form.values;
    const errs = {};
    fields.forEach((f) => {
      if (f.required && !(f.hidden && f.hidden(v)) && (v[f.name] === undefined || v[f.name] === null || v[f.name] === '')) errs[f.name] = `${f.label} is required`;
    });
    if (validate) Object.assign(errs, validate(v, form.id) || {});
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      let body = toPayload ? toPayload(v, form.id) : v;
      if (forceDup) body = { ...body, force: 1 };
      if (multipart) {
        const fd = new FormData();
        Object.entries(body).forEach(([k, val]) => {
          if (val === undefined) return;
          if (val instanceof File) fd.append(k, val);
          else fd.append(k, val === null ? '' : val);
        });
        body = fd;
      }
      const res = form.id ? await api.put(`${endpoint}/${form.id}`, body) : await api.post(endpoint, body);
      toast.success(form.id ? 'Updated successfully' : 'Created successfully');
      invalidateOptions(endpoint);
      setForm(null);
      list.reload();
      if (afterSave) afterSave(res.data, !form.id);
    } catch (e) {
      if (e.response && e.response.status === 409 && /duplicate/i.test(e.response.data.message || '')) {
        setForceDup(true);
        toast.error(`${e.response.data.message}. Click Save again to create anyway.`, { duration: 6000 });
      } else showError(e);
    } finally {
      setSaving(false);
    }
  };

  const doDelete = async () => {
    setDeleting(true);
    try {
      await api.delete(`${endpoint}/${toDelete.id}`);
      toast.success('Deleted');
      invalidateOptions(endpoint);
      setToDelete(null);
      list.reload();
    } catch (e) {
      showError(e);
    } finally {
      setDeleting(false);
    }
  };

  const doExport = async () => {
    try {
      const rows = await list.fetchAll();
      exportCsv(exportName, columns, rows, { module, filters: list.filters });
    } catch (e) {
      showError(e);
    }
  };

  const allColumns = [
    ...(showSerial ? [{ key: '__sno', label: 'S.No', render: (r, i) => i + 1, export: false }] : []),
    ...columns.map((c) => (c.render ? { ...c, render: (r, i) => c.render(r, i, { reload: list.reload }) } : c)),
    {
      key: '__actions',
      label: 'Action',
      export: false,
      align: variant === 'master' ? 'center' : 'right',
      render: (r) => (
        <div className={`flex items-center gap-1 ${variant === 'master' ? 'justify-center' : 'justify-end'}`} onClick={(e) => e.stopPropagation()}>
          {rowActions && rowActions(r, { reload: list.reload, openEdit })}
          {viewAction && (
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="View" onClick={() => viewAction(r)}>
              <LuEye size={16} />
            </button>
          )}
          {canEdit && canEditRow(r) && (fields.length > 0 || onEditClick) && (
            <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Edit" onClick={() => openEdit(r)}>
              <LuPencil size={15} />
            </button>
          )}
          {canDelete && canDeleteRow(r) && (
            <button className="rounded p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600" title="Delete" onClick={() => setToDelete(r)}>
              <LuTrash2 size={15} />
            </button>
          )}
        </div>
      ),
    },
  ];

  const body = (
    <>
      <DataTable
        columns={allColumns}
        rows={list.rows}
        loading={list.loading}
        onRowClick={onRowClick}
        variant={variant}
        startIndex={(list.page - 1) * list.limit}
      />
      <Pagination page={list.page} total={list.total} limit={list.limit} onPage={list.setPage} onLimit={(n) => { list.setLimit(n); list.setPage(1); }} />
    </>
  );

  return (
    <div className="space-y-4">
      {topContent && topContent(list)}
      {variant === 'master' ? (
        <>
          <ListToolbar
            title={title}
            search={list.search}
            onSearch={list.setSearch}
            filters={filters}
            filterValues={list.filters}
            onFilter={list.setFilter}
            onExport={canExport ? doExport : null}
            onAdd={canCreate ? openAdd : null}
            addLabel={addLabel}
            extra={toolbarExtra && toolbarExtra(list)}
          />
          {body}
        </>
      ) : (
        <div className="card">
          <div className="border-b border-line px-5 py-4">
            <ListToolbar
              title={title}
              search={list.search}
              onSearch={list.setSearch}
              filters={filters}
              filterValues={list.filters}
              onFilter={list.setFilter}
              onExport={canExport ? doExport : null}
              onAdd={canCreate ? openAdd : null}
              addLabel={addLabel}
              extra={toolbarExtra && toolbarExtra(list)}
            />
          </div>
          <div className="px-2">{body}</div>
        </div>
      )}

      <Modal
        open={!!form}
        onClose={() => setForm(null)}
        size={modalSize}
        title={form ? (formTitle ? formTitle(form) : form.id ? `Edit ${addLabel.replace(/^(Add|Create|New|Raise|Record|Set|Log)\s+/, '')}` : addLabel) : ''}
        footer={
          <>
            <button className="btn-outline" onClick={() => setForm(null)}>
              Cancel
            </button>
            <button className="btn-primary" onClick={save} disabled={saving}>
              {saving ? 'Saving…' : forceDup ? 'Save anyway' : 'Save'}
            </button>
          </>
        }
      >
        {form && (
          <FormRenderer
            fields={fields}
            values={form.values}
            errors={errors}
            onChange={(name, value) =>
              setForm((f) => {
                const field = fields.find((x) => x.name === name);
                let values = { ...f.values, [name]: value };
                if (field && field.onChange) values = field.onChange(values, value) || values;
                return { ...f, values };
              })
            }
          />
        )}
      </Modal>

      <ConfirmDialog
        open={!!toDelete}
        onClose={() => setToDelete(null)}
        onConfirm={doDelete}
        busy={deleting}
        title="Delete record"
        message={confirmMessage ? confirmMessage(toDelete) : 'This record will be permanently deleted. Continue?'}
      />
    </div>
  );
}
