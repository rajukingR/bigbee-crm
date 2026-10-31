const jwt = require('jsonwebtoken');
const { query, queryOne } = require('../config/db');
const { ACTIONS } = require('../utils/modules');

/** Load the user with role, data scope and permission map. */
async function loadUser(id) {
  const user = await queryOne(
    `SELECT e.id, e.employee_code, e.full_name, e.email, e.phone, e.photo, e.role_id, e.department_id,
            e.reports_to, e.designation, e.is_super_admin, e.active_status,
            r.name AS role_name, r.data_scope, r.level AS role_level, d.name AS department_name, d.code AS department_code
       FROM employees e
       LEFT JOIN roles r ON r.id = e.role_id
       LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.id = ?`,
    [id]
  );
  if (!user) return null;
  const perms = {};
  if (user.role_id) {
    const rows = await query('SELECT * FROM permissions WHERE role_id = ?', [user.role_id]);
    rows.forEach((p) => {
      perms[p.module] = {};
      ACTIONS.forEach((a) => (perms[p.module][a] = !!p['can_' + a]));
    });
  }
  user.permissions = perms;
  user.is_super_admin = !!user.is_super_admin;
  if (!user.data_scope) user.data_scope = 'own';
  return user;
}

async function authenticate(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : req.query.token;
    if (!token) return res.status(401).json({ message: 'Not authenticated' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await loadUser(payload.id);
    if (!user || !user.active_status) return res.status(401).json({ message: 'Account inactive or not found' });
    req.user = user;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Session expired, please login again' });
  }
}

function hasPermission(user, module, action = 'view') {
  if (!user) return false;
  if (user.is_super_admin) return true;
  return !!(user.permissions[module] && user.permissions[module][action]);
}

/** authorize('leads','create') or authorize(['projects','execution'],'view') (any of). */
function authorize(modules, action = 'view') {
  const list = Array.isArray(modules) ? modules : [modules];
  return (req, res, next) => {
    if (list.some((m) => hasPermission(req.user, m, action))) return next();
    return res.status(403).json({ message: `You do not have ${action} permission for this module` });
  };
}

module.exports = { authenticate, authorize, hasPermission, loadUser };
