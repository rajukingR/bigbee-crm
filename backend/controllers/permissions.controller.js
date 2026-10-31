const { query, queryOne, transaction } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { MODULES, ACTIONS } = require('../utils/modules');
const { logAudit } = require('../utils/audit');

exports.modules = asyncHandler(async (req, res) => {
  res.json({ modules: MODULES, actions: ACTIONS });
});

exports.getRolePermissions = asyncHandler(async (req, res) => {
  const role = await queryOne('SELECT * FROM roles WHERE id = ?', [req.params.roleId]);
  if (!role) throw new ApiError(404, 'Role not found');
  const rows = await query('SELECT * FROM permissions WHERE role_id = ?', [role.id]);
  const matrix = {};
  MODULES.forEach((m) => {
    const p = rows.find((r) => r.module === m.key) || {};
    matrix[m.key] = {};
    ACTIONS.forEach((a) => (matrix[m.key][a] = !!p['can_' + a]));
  });
  res.json({ role, permissions: matrix });
});

exports.saveRolePermissions = asyncHandler(async (req, res) => {
  const roleId = Number(req.params.roleId);
  const role = await queryOne('SELECT * FROM roles WHERE id = ?', [roleId]);
  if (!role) throw new ApiError(404, 'Role not found');
  const matrix = req.body.permissions || {};
  const validKeys = new Set(MODULES.map((m) => m.key));
  await transaction(async (conn) => {
    for (const [module, acts] of Object.entries(matrix)) {
      if (!validKeys.has(module)) continue;
      const vals = ACTIONS.map((a) => (acts && acts[a] ? 1 : 0));
      await conn.query(
        `INSERT INTO permissions (role_id, module, ${ACTIONS.map((a) => 'can_' + a).join(',')})
         VALUES (?, ?, ${ACTIONS.map(() => '?').join(',')})
         ON DUPLICATE KEY UPDATE ${ACTIONS.map((a) => `can_${a} = VALUES(can_${a})`).join(', ')}`,
        [roleId, module, ...vals]
      );
    }
  });
  await logAudit(req, 'update_permissions', 'permissions', roleId, matrix);
  res.json({ message: 'Permissions saved' });
});
