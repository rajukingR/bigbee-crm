import { Link } from 'react-router-dom';
import CrudPage from '../../components/common/CrudPage';
import { FEEDBACK_FIELDS } from '../projects/tabs/ClosureTab';
import { fmtDate } from '../../utils/format';

const Stars = ({ n }) => (
  <span className="text-amber-500">
    {'★'.repeat(Math.round(Number(n) || 0))}
    <span className="text-slate-200">{'★'.repeat(5 - Math.round(Number(n) || 0))}</span>
  </span>
);

export default function Feedback() {
  const fields = [{ name: 'project_id', label: 'Project', type: 'select', required: true, remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` }, col: 'full' }, ...FEEDBACK_FIELDS];
  return (
    <CrudPage
      title="Post-event Client Feedback & Satisfaction"
      endpoint="/feedback"
      module="feedback"
      addLabel="Record Feedback"
      exportName="client_feedback"
      modalSize="lg"
      filters={[
        { name: 'project_id', label: 'All Projects', remote: { endpoint: '/projects', label: (r) => r.project_code } },
        { name: 'repeat_business', label: 'Repeat business?', options: [{ value: 1, label: 'Repeat opportunity' }, { value: 0, label: 'No' }] },
      ]}
      columns={[
        { key: 'feedback_date', label: 'Date', render: (r) => fmtDate(r.feedback_date) },
        { key: 'project_code', label: 'Project', render: (r) => <Link className="link" to={`/projects/${r.project_id}`} onClick={(e) => e.stopPropagation()}>{r.project_code}</Link>, exportValue: (r) => r.project_code },
        { key: 'company_name', label: 'Client', render: (r) => <div>{r.company_name}<div className="text-xs text-slate-500">{r.contact_name}</div></div>, exportValue: (r) => r.company_name },
        { key: 'avg_rating', label: 'Avg. Rating', render: (r) => <span><Stars n={r.avg_rating} /> <span className="text-xs text-slate-500">{r.avg_rating}</span></span> },
        { key: 'rating_quality', label: 'Quality' },
        { key: 'rating_communication', label: 'Comm.' },
        { key: 'rating_timeliness', label: 'Timeliness' },
        { key: 'nps', label: 'NPS', render: (r) => r.nps ?? '—' },
        { key: 'repeat_business', label: 'Repeat?', render: (r) => (Number(r.repeat_business) ? <span className="chip bg-green-50 text-green-700">Yes</span> : 'No'), exportValue: (r) => (Number(r.repeat_business) ? 'Yes' : 'No') },
        { key: 'comments', label: 'Comments', render: (r) => <span className="line-clamp-2 text-xs">{r.comments || '—'}</span> },
      ]}
      defaults={{ repeat_business: 0 }}
      fields={fields}
      toPayload={(v) => Object.fromEntries(fields.map((f) => [f.name, v[f.name]]))}
    />
  );
}
