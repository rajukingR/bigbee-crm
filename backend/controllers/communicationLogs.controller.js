const { crudController } = require('../utils/crudFactory');

module.exports = crudController({
  table: 'communication_logs',
  module: 'projects',
  select: 't.*, e.full_name AS logged_by_name, p.project_code, p.name AS project_name',
  joins: 'LEFT JOIN employees e ON e.id = t.logged_by LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'log_type', 'subject', 'notes', 'commitments', 'log_date'],
  required: ['project_id', 'subject'],
  searchFields: ['t.subject', 't.notes'],
  filters: { project_id: 't.project_id', log_type: 't.log_type' },
  dateField: 't.log_date',
  defaultSort: 't.log_date DESC',
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.logged_by = req.user.id;
      data.log_date = data.log_date || new Date();
    }
    return data;
  },
});
