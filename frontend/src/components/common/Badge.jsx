import { statusColor } from '../../utils/constants';

/** Status pill. Pass `color` (hex from masters) to override. */
export default function Badge({ children, color, className = '' }) {
  if (children === null || children === undefined || children === '') return <span className="text-slate-400">—</span>;
  if (color) {
    return (
      <span className={`chip ${className}`} style={{ backgroundColor: `${color}1a`, color, boxShadow: `inset 0 0 0 1px ${color}40` }}>
        {children}
      </span>
    );
  }
  return <span className={`chip ${statusColor(children)} ${className}`}>{children}</span>;
}
