const { query, queryOne } = require('../config/db');

/**
 * Create an in-app notification. When refKey is given, the same
 * notification is not repeated for that user on the same day.
 */
async function notify(userIds, title, message = null, link = null, type = 'info', refKey = null) {
  const ids = [...new Set((Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean))];
  for (const uid of ids) {
    try {
      if (refKey) {
        const dup = await queryOne(
          'SELECT id FROM notifications WHERE user_id = ? AND ref_key = ? AND DATE(created_at) = CURDATE()',
          [uid, refKey]
        );
        if (dup) continue;
      }
      await query(
        'INSERT INTO notifications (user_id, title, message, link, notif_type, ref_key) VALUES (?,?,?,?,?,?)',
        [uid, title, message, link, type, refKey]
      );
    } catch (e) {
      console.error('notify failed:', e.message);
    }
  }
}

async function managerOf(userId) {
  const r = await queryOne('SELECT reports_to FROM employees WHERE id = ?', [userId]);
  return r ? r.reports_to : null;
}

module.exports = { notify, managerOf };
