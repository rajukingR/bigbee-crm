/** White card with a title row, used across dashboards and detail pages. */
export default function SectionCard({ title, subtitle, actions, children, className = '', bodyClass = 'p-5' }) {
  return (
    <div className={`card ${className}`}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-5 pt-5">
          <div>
            {title && <h3 className="card-title">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={bodyClass}>{children}</div>
    </div>
  );
}
