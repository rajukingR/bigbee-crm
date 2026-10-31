import { useNavigate } from 'react-router-dom';
import { LuArrowLeft } from 'react-icons/lu';

/** Title row for detail pages with back button and actions. */
export default function PageHeader({ title, subtitle, back, actions, badge }) {
  const navigate = useNavigate();
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex min-w-0 items-start gap-3">
        {back && (
          <button className="mt-0.5 rounded-md border border-line bg-white p-2 text-slate-600 hover:bg-slate-50" onClick={() => (typeof back === 'string' ? navigate(back) : navigate(-1))} aria-label="Back">
            <LuArrowLeft size={16} />
          </button>
        )}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-lg font-semibold text-ink">{title}</h2>
            {badge}
          </div>
          {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
