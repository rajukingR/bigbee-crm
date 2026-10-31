/**
 * Data visibility based on the upward-reporting structure.
 *  - all  : no restriction (MD, Finance, Super Admin)
 *  - team : self + everyone who reports to me, directly or indirectly
 *  - own  : only my records
 */
const { query } = require('../config/db');

let cache = { at: 0, rows: [] };

async function reportingRows() {
  if (Date.now() - cache.at < 60 * 1000) return cache.rows;
  const rows = await query('SELECT id, reports_to FROM employees');
  cache = { at: Date.now(), rows };
  return rows;
}

function clearScopeCache() {
  cache = { at: 0, rows: [] };
}

async function getSubordinateIds(userId) {
  const rows = await reportingRows();
  const children = {};
  rows.forEach((r) => {
    if (r.reports_to) (children[r.reports_to] = children[r.reports_to] || []).push(r.id);
  });
  const result = [];
  const stack = [...(children[userId] || [])];
  const seen = new Set([userId]);
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    (children[id] || []).forEach((c) => stack.push(c));
  }
  return result;
}

/** Returns null when the user can see everything, otherwise an array of user ids. */
async function visibleUserIds(user) {
  if (!user) return [];
  if (user.is_super_admin || user.data_scope === 'all') return null;
  if (user.data_scope === 'team') return [user.id, ...(await getSubordinateIds(user.id))];
  return [user.id];
}

/**
 * SQL fragment restricting rows to the visible users.
 * columns: one or more owner columns, e.g. ['t.owner_id'] or ['p.bd_owner_id','p.cs_owner_id'].
 */
async function scopeClause(user, columns) {
  const ids = await visibleUserIds(user);
  if (ids === null || !columns || !columns.length) return { sql: '', params: [] };
  const ph = ids.map(() => '?').join(',');
  const parts = columns.map((c) => `${c} IN (${ph})`);
  return { sql: ` AND (${parts.join(' OR ')})`, params: columns.flatMap(() => ids) };
}

module.exports = { visibleUserIds, scopeClause, getSubordinateIds, clearScopeCache };
