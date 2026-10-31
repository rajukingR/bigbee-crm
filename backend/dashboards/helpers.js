/** Shared helpers for role dashboards. ids = null means "all data" (Admin / MD / company-wide roles). */
const { num } = require('../utils/helpers');

const ph = (ids) => ids.map(() => '?').join(',') || 'NULL';

/** AND col IN (...) – nothing when ids is null */
function inIds(col, ids) {
  if (ids === null) return { sql: '', params: [] };
  return { sql: ` AND ${col} IN (${ph(ids)})`, params: [...ids] };
}

/** AND (a IN (...) OR b IN (...)) */
function anyIn(cols, ids) {
  if (ids === null) return { sql: '', params: [] };
  return { sql: ` AND (${cols.map((c) => `${c} IN (${ph(ids)})`).join(' OR ')})`, params: cols.flatMap(() => ids) };
}

const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function monthRange(offset = 0) {
  const now = new Date();
  const s = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const e = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { start: ymd(s), end: ymd(e), endTs: `${ymd(e)} 23:59:59`, label: s.toLocaleString('en-US', { month: 'short' }), key: ymd(s).slice(0, 7) };
}

/** Last n months, oldest first */
const lastMonths = (n = 6) => Array.from({ length: n }, (_, i) => monthRange(i - (n - 1)));

const change = (cur, prev) => (num(prev) ? Math.round(((num(cur) - num(prev)) / Math.abs(num(prev))) * 10000) / 100 : null);

const today = () => ymd(new Date());
const addDays = (d) => {
  const x = new Date();
  x.setDate(x.getDate() + d);
  return ymd(x);
};

module.exports = { inIds, anyIn, monthRange, lastMonths, change, today, addDays, ymd };
