/** Indian number formatting helpers. */
export const inr = (n, digits = 0) => {
  const v = Number(n || 0);
  return `₹${v.toLocaleString('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: digits })}`;
};

export const num = (n) => Number(n || 0).toLocaleString('en-IN');

/** ₹12.4L / ₹1.2Cr / ₹45K */
export const lakhs = (n) => {
  const v = Number(n || 0);
  const abs = Math.abs(v);
  if (abs >= 1e7) return `₹${(v / 1e7).toFixed(abs >= 1e8 ? 1 : 2).replace(/\.0+$/, '')}Cr`;
  if (abs >= 1e5) return `₹${(v / 1e5).toFixed(1).replace(/\.0$/, '')}L`;
  if (abs >= 1e3) return `₹${(v / 1e3).toFixed(1).replace(/\.0$/, '')}K`;
  return `₹${Math.round(v)}`;
};

export const pct = (n) => (n === null || n === undefined || Number.isNaN(Number(n)) ? 'N/A' : `${Number(n).toFixed(1).replace(/\.0$/, '')}%`);

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export const fmtDate = (d) => {
  if (!d) return '—';
  const s = String(d).slice(0, 10).split('-');
  if (s.length < 3) return d;
  return `${s[2]} ${MONTHS[Number(s[1]) - 1]} ${s[0]}`;
};

export const fmtDateTime = (d) => {
  if (!d) return '—';
  const str = String(d).replace('T', ' ');
  const time = str.slice(11, 16);
  return `${fmtDate(str)}${time ? ', ' + time : ''}`;
};

/** Value for <input type="date"> */
export const toDateInput = (d) => (d ? String(d).slice(0, 10) : '');
/** Value for <input type="datetime-local"> */
export const toDateTimeInput = (d) => (d ? String(d).replace(' ', 'T').slice(0, 16) : '');

export const today = () => new Date().toISOString().slice(0, 10);

export const isOverdue = (d) => d && new Date(String(d).replace(' ', 'T')) < new Date();

export const initials = (name = '') =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('') || 'U';
