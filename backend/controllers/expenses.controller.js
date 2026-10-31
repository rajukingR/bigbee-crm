const { crudController } = require('../utils/crudFactory');
const { ApiError, num } = require('../utils/helpers');
const { getNumber } = require('../utils/settings');
const { createApproval } = require('../utils/approvals');
const { hasPermission } = require('../middleware/auth');

module.exports = crudController({
  table: 'expenses',
  module: 'expenses',
  select: 't.*, p.project_code, p.name AS project_name, v.name AS vendor_name, e.full_name AS paid_by_name, a.full_name AS approved_by_name',
  joins: 'LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN vendors v ON v.id = t.vendor_id LEFT JOIN employees e ON e.id = t.paid_by LEFT JOIN employees a ON a.id = t.approved_by',
  fields: ['project_id', 'vendor_id', 'category', 'description', 'amount', 'expense_date', 'paid_by', 'status'],
  trackCreator: true,
  required: ['amount'],
  searchFields: ['t.expense_code', 't.description', 't.category', 'p.project_code', 'p.name'],
  filters: { project_id: 't.project_id', status: 't.status', category: 't.category', paid_by: 't.paid_by' },
  dateField: 't.expense_date',
  codeField: 'expense_code',
  codePrefix: 'EXP',
  ownerColumns: ['t.created_by', 't.paid_by'],
  beforeSave: async (data, req, existing) => {
    if (!existing) {
      data.paid_by = data.paid_by || req.user.id;
      data.expense_date = data.expense_date || new Date().toISOString().slice(0, 10);
      const limit = await getNumber('expense_approval_limit', 25000);
      data.status = num(data.amount) > limit ? 'Pending Approval' : 'Approved';
    } else if (data.status && data.status !== existing.status && !hasPermission(req.user, 'expenses', 'approve')) {
      throw new ApiError(403, 'You cannot change expense status');
    }
    return data;
  },
  afterCreate: async (row, req) => {
    if (row.status === 'Pending Approval') {
      await createApproval({
        entityType: 'expense', entityId: row.id, requestType: 'Expense',
        title: `${row.expense_code} – ${row.description || row.category || ''}${row.project_code ? ' (' + row.project_code + ')' : ''}`,
        amount: row.amount, reason: 'Above expense approval limit', req, link: '/finance/expenses',
      });
    }
  },
});
