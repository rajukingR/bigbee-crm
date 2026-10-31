const { query } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler } = require('../utils/helpers');
const { scopeClause } = require('../utils/scope');

const ctrl = crudController({
  table: 'execution_items',
  module: 'execution',
  select: `t.*, e.full_name AS owner_name, v.name AS vendor_name, p.project_code, p.name AS project_name,
    CASE WHEN t.status NOT IN ('Ready','Done') AND t.due_date < NOW() THEN 1 ELSE 0 END AS is_overdue`,
  joins: 'LEFT JOIN employees e ON e.id = t.owner_id LEFT JOIN vendors v ON v.id = t.vendor_id LEFT JOIN projects p ON p.id = t.project_id',
  fields: ['project_id', 'category', 'item', 'details', 'owner_id', 'vendor_id', 'due_date', 'status', 'remarks'],
  required: ['project_id', 'item'],
  searchFields: ['t.item', 't.details'],
  filters: { project_id: 't.project_id', category: 't.category', status: 't.status', owner_id: 't.owner_id', vendor_id: 't.vendor_id' },
  dateField: 't.due_date',
  defaultSort: 't.category, t.due_date',
});

/** Readiness per project for the Execution Tracker board. */
ctrl.summary = asyncHandler(async (req, res) => {
  const s = await scopeClause(req.user, ['p.cs_owner_id', 'p.ops_owner_id', 'p.manager_id', 'p.bd_owner_id']);
  let where = " WHERE p.status NOT IN ('Closed','Cancelled')";
  const params = [];
  if (req.query.search) { where += ' AND (p.name LIKE ? OR p.project_code LIKE ?)'; params.push(`%${req.query.search}%`, `%${req.query.search}%`); }
  const rows = await query(
    `SELECT p.id, p.project_code, p.name, p.status, p.health, p.event_start, p.event_end, p.location, p.event_day_status,
            c.name AS company_name, op.full_name AS ops_owner_name,
            COUNT(x.id) AS total_items,
            SUM(x.status IN ('Ready','Done')) AS ready_items,
            SUM(x.status = 'Issue') AS issue_items,
            SUM(x.status NOT IN ('Ready','Done') AND x.due_date < NOW()) AS overdue_items,
            (SELECT COUNT(*) FROM incidents i WHERE i.project_id = p.id) AS incidents,
            (SELECT COUNT(*) FROM purchase_orders po WHERE po.project_id = p.id AND po.delivery_status <> 'Delivered' AND po.status IN ('Approved','Issued')) AS pending_vendor,
            (SELECT COUNT(*) FROM milestones m WHERE m.project_id = p.id AND m.milestone_type = 'Client Approval' AND m.status NOT IN ('Completed','Cancelled')) AS pending_approvals
       FROM projects p LEFT JOIN companies c ON c.id = p.company_id LEFT JOIN employees op ON op.id = p.ops_owner_id
       LEFT JOIN execution_items x ON x.project_id = p.id
     ${where} ${s.sql}
      GROUP BY p.id ORDER BY p.event_start IS NULL, p.event_start`,
    [...params, ...s.params]
  );
  res.json(rows.map((r) => ({ ...r, readiness: r.total_items ? Math.round((Number(r.ready_items) / Number(r.total_items)) * 100) : 0 })));
});

module.exports = ctrl;
