const { crudController } = require('../utils/crudFactory');

module.exports = crudController({
  table: 'milestones',
  module: 'tasks',
  select: `t.*, e.full_name AS owner_name, p.project_code, p.name AS project_name,
    CASE WHEN t.status NOT IN ('Completed','Cancelled') AND t.planned_date < CURDATE() THEN 1 ELSE 0 END AS is_overdue,
    DATEDIFF(COALESCE(t.actual_date, CURDATE()), t.planned_date) AS delay_days`,
  joins: 'LEFT JOIN employees e ON e.id = t.owner_id LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'title', 'milestone_type', 'planned_date', 'actual_date', 'owner_id', 'status', 'notes'],
  required: ['project_id', 'title'],
  searchFields: ['t.title', 'p.name'],
  filters: { project_id: 't.project_id', status: 't.status', milestone_type: 't.milestone_type', owner_id: 't.owner_id' },
  dateField: 't.planned_date',
  defaultSort: 't.planned_date ASC',
  beforeSave: async (data) => {
    if (data.status === 'Completed' && !data.actual_date) data.actual_date = new Date().toISOString().slice(0, 10);
    return data;
  },
});
