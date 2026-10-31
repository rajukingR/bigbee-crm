import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { LuNotebookPen, LuPencil, LuUserCog, LuCircleCheck, LuCircleX, LuArrowUpRight, LuTriangleAlert } from 'react-icons/lu';
import api, { showError } from '../../api/axios';
import useFetch from '../../hooks/useFetch';
import { useAuth } from '../../context/AuthContext';
import Loader from '../../components/common/Loader';
import PageHeader from '../../components/common/PageHeader';
import Tabs from '../../components/common/Tabs';
import Badge from '../../components/common/Badge';
import DetailGrid from '../../components/common/DetailGrid';
import Modal from '../../components/common/Modal';
import Attachments from '../../components/common/Attachments';
import ActivityTimeline from '../../components/common/ActivityTimeline';
import LogActivityModal from '../../components/common/LogActivityModal';
import { FormRenderer } from '../../components/common/FormFields';
import { LEAD_FIELDS } from './Leads';
import { inr, fmtDate, fmtDateTime, isOverdue } from '../../utils/format';

export default function LeadDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const { data: l, loading, reload } = useFetch(`/leads/${id}/detail`);
  const [tab, setTab] = useState('activities');
  const [logOpen, setLogOpen] = useState(false);
  const [edit, setEdit] = useState(null);
  const [assign, setAssign] = useState(null);
  const [qualify, setQualify] = useState(null);
  const [convert, setConvert] = useState(null);

  if (loading && !l) return <Loader />;
  if (!l) return null;
  const converted = !!Number(l.is_converted);

  const call = async (fn, msg, after) => {
    try {
      const res = await fn();
      toast.success(msg);
      if (after) after(res);
      reload();
    } catch (e) {
      showError(e);
    }
  };

  const payloadKeys = LEAD_FIELDS.filter((f) => f.name).map((f) => f.name);

  return (
    <div>
      <PageHeader
        back="/leads"
        title={`${l.lead_code} · ${l.company_name || l.contact_name || ''}`}
        subtitle={`Created ${fmtDateTime(l.created_at)} by ${l.created_by_name || '—'} · Owner: ${l.owner_name || 'Unassigned'}`}
        badge={
          <>
            <Badge color={l.status_color}>{l.status_name}</Badge>
            <Badge>{l.qualification}</Badge>
            <Badge>{l.priority}</Badge>
          </>
        }
        actions={
          <>
            {can('activities', 'create') && (
              <button className="btn-outline" onClick={() => setLogOpen(true)}>
                <LuNotebookPen size={15} /> Log Activity
              </button>
            )}
            {!converted && can('leads', 'edit') && (
              <>
                <button className="btn-outline" onClick={() => setAssign({ owner_id: '', reason: '' })}>
                  <LuUserCog size={15} /> Reassign
                </button>
                <button className="btn-outline" onClick={() => setQualify({ qualification: 'Qualified', qualification_notes: l.qualification_notes || '' })}>
                  <LuCircleCheck size={15} /> Qualify
                </button>
                <button className="btn-outline" onClick={() => setQualify({ qualification: 'Disqualified', disqualify_reason: '' })}>
                  <LuCircleX size={15} /> Disqualify
                </button>
                <button className="btn-outline" onClick={() => setEdit({ ...l, _orig_owner: l.owner_id })}>
                  <LuPencil size={15} /> Edit
                </button>
              </>
            )}
            {!converted && can('opportunities', 'create') && (
              <button className="btn-primary" onClick={() => setConvert({ title: `${l.company_name || l.contact_name} – ${l.event_type_name || 'Event'}`, expected_value: l.expected_budget, expected_close_date: l.expected_decision_date })}>
                <LuArrowUpRight size={15} /> Convert to Opportunity
              </button>
            )}
            {converted && l.opportunity_id && (
              <Link className="btn-primary" to={`/opportunities/${l.opportunity_id}`}>
                Open Opportunity
              </Link>
            )}
          </>
        }
      />

      {l.duplicate && (
        <div className="mb-4 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <LuTriangleAlert size={16} /> Possible duplicate of{' '}
          <Link className="font-medium underline" to={`/leads/${l.duplicate.id}`}>
            {l.duplicate.lead_code} – {l.duplicate.company_name || l.duplicate.contact_name}
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="card p-5 xl:col-span-2">
          <DetailGrid
            items={[
              { label: 'Company', value: l.company_id ? <Link className="link" to={`/companies/${l.company_id}`}>{l.company_name}</Link> : l.company_name },
              { label: 'Contact Person', value: l.contact_name },
              { label: 'Phone', value: l.phone },
              { label: 'Email', value: l.email },
              { label: 'City', value: l.city },
              { label: 'Location', value: l.location },
              { label: 'Lead Type', value: l.lead_type_name },
              { label: 'Source', value: [l.source_name, l.sub_source_name].filter(Boolean).join(' › ') },
              { label: 'Campaign', value: l.campaign_name },
              { label: 'Service Interest', value: l.service_name },
              { label: 'Event Type', value: l.event_type_name },
              { label: 'Tentative Event Date', value: fmtDate(l.tentative_event_date) },
              { label: 'Expected Budget', value: inr(l.expected_budget) },
              { label: 'Expected Decision', value: fmtDate(l.expected_decision_date) },
              { label: 'Last Activity', value: fmtDateTime(l.last_activity_at) },
              { label: 'Requirement', value: l.requirement, full: true },
              { label: 'Qualification Notes', value: l.qualification_notes, full: true, hidden: !l.qualification_notes },
              { label: 'Disqualification Reason', value: l.disqualify_reason, full: true, hidden: !l.disqualify_reason },
            ]}
          />
        </div>
        <div className="space-y-5">
          <div className="card p-5">
            <div className="text-xs font-medium text-slate-500">Next Action</div>
            <div className="mt-1 text-sm text-ink">{l.next_action || 'No next action set'}</div>
            <div className="mt-3 text-xs font-medium text-slate-500">Next Follow-up</div>
            <div className={`mt-1 text-sm ${isOverdue(l.next_follow_up) && !converted ? 'font-semibold text-red-600' : 'text-ink'}`}>
              {fmtDateTime(l.next_follow_up)} {isOverdue(l.next_follow_up) && !converted ? '(overdue)' : ''}
            </div>
          </div>
          <div className="card p-5">
            <div className="mb-2 text-sm font-semibold">Owner</div>
            <div className="text-sm text-ink">{l.owner_name || 'Unassigned'}</div>
            <div className="mt-2 text-xs text-slate-500">{l.assignments.length} assignment change(s) recorded</div>
          </div>
        </div>
      </div>

      <div className="card mt-5">
        <div className="px-3">
          <Tabs
            active={tab}
            onChange={setTab}
            tabs={[
              { key: 'activities', label: 'Activities', count: l.activities.length },
              { key: 'assignments', label: 'Assignment History', count: l.assignments.length },
              { key: 'files', label: 'Files' },
            ]}
          />
        </div>
        <div className="p-5">
          {tab === 'activities' && <ActivityTimeline items={l.activities} />}
          {tab === 'assignments' && (
            <table className="min-w-full">
              <thead className="border-b border-line">
                <tr>{['Date', 'From', 'To', 'Reason', 'Authorised by'].map((h) => <th key={h} className="table-head">{h}</th>)}</tr>
              </thead>
              <tbody>
                {l.assignments.map((a) => (
                  <tr key={a.id} className="border-b border-line">
                    <td className="table-cell">{fmtDateTime(a.created_at)}</td>
                    <td className="table-cell">{a.from_name || '—'}</td>
                    <td className="table-cell">{a.to_name || '—'}</td>
                    <td className="table-cell">{a.reason}</td>
                    <td className="table-cell">{a.assigned_by_name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          {tab === 'files' && <Attachments entityType="lead" entityId={l.id} docTypes={['Client Brief', 'RFP / Tender', 'Other']} />}
        </div>
      </div>

      <LogActivityModal open={logOpen} onClose={() => setLogOpen(false)} relatedType="lead" relatedId={l.id} onSaved={reload} />

      <Modal open={!!edit} onClose={() => setEdit(null)} title="Edit Lead" size="lg" footer={<><button className="btn-outline" onClick={() => setEdit(null)}>Cancel</button><button className="btn-primary" onClick={() => call(() => api.put(`/leads/${id}`, Object.fromEntries(payloadKeys.map((k) => [k, edit[k]]))), 'Lead updated', () => setEdit(null))}>Save</button></>}>
        {edit && <FormRenderer fields={LEAD_FIELDS} values={edit} onChange={(n, v) => setEdit((s) => { const f = LEAD_FIELDS.find((x) => x.name === n); const nv = { ...s, [n]: v }; return f && f.onChange ? f.onChange(nv, v) : nv; })} />}
      </Modal>

      <Modal open={!!assign} onClose={() => setAssign(null)} title="Reassign Lead" size="sm" footer={<><button className="btn-outline" onClick={() => setAssign(null)}>Cancel</button><button className="btn-primary" onClick={() => call(() => api.post(`/leads/${id}/assign`, assign), 'Lead reassigned', () => setAssign(null))}>Reassign</button></>}>
        {assign && (
          <FormRenderer
            values={assign}
            onChange={(n, v) => setAssign((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'owner_id', label: 'New Owner', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name} – ${e.role_name || ''}`, col: 'full', required: true },
              { name: 'reason', label: 'Reason', type: 'textarea', required: true },
            ]}
          />
        )}
      </Modal>

      <Modal open={!!qualify} onClose={() => setQualify(null)} title={qualify && qualify.qualification === 'Disqualified' ? 'Disqualify Lead' : 'Qualify Lead'} size="sm" footer={<><button className="btn-outline" onClick={() => setQualify(null)}>Cancel</button><button className="btn-primary" onClick={() => call(() => api.post(`/leads/${id}/qualify`, qualify), 'Saved', () => setQualify(null))}>Save</button></>}>
        {qualify && (
          <FormRenderer
            values={qualify}
            onChange={(n, v) => setQualify((s) => ({ ...s, [n]: v }))}
            fields={
              qualify.qualification === 'Disqualified'
                ? [{ name: 'disqualify_reason', label: 'Disqualification Reason', type: 'textarea', required: true }]
                : [{ name: 'qualification_notes', label: 'Qualification notes (need, timing, decision process, value)', type: 'textarea' }]
            }
          />
        )}
      </Modal>

      <Modal
        open={!!convert}
        onClose={() => setConvert(null)}
        title="Convert to Opportunity"
        footer={
          <>
            <button className="btn-outline" onClick={() => setConvert(null)}>Cancel</button>
            <button className="btn-primary" onClick={() => call(() => api.post(`/leads/${id}/convert`, convert), 'Opportunity created', (res) => navigate(`/opportunities/${res.data.opportunity_id}`))}>
              Convert
            </button>
          </>
        }
      >
        {convert && (
          <FormRenderer
            values={convert}
            onChange={(n, v) => setConvert((s) => ({ ...s, [n]: v }))}
            fields={[
              { name: 'title', label: 'Opportunity Title', col: 'full', required: true },
              { name: 'expected_value', label: 'Expected Value (₹)', type: 'number' },
              { name: 'expected_close_date', label: 'Expected Close Date', type: 'date' },
              { name: 'funnel_status_id', label: 'Starting Stage', type: 'select', lookup: 'funnel-statuses', filter: (r) => r.stage_type === 'open', help: 'Default: Qualified' },
              { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: 'full_name', help: 'Default: lead owner' },
            ]}
          />
        )}
      </Modal>
    </div>
  );
}
