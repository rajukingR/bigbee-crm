import { LuInbox } from 'react-icons/lu';

export default function EmptyState({ text = 'No data available', action = null }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-slate-500">
      <LuInbox size={28} className="text-slate-300" />
      <span>{text}</span>
      {action}
    </div>
  );
}
