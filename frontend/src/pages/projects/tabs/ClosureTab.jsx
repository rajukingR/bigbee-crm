import { useState } from 'react';
import toast from 'react-hot-toast';
import { LuLock } from 'react-icons/lu';
import api, { showError } from '../../../api/axios';
import { useAuth } from '../../../context/AuthContext';
import CrudPage from '../../../components/common/CrudPage';
import { Textarea, Checkbox } from '../../../components/common/FormFields';
import { fmtDate, fmtDateTime } from '../../../utils/format';

export const FEEDBACK_FIELDS = [
  { name: 'feedback_date', label: 'Feedback Date', type: 'date' },
  { name: 'contact_id', label: 'Given by (client contact)', type: 'select', remote: { endpoint: '/contacts', label: (r) => `${r.name}${r.company_name ? ' – ' + r.company_name : ''}` } },
  { name: 'rating_overall', label: 'Overall (1-5)', type: 'number', min: 1, max: 5 },
  { name: 'rating_quality', label: 'Execution Quality (1-5)', type: 'number', min: 1, max: 5 },
  { name: 'rating_communication', label: 'Communication (1-5)', type: 'number', min: 1, max: 5 },
  { name: 'rating_timeliness', label: 'Timeliness (1-5)', type: 'number', min: 1, max: 5 },
  { name: 'nps', label: 'Likelihood to recommend (0-10)', type: 'number', min: 0, max: 10 },
  { name: 'repeat_business', label: 'Repeat business', type: 'checkbox', checkboxLabel: 'Repeat-business opportunity (creates a lead for BD)' },
  { name: 'comments', label: 'Client Comments', type: 'textarea' },
  { name: 'repeat_notes', label: 'Repeat-business Notes', type: 'textarea', hidden: (v) => !Number(v.repeat_business) },
];

const Stars = ({ n }) => <span className="text-amber-500">{'★'.repeat(Math.round(Number(n) || 0))}<span className="text-slate-200">{'★'.repeat(5 - Math.round(Number(n) || 0))}</span></span>;

export default function ClosureTab({ data, reload }) {
  const { can } = useAuth();
  const p = data.project;
  const pid = p.id;
  const [notes, setNotes] = useState(p.closure_notes || '');
  const [force, setForce] = useState(0);

  const close = async () => {
    try {
      const { data: r } = await api.post(`/projects/${pid}/close`, { closure_notes: notes, force });
      toast.success(r.message);
      if (r.warnings && r.warnings.length) toast(`Note: ${r.warnings.join(', ')}`, { icon: '⚠️' });
      reload();
    } catch (e) {
      showError(e);
    }
  };

  return (
    <div className="space-y-6">
      <CrudPage
        title="Post-event Client Feedback"
        endpoint="/feedback"
        module="feedback"
        addLabel="Record Feedback"
        initialFilters={{ project_id: pid }}
        defaults={{ project_id: pid, repeat_business: 0 }}
        fields={FEEDBACK_FIELDS}
        toPayload={(v) => ({ ...Object.fromEntries(FEEDBACK_FIELDS.map((f) => [f.name, v[f.name]])), project_id: pid })}
        showSerial={false}
        afterSave={reload}
        columns={[
          { key: 'feedback_date', label: 'Date', render: (r) => fmtDate(r.feedback_date) },
          { key: 'avg_rating', label: 'Rating', render: (r) => <span><Stars n={r.avg_rating} /> <span className="text-xs text-slate-500">{r.avg_rating}</span></span> },
          { key: 'nps', label: 'NPS', render: (r) => r.nps ?? '—' },
          { key: 'comments', label: 'Comments', render: (r) => <span className="line-clamp-2 text-xs">{r.comments || '—'}</span> },
          { key: 'repeat_business', label: 'Repeat?', render: (r) => (Number(r.repeat_business) ? 'Yes' : 'No') },
          { key: 'collected_by_name', label: 'By' },
        ]}
      />

      <div className="card p-5">
        <h3 className="card-title mb-3">Project Closure & Sign-off</h3>
        {p.status === 'Closed' ? (
          <div className="text-sm text-slate-600">
            Closed on {fmtDateTime(p.closed_at)}.
            <div className="mt-2 whitespace-pre-line text-ink">{p.closure_notes}</div>
          </div>
        ) : can('projects', 'edit') ? (
          <div className="space-y-3">
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Completion notes, learnings, pending items, financial closure status…" />
            <Checkbox label="Close even if some tasks are still open" checked={force} onChange={setForce} />
            <div>
              <button className="btn-primary" onClick={close}>
                <LuLock size={15} /> Close Project
              </button>
            </div>
            <p className="text-xs text-slate-500">Closing records completion sign-off by you. Outstanding receivables / vendor payables are flagged but do not block closure.</p>
          </div>
        ) : (
          <div className="text-sm text-slate-400">Only project editors can close the project.</div>
        )}
      </div>
    </div>
  );
}
