/** Wrap async route handlers so errors reach the error middleware. */
const asyncHandler = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Pick allowed fields from body, converting '' to null. */
function pick(body = {}, fields = []) {
  const out = {};
  for (const f of fields) {
    if (Object.prototype.hasOwnProperty.call(body, f)) {
      let v = body[f];
      if (v === '' || v === undefined || v === 'null') v = null;
      if (typeof v === 'boolean') v = v ? 1 : 0;
      if (v !== null && typeof v === 'object' && !(v instanceof Date)) v = JSON.stringify(v);
      out[f] = v;
    }
  }
  return out;
}

function paginate(q) {
  const page = Math.max(1, parseInt(q.page, 10) || 1);
  const all = q.all === '1' || q.all === 'true';
  const limit = all ? 5000 : Math.min(500, Math.max(1, parseInt(q.limit, 10) || 10));
  return { page, limit, offset: (page - 1) * limit };
}

function num(v) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

function round2(n) {
  return Math.round((num(n) + Number.EPSILON) * 100) / 100;
}

/** Build "INSERT" SQL from an object. */
function insertSql(table, data) {
  const cols = Object.keys(data);
  return {
    sql: `INSERT INTO ${table} (${cols.map((c) => '`' + c + '`').join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
    params: cols.map((c) => data[c]),
  };
}

/** Build "UPDATE" SQL from an object. */
function updateSql(table, data, id) {
  const cols = Object.keys(data);
  return {
    sql: `UPDATE ${table} SET ${cols.map((c) => '`' + c + '` = ?').join(', ')} WHERE id = ?`,
    params: [...cols.map((c) => data[c]), id],
  };
}

function codeFor(prefix, id, pad = 5) {
  return `${prefix}${String(id).padStart(pad, '0')}`;
}

module.exports = { asyncHandler, ApiError, pick, paginate, num, round2, insertSql, updateSql, codeFor };
