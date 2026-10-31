import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuUserCog, LuNotebookPen } from 'react-icons/lu';
import CrudPage from '../../components/common/CrudPage';
import Badge from '../../components/common/Badge';
import Modal from '../../components/common/Modal';
import LogActivityModal from '../../components/common/LogActivityModal';
import { FormRenderer } from '../../components/common/FormFields';
import api, { showError } from '../../api/axios';
import { useAuth } from '../../context/AuthContext';
import { inr, fmtDateTime } from '../../utils/format';
import { PRIORITIES, toOptions } from '../../utils/constants';

export const LEAD_FIELDS = [
  { type: 'section', label: 'Company & Contact' },
  {
    name: 'company_id',
    label: 'Existing Company',
    type: 'select',
    remote: { endpoint: '/companies', label: (r) => `${r.name}${r.city ? ' – ' + r.city : ''}` },
    help: 'Pick an existing company, or leave empty and type a new name',
    onChange: (v) => ({ ...v, contact_id: '' }),
  },
  { name: 'company_name', label: 'New Company Name', hidden: (v) => !!v.company_id, help: 'A company record is created automatically' },
  {
    name: 'contact_id',
    label: 'Existing Contact',
    type: 'select',
    remote: { endpoint: '/contacts', label: (r) => `${r.name}${r.phone ? ' – ' + r.phone : ''}`, params: (v) => ({ company_id: v.company_id }), enabledIf: (v) => !!v.company_id },
    hidden: (v) => !v.company_id,
  },
  { name: 'contact_name', label: 'Contact Person', hidden: (v) => !!v.contact_id },
  { name: 'phone', label: 'Phone', hidden: (v) => !!v.contact_id },
  { name: 'email', label: 'Email', type: 'email', hidden: (v) => !!v.contact_id },
  { name: 'city', label: 'City' },
  { name: 'location', label: 'Location / Venue Area' },
  { type: 'section', label: 'Source' },
  { name: 'lead_type_id', label: 'Lead Type', type: 'select', lookup: 'lead-types', help: 'Outbound = BD · Inbound / Marketing = assigned to BD' },
  { name: 'lead_source_id', label: 'Lead Source', type: 'select', lookup: 'lead-sources', onChange: (v) => ({ ...v, sub_source_id: '' }) },
  { name: 'sub_source_id', label: 'Sub Source', type: 'select', lookup: 'sub-sources', filter: (r, v) => !v.lead_source_id || String(r.source_id) === String(v.lead_source_id) },
  { name: 'campaign_id', label: 'Campaign', type: 'select', remote: { endpoint: '/campaigns', label: (r) => `${r.campaign_code} – ${r.name}` } },
  { type: 'section', label: 'Requirement' },
  { name: 'service_id', label: 'Service Interest', type: 'select', lookup: 'services' },
  { name: 'event_type_id', label: 'Event Type', type: 'select', lookup: 'lead-event-types' },
  { name: 'tentative_event_date', label: 'Tentative Event Date', type: 'date' },
  { name: 'expected_budget', label: 'Expected Budget (₹)', type: 'number', min: 0 },
  { name: 'expected_decision_date', label: 'Expected Decision Date', type: 'date' },
  { name: 'priority', label: 'Priority', type: 'select', options: toOptions(PRIORITIES), allowEmpty: false },
  { name: 'requirement', label: 'Requirement Summary', type: 'textarea' },
  { type: 'section', label: 'Ownership & Follow-up' },
  { name: 'owner_id', label: 'Assigned BD Owner', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name}${e.role_name ? ' – ' + e.role_name : ''}`, help: 'Leave empty for automatic assignment' },
  { name: 'reassign_reason', label: 'Reason for reassignment', hidden: (v) => !v.id || String(v.owner_id || '') === String(v._orig_owner || '') },
  { name: 'lead_status_id', label: 'Lead Status', type: 'select', lookup: 'lead-statuses' },
  { name: 'next_action', label: 'Next Action' },
  { name: 'next_follow_up', label: 'Next Follow-up', type: 'datetime' },
];

const PAYLOAD_KEYS = LEAD_FIELDS.filter((f) => f.name).map((f) => f.name);

const QUICK = [
  { key: '', label: 'All' },
  { key: 'overdue', label: 'Overdue follow-up' },
  { key: 'inactive', label: 'Inactive' },
  { key: 'no_next_action', label: 'No next action' },
  { key: 'duplicates', label: 'Possible duplicates' },
];

export default function Leads() {
  const navigate = useNavigate();
  const { can } = useAuth();
  const [params] = useSearchParams();
  const [assign, setAssign] = useState(null);
  const [log, setLog] = useState(null);
  const [key, setKey] = useState(0);

  const initialAdd = params.get('new') ? { company_id: params.get('company_id') || '' } : null;

  const doAssign = async () => {
    try {
      await api.post(`/leads/${assign.id}/assign`, { owner_id: assign.owner_id, reason: assign.reason });
      toast.success('Lead reassigned');
      setAssign(null);
      setKey((k) => k + 1);
    } catch (e) {
      showError(e);
    }
  };

  return (
    <>
      <CrudPage
        title="Leads & Enquiries"
        endpoint="/leads"
        module="leads"
        addLabel="Add Lead"
        exportName="leads"
        modalSize="lg"
        reloadKey={key}
        initialAdd={initialAdd}
        onRowClick={(r) => navigate(`/leads/${r.id}`)}
        filters={[
          { name: 'lead_status_id', label: 'All Status', lookup: 'lead-statuses' },
          { name: 'lead_type_id', label: 'All Types', lookup: 'lead-types' },
          { name: 'lead_source_id', label: 'All Sources', lookup: 'lead-sources' },
          { name: 'owner_id', label: 'All Owners', lookup: 'employees', labelKey: 'full_name' },
          { name: 'priority', label: 'All Priority', options: toOptions(PRIORITIES) },
          { name: 'is_converted', label: 'Open & Converted', options: [{ value: 0, label: 'Open' }, { value: 1, label: 'Converted' }] },
        ]}
        topContent={(list) => (
          <div className="flex flex-wrap gap-2">
            {QUICK.map((q) => {
              const active = q.key ? list.filters[q.key] === '1' : !QUICK.some((x) => x.key && list.filters[x.key] === '1');
              return (
                <button
                  key={q.label}
                  onClick={() => {
                    const next = { ...list.filters };
                    QUICK.forEach((x) => x.key && delete next[x.key]);
                    if (q.key) next[q.key] = '1';
                    list.setFilters(next);
                    list.setPage(1);
                  }}
                  className={`rounded-full border px-3 py-1 text-xs font-medium ${active ? 'border-brand bg-brand text-white' : 'border-line bg-white text-slate-600 hover:border-brand/40'}`}
                >
                  {q.label}
                </button>
              );
            })}
          </div>
        )}
        columns={[
          { key: 'lead_code', label: 'Lead ID', render: (r) => <Link className="link font-medium" to={`/leads/${r.id}`} onClick={(e) => e.stopPropagation()}>{r.lead_code}</Link>, exportValue: (r) => r.lead_code },
          {
            key: 'company_name',
            label: 'Company / Contact',
            render: (r) => (
              <div>
                <div className="font-medium text-ink">{r.company_name || '—'} {r.duplicate_of ? <span className="chip ml-1 bg-amber-50 text-amber-700">dup?</span> : null}</div>
                <div className="text-xs text-slate-500">{[r.contact_name, r.phone].filter(Boolean).join(' · ')}</div>
              </div>
            ),
          },
          { key: 'source_name', label: 'Source', render: (r) => <div><div>{r.source_name || '—'}</div><div className="text-xs text-slate-500">{r.lead_type_name}</div></div>, exportValue: (r) => r.source_name },
          { key: 'event_type_name', label: 'Service / Event', render: (r) => <div><div>{r.service_name || '—'}</div><div className="text-xs text-slate-500">{r.event_type_name}</div></div>, exportValue: (r) => `${r.service_name || ''} ${r.event_type_name || ''}` },
          { key: 'expected_budget', label: 'Budget', render: (r) => inr(r.expected_budget) },
          { key: 'status_name', label: 'Status', render: (r) => <Badge color={r.status_color}>{r.status_name}</Badge> },
          { key: 'priority', label: 'Priority', render: (r) => <Badge>{r.priority}</Badge> },
          { key: 'owner_name', label: 'Owner' },
          { key: 'next_follow_up', label: 'Next Follow-up', render: (r) => <span className={Number(r.is_overdue) ? 'font-medium text-red-600' : ''}>{fmtDateTime(r.next_follow_up)}</span>, exportValue: (r) => r.next_follow_up },
        ]}
        defaults={{ priority: 'Medium' }}
        fields={LEAD_FIELDS}
        toForm={(r) => ({ ...r, _orig_owner: r.owner_id })}
        toPayload={(v) => Object.fromEntries(PAYLOAD_KEYS.map((k) => [k, v[k]]))}
        canEditRow={(r) => !Number(r.is_converted)}
        rowActions={(r) => (
          <>
            {can('activities', 'create') && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Log activity" onClick={() => setLog(r)}>
                <LuNotebookPen size={15} />
              </button>
            )}
            {can('leads', 'edit') && !Number(r.is_converted) && (
              <button className="rounded p-1.5 text-slate-500 hover:bg-slate-100 hover:text-brand" title="Reassign" onClick={() => setAssign({ id: r.id, code: r.lead_code, owner_id: '', reason: '' })}>
                <LuUserCog size={15} />
              </button>
            )}
          </>
        )}
      />
      <Modal
        open={!!assign}
        onClose={() => setAssign(null)}
        title={`Reassign ${assign ? assign.code : ''}`}
        size="sm"
        footer={<><button className="btn-outline" onClick={() => setAssign(null)}>Cancel</button><button className="btn-primary" onClick={doAssign}>Reassign</button></>}
      >
        {assign && (
          <FormRenderer
            values={assign}
            onChange={(n, v) => setAssign((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'owner_id', label: 'New Owner', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name} – ${e.role_name || ''}`, required: true, col: 'full' },
              { name: 'reason', label: 'Reason', type: 'textarea', required: true },
            ]}
          />
        )}
      </Modal>
      <LogActivityModal open={!!log} onClose={() => setLog(null)} relatedType="lead" relatedId={log && log.id} onSaved={() => setKey((k) => k + 1)} />
    </>
  );
}
