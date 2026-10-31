const { crudController } = require('../utils/crudFactory');
const { queryOne } = require('../config/db');
const { ApiError } = require('../utils/helpers');

module.exports = crudController({
  table: 'departments',
  module: 'departments',
  select: `t.*, h.full_name AS head_name,
           (SELECT COUNT(*) FROM employees e WHERE e.department_id = t.id) AS employee_count`,
  joins: 'LEFT JOIN employees h ON h.id = t.head_id',
  fields: ['name', 'code', 'head_id', 'description', 'status'],
  required: ['name', 'code'],
  searchFields: ['t.name', 't.code'],
  filters: { status: 't.status' },
  defaultSort: 't.name ASC',
  beforeDelete: async (row) => {
    const c = await queryOne('SELECT COUNT(*) AS c FROM employees WHERE department_id = ?', [row.id]);
    if (c.c > 0) throw new ApiError(409, 'Department has employees. Move them before deleting.');
  },
});
