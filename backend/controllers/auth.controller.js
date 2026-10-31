const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { loadUser } = require('../middleware/auth');
const { logAudit } = require('../utils/audit');
const { publicPath, removeFile } = require('../middleware/upload');

function sign(user) {
  return jwt.sign({ id: user.id, role_id: user.role_id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '12h',
  });
}

exports.login = asyncHandler(async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) throw new ApiError(400, 'Email and password are required');
  const row = await queryOne('SELECT id, password_hash, active_status FROM employees WHERE email = ?', [email.trim()]);
  if (!row || !(await bcrypt.compare(password, row.password_hash))) throw new ApiError(401, 'Invalid email or password');
  if (!row.active_status) throw new ApiError(403, 'Your account is deactivated. Contact the administrator.');
  await query('UPDATE employees SET last_login = NOW() WHERE id = ?', [row.id]);
  const user = await loadUser(row.id);
  req.user = user;
  await logAudit(req, 'login', 'auth', user.id);
  res.json({ token: sign(user), user });
});

exports.me = asyncHandler(async (req, res) => {
  res.json(req.user);
});

exports.changePassword = asyncHandler(async (req, res) => {
  const { current_password, new_password } = req.body || {};
  if (!new_password || new_password.length < 6) throw new ApiError(400, 'New password must be at least 6 characters');
  const row = await queryOne('SELECT password_hash FROM employees WHERE id = ?', [req.user.id]);
  if (!(await bcrypt.compare(current_password || '', row.password_hash))) throw new ApiError(400, 'Current password is incorrect');
  await query('UPDATE employees SET password_hash = ? WHERE id = ?', [await bcrypt.hash(new_password, 10), req.user.id]);
  await logAudit(req, 'change_password', 'auth', req.user.id);
  res.json({ message: 'Password updated' });
});

exports.updateProfile = asyncHandler(async (req, res) => {
  const { full_name, phone } = req.body || {};
  const updates = [];
  const params = [];
  if (full_name) { updates.push('full_name = ?'); params.push(full_name); }
  if (phone !== undefined) { updates.push('phone = ?'); params.push(phone || null); }
  if (req.file) {
    const old = await queryOne('SELECT photo FROM employees WHERE id = ?', [req.user.id]);
    if (old && old.photo) removeFile(old.photo);
    updates.push('photo = ?');
    params.push(publicPath(req.file));
  }
  if (updates.length) await query(`UPDATE employees SET ${updates.join(', ')} WHERE id = ?`, [...params, req.user.id]);
  res.json(await loadUser(req.user.id));
});
