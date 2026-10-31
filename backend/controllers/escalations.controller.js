const { queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { notify } = require('../utils/notify');

module.exports = crudController({
  table: 'escalations',
  module: 'escalations',
  select: 't.*, a.full_name AS raised_by_name, b.full_name AS escalated_to_name, p.project_code, p.name AS project_name',
  joins: 'LEFT JOIN employees a ON a.id = t.raised_by LEFT JOIN employees b ON b.id = t.escalated_to LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'escalation_type', 'title', 'description', 'severity', 'escalated_to', 'status', 'resolution'],
  required: ['title'],
  searchFields: ['t.title', 'p.name', 'p.project_code'],
  filters: { project_id: 't.project_id', status: 't.status', severity: 't.severity', escalation_type: 't.escalation_type', escalated_to: 't.escalated_to' },
  dateField: 't.created_at',
  ownerColumns: ['t.raised_by', 't.escalated_to', 'p.manager_id', 'p.cs_owner_id', 'p.ops_owner_id', 'p.bd_owner_id'],
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.raised_by = req.user.id;
      if (!data.escalated_to) {
        const me = await queryOne('SELECT reports_to FROM employees WHERE id = ?', [req.user.id]);
        data.escalated_to = me ? me.reports_to : null;
      }
    }
    if ((data.status === 'Resolved' || data.status === 'Closed') && (!existing || !existing.resolved_at)) data.resolved_at = new Date();
    return data;
  },
  afterCreate: async (row) => {
    await notify(row.escalated_to, `Escalation: ${row.title}`, `${row.severity} ${row.escalation_type}${row.project_code ? ' on ' + row.project_code : ''}`, row.project_id ? `/projects/${row.project_id}` : '/feedback/escalations', 'escalation');
  },
});
