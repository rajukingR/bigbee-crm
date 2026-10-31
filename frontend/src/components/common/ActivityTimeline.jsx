import { LuPhone, LuMail, LuUsers, LuMessageCircle, LuMapPin, LuSend, LuNotebookPen } from 'react-icons/lu';
import { fmtDateTime } from '../../utils/format';

const ICONS = { Call: LuPhone, Email: LuMail, Meeting: LuUsers, WhatsApp: LuMessageCircle, 'Site Visit': LuMapPin, 'Proposal Sent': LuSend, Note: LuNotebookPen };

export default function ActivityTimeline({ items = [] }) {
  if (!items.length) return <div className="py-6 text-center text-sm text-slate-400">No activities logged yet</div>;
  return (
    <ol className="relative ml-3 border-l border-line">
      {items.map((a) => {
        const Icon = ICONS[a.activity_type] || LuNotebookPen;
        return (
          <li key={a.id} className="mb-5 ml-5">
            <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-brand-50 text-brand ring-4 ring-white">
              <Icon size={12} />
            </span>
            <div className="flex flex-wrap items-baseline gap-x-2">
              <span className="text-sm font-medium text-ink">{a.activity_type}{a.subject ? ` – ${a.subject}` : ''}</span>
              <span className="text-xs text-slate-400">{fmtDateTime(a.activity_date)} · {a.owner_name}</span>
            </div>
            {a.outcome && <p className="mt-0.5 whitespace-pre-line text-sm text-slate-600">{a.outcome}</p>}
            {(a.next_action || a.next_follow_up) && (
              <p className="mt-0.5 text-xs text-slate-500">
                Next: {a.next_action || '—'} {a.next_follow_up ? `· ${fmtDateTime(a.next_follow_up)}` : ''}
              </p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
