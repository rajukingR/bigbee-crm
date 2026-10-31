import { LuLoader } from 'react-icons/lu';

export default function Loader({ full = false, text = 'Loading…' }) {
  return (
    <div className={`flex items-center justify-center gap-2 text-sm text-slate-500 ${full ? 'h-screen' : 'py-12'}`}>
      <LuLoader className="animate-spin text-brand" size={18} /> {text}
    </div>
  );
}
