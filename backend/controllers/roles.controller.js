const { crudController } = require('../utils/crudFactory');
const { query, queryOne } = require('../config/db');
const { ApiError } = require('../utils/helpers');

module.exports = crudController({
  table: 'roles',
  module: 'roles',
  select: `t.*, d.name AS department_name,
           (SELECT COUNT(*) FROM employees e WHERE e.role_id = t.id) AS employee_count`,
  joins: 'LEFT JOIN departments d ON d.id = t.department_id',
  fields: ['name', 'department_id', 'level', 'data_scope', 'description', 'status'],
  required: ['name'],
  searchFields: ['t.name', 'd.name'],
  filters: { department_id: 't.department_id', status: 't.status' },
  defaultSort: 't.level ASC, t.name ASC',
  afterCreate: async (row, req) => {
    // Optionally copy permissions from an existing role
    const from = req.body.copy_from_role_id;
    if (from) {
      await query(
        `INSERT INTO permissions (role_id, module, can_view, can_create, can_edit, can_delete, can_export, can_approve)
         SELECT ?, module, can_view, can_create, can_edit, can_delete, can_export, can_approve FROM permissions WHERE role_id = ?`,
        [row.id, from]
      );
    }
  },
  beforeDelete: async (row) => {
    if (row.is_system) throw new ApiError(400, 'System role cannot be deleted');
    const c = await queryOne('SELECT COUNT(*) AS c FROM employees WHERE role_id = ?', [row.id]);
    if (c.c > 0) throw new ApiError(409, 'Role is assigned to employees. Reassign them first.');
  },
});
