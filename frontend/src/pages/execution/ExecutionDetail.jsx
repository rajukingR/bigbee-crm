import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuSave } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Tabs from '../../components/common/Tabs';
import Badge from '../../components/common/Badge';
import CrudPage from '../../components/common/CrudPage';
import Attachments from '../../components/common/Attachments';
import { Select } from '../../components/common/FormFields';
import { fmtDate, fmtDateTime } from '../../utils/format';
import { EXEC_CATEGORIES, EXEC_STATUSES, SEVERITIES, PROJECT_STATUSES, toOptions } from '../../utils/constants';

export default function ExecutionDetail() {
  const { id } = useParams();
  const { can } = useAuth();
  const { data, loading, reload } = useFetch(`/projects/${id}`);
  const [tab, setTab] = useState('plan');
  const [day, setDay] = useState(null);
  if (loading && !data) return <Loader />;
  if (!data) return null;
  const p = data;
  const dayValues = day || { status: p.status, event_day_status: p.event_day_status || '' };

  const saveDay = async () => {
    try {
      await api.put(`/projects/${id}`, dayValues);
      toast.success('Event status updated');
      setDay(null);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const itemFields = [
    { name: 'category', label: 'Category', type: 'select', options: toOptions(EXEC_CATEGORIES), allowEmpty: false },
    { name: 'item', label: 'Item / Activity', required: true },
    { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
    { name: 'vendor_id', label: 'Vendor (dependency)', type: 'select', remote: { endpoint: '/vendors', label: (r) => r.name } },
    { name: 'due_date', label: 'Due / Time', type: 'datetime' },
    { name: 'status', label: 'Status', type: 'select', options: toOptions(EXEC_STATUSES), allowEmpty: false },
    { name: 'details', label: 'Details (venue, run-of-show slot, logistics, manpower, equipment…)', type: 'textarea' },
    { name: 'remarks', label: 'Remarks', col: 'full' },
  ];
  const incidentFields = [
    { name: 'incident_type', label: 'Type', type: 'select', options: toOptions(['Incident', 'Last-minute Change', 'Completion Note']), allowEmpty: false },
    { name: 'severity', label: 'Severity', type: 'select', options: toOptions(SEVERITIES), allowEmpty: false },
    { name: 'title', label: 'Title', required: true, col: 'full' },
    { name: 'occurred_at', label: 'When', type: 'datetime' },
    { name: 'description', label: 'Description', type: 'textarea' },
    { name: 'action_taken', label: 'Action Taken', type: 'textarea' },
  ];

  return (
    <div>
      <PageHeader
        back="/execution"
        title={`${p.project_code} · ${p.name}`}
        subtitle={`${p.company_name || ''} · Event ${fmtDate(p.event_start)} · ${p.location || p.city || ''} · Ops: ${p.ops_owner_name || '—'}`}
        badge={<Badge>{p.status}</Badge>}
        actions={<Link className="btn-outline" to={`/projects/${p.id}`}>Open Project</Link>}
      />

      {can('projects', 'edit') && (
        <div className="card mb-5 flex flex-wrap items-end gap-3 p-4">
          <div>
            <label className="label">Project Status</label>
            <Select className="!w-48" allowEmpty={false} value={dayValues.status} onChange={(e) => setDay({ ...dayValues, status: e.target.value })} options={toOptions(PROJECT_STATUSES)} />
          </div>
          <div className="min-w-[260px] flex-1">
            <label className="label">Event-day Status</label>
            <input className="input" value={dayValues.event_day_status} onChange={(e) => setDay({ ...dayValues, event_day_status: e.target.value })} placeholder="e.g. Setup 80% done, sound check at 4 PM" />
          </div>
          <button className="btn-primary" onClick={saveDay} disabled={!day}>
            <LuSave size={15} /> Update
          </button>
        </div>
      )}

      <div className="card">
        <div className="px-3">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'plan', label: 'Execution Plan & Checklist' },
              { key: 'incidents', label: 'Incidents & Changes' },
              { key: 'docs', label: 'Floor Plans, Riders & Photos' },
            ]}
          />
        </div>
        <div className="p-5">
          {tab === 'plan' && (
            <CrudPage
              title="Execution items"
              endpoint="/execution-items"
              module="execution"
              addLabel="Add Item"
              exportName={`execution_${p.project_code}`}
              initialFilters={{ project_id: p.id }}
              defaults={{ project_id: p.id, category: 'Production', status: 'Pending' }}
              filters={[
                { name: 'category', label: 'All Categories', options: toOptions(EXEC_CATEGORIES) },
                { name: 'status', label: 'All Status', options: toOptions(EXEC_STATUSES) },
              ]}
              fields={itemFields}
              toPayload={(v) => ({ ...Object.fromEntries(itemFields.map((f) => [f.name, v[f.name]])), project_id: p.id })}
              showSerial={false}
              columns={[
                { key: 'category', label: 'Category', render: (r) => <span className="chip bg-slate-100 text-slate-700">{r.category}</span> },
                { key: 'item', label: 'Item', render: (r) => <div><div className="font-medium text-ink">{r.item}</div>{r.details && <div className="line-clamp-1 text-xs text-slate-500">{r.details}</div>}</div> },
                { key: 'owner_name', label: 'Owner' },
                { key: 'vendor_name', label: 'Vendor', render: (r) => r.vendor_name || '—' },
                { key: 'due_date', label: 'Due', render: (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.due_date)}</span> },
                { key: 'status', label: 'Status', render: (r) => <Badge>{r.status}</Badge> },
              ]}
            />
          )}
          {tab === 'incidents' && (
            <CrudPage
              title="Incidents, last-minute changes & completion notes"
              endpoint="/incidents"
              module="execution"
              addLabel="Log"
              initialFilters={{ project_id: p.id }}
              defaults={{ project_id: p.id, incident_type: 'Incident', severity: 'Low' }}
              fields={incidentFields}
              toPayload={(v) => ({ ...Object.fromEntries(incidentFields.map((f) => [f.name, v[f.name]])), project_id: p.id })}
              showSerial={false}
              columns={[
                { key: 'occurred_at', label: 'When', render: (r) => fmtDateTime(r.occurred_at) },
                { key: 'incident_type', label: 'Type' },
                { key: 'title', label: 'Title', render: (r) => <div><div className="font-medium text-ink">{r.title}</div><div className="line-clamp-1 text-xs text-slate-500">{r.action_taken}</div></div> },
                { key: 'severity', label: 'Severity', render: (r) => <Badge>{r.severity}</Badge> },
                { key: 'reported_by_name', label: 'By' },
              ]}
            />
          )}
          {tab === 'docs' && (
            <Attachments entityType="project" entityId={p.id} docTypes={['Floor Plan', 'Technical Rider', 'Production File', 'Site Photo', 'Permit', 'Run of Show', 'Event Document']} readOnly={!can('execution', 'edit')} />
          )}
        </div>
      </div>
    </div>
  );
}
