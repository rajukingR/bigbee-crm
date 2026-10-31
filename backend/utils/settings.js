const { query } = require('../config/db');

let cache = { at: 0, map: {} };

async function getSettings() {
  if (Date.now() - cache.at < 30 * 1000) return cache.map;
  const rows = await query('SELECT setting_key, setting_value FROM settings');
  const map = {};
  rows.forEach((r) => (map[r.setting_key] = r.setting_value));
  cache = { at: Date.now(), map };
  return map;
}

async function getSetting(key, fallback = null) {
  const map = await getSettings();
  return map[key] !== undefined && map[key] !== null ? map[key] : fallback;
}

async function getNumber(key, fallback = 0) {
  const v = parseFloat(await getSetting(key, fallback));
  return Number.isFinite(v) ? v : fallback;
}

function clearSettingsCache() {
  cache = { at: 0, map: {} };
}

module.exports = { getSettings, getSetting, getNumber, clearSettingsCache };
