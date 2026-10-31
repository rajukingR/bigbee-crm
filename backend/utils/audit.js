const { query } = require('../config/db');

/** Record who created / edited / approved / deleted / exported what. Never throws. */
async function logAudit(req, action, module, entityId = null, details = null) {
  try {
    const u = req.user || {};
    await query(
      'INSERT INTO audit_logs (user_id, user_name, action, module, entity_id, details, ip_address) VALUES (?,?,?,?,?,?,?)',
      [
        u.id || null,
        u.full_name || null,
        action,
        module,
        entityId,
        details ? JSON.stringify(details) : null,
        (req.headers['x-forwarded-for'] || req.ip || '').toString().slice(0, 60),
      ]
    );
  } catch (e) {
    console.error('audit log failed:', e.message);
  }
}

/** Return only the fields that changed between two objects. */
function diff(before = {}, after = {}) {
  const out = {};
  Object.keys(after).forEach((k) => {
    const a = before[k] === undefined || before[k] === null ? null : String(before[k]);
    const b = after[k] === undefined || after[k] === null ? null : String(after[k]);
    if (a !== b) out[k] = { from: before[k] ?? null, to: after[k] ?? null };
  });
  return out;
}

module.exports = { logAudit, diff };
