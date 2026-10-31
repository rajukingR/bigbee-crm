import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuSave, LuSend, LuCheck, LuCircleHelp } from 'react-icons/lu';
import api, { showError } from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import Badge from '../../../components/common/Badge';
import Modal from '../../../components/common/Modal';
import { FormRenderer, Textarea } from '../../../components/common/FormFields';
import { fmtDateTime } from '../../../utils/format';

const FIELDS = [
  { name: 'received_by', label: 'Receiving Owner (CS / Operations)', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name}${e.role_name ? ' – ' + e.role_name : ''}`, required: true },
  { name: 'proposal_reference', label: 'Final Proposal Reference' },
  { name: 'brief', label: 'Client Brief', type: 'textarea', required: true },
  { name: 'costing_assumptions', label: 'Costing Assumptions', type: 'textarea' },
  { name: 'exclusions', label: 'Exclusions', type: 'textarea' },
  { name: 'promises_made', label: 'Promises / Commitments made to Client', type: 'textarea' },
  { name: 'client_stakeholders', label: 'Client Stakeholders & Contacts', type: 'textarea', required: true },
  { name: 'budget_notes', label: 'Budget Notes', type: 'textarea' },
  { name: 'timeline_notes', label: 'Timeline & Key Dates', type: 'textarea', required: true },
  { name: 'risks', label: 'Known Risks', type: 'textarea' },
];

/** BD → Client Servicing / Operations handover with mandatory checklist and acceptance. */
export default function HandoverTab({ data, reload }) {
  const { user, can } = useAuth();
  const h = data.handover || { checklist: [], status: 'Draft' };
  const pid = data.project.id;
  const [values, setValues] = useState({ ...h, checklist: Array.isArray(h.checklist) ? h.checklist : [] });
  const [clarify, setClarify] = useState(null);
  const locked = h.status === 'Accepted';
  const editable = can('projects', 'edit') && !locked;
  const done = values.checklist.filter((c) => c.done).length;

  const call = async (fn, msg) => {
    try {
      await fn();
      toast.success(msg);
      reload();
    } catch (e) {
      showError(e);
    }
  };
  const save = () => call(() => api.put(`/projects/${pid}/handover`, { ...Object.fromEntries(FIELDS.map((f) => [f.name, values[f.name]])), checklist: values.checklist }), 'Handover saved');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          Status: <Badge>{h.status}</Badge>
          {h.submitted_at && <span className="text-xs text-slate-500">submitted {fmtDateTime(h.submitted_at)} by {h.handed_over_by_name}</span>}
          {h.accepted_at && <span className="text-xs text-slate-500">· accepted {fmtDateTime(h.accepted_at)} by {h.received_by_name}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <button className="btn-outline" onClick={save}>
              <LuSave size={15} /> Save
            </button>
          )}
          {editable && ['Draft', 'Clarification Requested'].includes(h.status) && (
            <button className="btn-primary" onClick={() => call(async () => { await api.put(`/projects/${pid}/handover`, { ...Object.fromEntries(FIELDS.map((f) => [f.name, values[f.name]])), checklist: values.checklist }); await api.post(`/projects/${pid}/handover/submit`); }, 'Handover submitted')}>
              <LuSend size={15} /> Submit Handover
            </button>
          )}
          {['Submitted', 'Clarification Requested'].includes(h.status) && (h.received_by === user.id || can('projects', 'approve')) && (
            <>
              <button className="btn-outline" onClick={() => setClarify('')}>
                <LuCircleHelp size={15} /> Request Clarification
              </button>
              <button className="btn-success" onClick={() => call(() => api.post(`/projects/${pid}/handover/accept`), 'Handover accepted')}>
                <LuCheck size={15} /> Accept Handover
              </button>
            </>
          )}
        </div>
      </div>

      {h.status === 'Clarification Requested' && h.clarification && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <b>Clarification requested:</b> {h.clarification}
        </div>
      )}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
        <div className="rounded-lg border border-line p-4">
          <div className="mb-3 flex items-center justify-between">
            <h4 className="text-sm font-semibold">Mandatory Checklist</h4>
            <span className="text-xs text-slate-500">
              {done}/{values.checklist.length}
            </span>
          </div>
          <div className="space-y-2">
            {values.checklist.map((c, i) => (
              <label key={c.item} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-0.5 h-4 w-4 accent-brand"
                  checked={!!c.done}
                  disabled={!editable}
                  onChange={() => setValues((v) => ({ ...v, checklist: v.checklist.map((x, j) => (j === i ? { ...x, done: !x.done } : x)) }))}
                />
                <span className={c.done ? 'text-slate-400 line-through' : 'text-ink'}>{c.item}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="xl:col-span-2">
          <fieldset disabled={!editable}>
            <FormRenderer fields={FIELDS} values={values} onChange={(n, v) => setValues((s) => ({ ...s, [n]: v }))} />
          </fieldset>
        </div>
      </div>

      <Modal open={clarify !== null} onClose={() => setClarify(null)} title="Request clarification" size="sm" footer={<><button className="btn-outline" onClick={() => setClarify(null)}>Cancel</button><button className="btn-primary" onClick={() => call(() => api.post(`/projects/${pid}/handover/clarify`, { clarification: clarify }), 'Clarification requested').then(() => setClarify(null))}>Send</button></>}>
        <Textarea rows={4} value={clarify || ''} onChange={(e) => setClarify(e.target.value)} placeholder="What information is missing?" />
      </Modal>
    </div>
  );
}
