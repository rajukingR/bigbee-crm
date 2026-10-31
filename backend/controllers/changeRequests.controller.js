const { queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { createApproval } = require('../utils/approvals');

const ctrl = crudController({
  table: 'change_requests',
  module: 'escalations',
  select: 't.*, e.full_name AS requested_by_name, a.full_name AS approved_by_name, p.project_code, p.name AS project_name',
  joins: 'LEFT JOIN employees e ON e.id = t.requested_by LEFT JOIN employees a ON a.id = t.approved_by LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'title', 'description', 'cost_impact', 'revenue_impact', 'time_impact_days'],
  required: ['project_id', 'title'],
  searchFields: ['t.title', 'p.name', 'p.project_code'],
  filters: { project_id: 't.project_id', status: 't.status' },
  dateField: 't.created_at',
  beforeSave: async (data, req, existing) => {
    if (existing && existing.status !== 'Requested') throw new ApiError(409, 'Approved / rejected change requests cannot be edited');
    if (!existing) data.requested_by = req.user.id;
    return data;
  },
  afterCreate: async (row, req) => {
    await createApproval({
      entityType: 'change_request', entityId: row.id, requestType: 'Change request',
      title: `${row.project_code || ''} – ${row.title}`, amount: row.revenue_impact,
      reason: `Cost impact ₹${row.cost_impact}, time impact ${row.time_impact_days} day(s)`, req, link: `/projects/${row.project_id}`,
    });
  },
});

ctrl.resubmit = asyncHandler(async (req, res) => {
  const cr = await queryOne('SELECT c.*, p.project_code FROM change_requests c LEFT JOIN projects p ON p.id = c.project_id WHERE c.id = ?', [req.params.id]);
  if (!cr) throw new ApiError(404, 'Not found');
  await createApproval({ entityType: 'change_request', entityId: cr.id, requestType: 'Change request', title: `${cr.project_code} – ${cr.title}`, amount: cr.revenue_impact, req, link: `/projects/${cr.project_id}` });
  res.json({ message: 'Sent for approval' });
});

module.exports = ctrl;
