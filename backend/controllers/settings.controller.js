const { query } = require('../config/db');
const { asyncHandler } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { clearSettingsCache } = require('../utils/settings');

exports.list = asyncHandler(async (req, res) => {
  res.json(await query('SELECT * FROM settings ORDER BY setting_group, setting_key'));
});

exports.save = asyncHandler(async (req, res) => {
  const values = req.body.settings || {};
  for (const [k, v] of Object.entries(values)) {
    await query('UPDATE settings SET setting_value = ? WHERE setting_key = ?', [v === null ? null : String(v), k]);
  }
  clearSettingsCache();
  await logAudit(req, 'update', 'settings', null, values);
  res.json({ message: 'Settings saved' });
});
