export default function ProgressBar({ value = 0, color = 'bg-brand', height = 'h-1.5', className = '' }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={`w-full overflow-hidden rounded-full bg-slate-100 ${height} ${className}`}>
      <div className={`${height} rounded-full ${color}`} style={{ width: `${v}%` }} />
    </div>
  );
}
