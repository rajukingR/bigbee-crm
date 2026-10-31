const { crudController } = require('../utils/crudFactory');

module.exports = crudController({
  table: 'incidents',
  module: 'execution',
  select: 't.*, e.full_name AS reported_by_name, p.project_code, p.name AS project_name',
  joins: 'LEFT JOIN employees e ON e.id = t.reported_by LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'title', 'description', 'incident_type', 'severity', 'action_taken', 'occurred_at'],
  required: ['project_id', 'title'],
  searchFields: ['t.title', 't.description'],
  filters: { project_id: 't.project_id', incident_type: 't.incident_type', severity: 't.severity' },
  dateField: 't.occurred_at',
  defaultSort: 't.occurred_at DESC',
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.reported_by = req.user.id;
      data.occurred_at = data.occurred_at || new Date();
    }
    return data;
  },
});
