const { query } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { salesMetrics } = require('../utils/metrics');
const { visibleUserIds } = require('../utils/scope');

const ctrl = crudController({
  table: 'targets',
  module: 'targets',
  select: 't.*, e.full_name AS employee_name, d.name AS department_name',
  joins: 'LEFT JOIN employees e ON e.id = t.employee_id LEFT JOIN departments d ON d.id = t.department_id',
  fields: ['period_type', 'period_start', 'period_end', 'scope', 'department_id', 'employee_id', 'target_value', 'coverage_multiple', 'activity_target_calls', 'activity_target_meetings', 'activity_target_proposals', 'incentive_pct', 'notes'],
  trackCreator: true,
  required: ['period_start', 'period_end', 'scope', 'target_value'],
  searchFields: ['e.full_name', 'd.name'],
  filters: { scope: 't.scope', period_type: 't.period_type', employee_id: 't.employee_id', department_id: 't.department_id' },
  dateField: 't.period_start',
  defaultSort: 't.period_start DESC',
  beforeSave: async (data) => {
    if (data.scope === 'Employee' && data.employee_id === null) throw new ApiError(400, 'Select an employee');
    if (data.scope === 'Department' && data.department_id === null) throw new ApiError(400, 'Select a department');
    return data;
  },
});

/** Target vs achieved, gap, coverage and forecast for each target. */
ctrl.achievement = asyncHandler(async (req, res) => {
  const visible = await visibleUserIds(req.user);
  let where = ' WHERE 1=1';
  const params = [];
  if (req.query.from) { where += ' AND t.period_end >= ?'; params.push(req.query.from); }
  if (req.query.to) { where += ' AND t.period_start <= ?'; params.push(req.query.to); }
  if (req.query.scope) { where += ' AND t.scope = ?'; params.push(req.query.scope); }
  if (visible) { where += ` AND t.scope = 'Employee' AND t.employee_id IN (${visible.map(() => '?').join(',')})`; params.push(...visible); }
  const targets = await query(
    `SELECT t.*, e.full_name AS employee_name, d.name AS department_name FROM targets t
       LEFT JOIN employees e ON e.id = t.employee_id LEFT JOIN departments d ON d.id = t.department_id
     ${where} ORDER BY t.period_start DESC LIMIT 200`,
    params
  );
  const out = [];
  for (const t of targets) {
    const who = t.scope === 'Employee' ? { employeeIds: [t.employee_id] } : t.scope === 'Department' ? { departmentId: t.department_id } : {};
    const m = await salesMetrics(who, t.period_start, t.period_end);
    const target = Number(t.target_value);
    const gap = Math.max(0, target - m.won_value);
    out.push({
      ...t,
      ...m,
      achievement_pct: target ? Math.round((m.won_value / target) * 1000) / 10 : 0,
      gap,
      coverage_actual: gap ? Math.round((m.pipeline_weighted / gap) * 10) / 10 : null,
      coverage_unweighted: gap ? Math.round((m.pipeline_unweighted / gap) * 10) / 10 : null,
      coverage_required: Number(t.coverage_multiple),
      incentive_earned: Math.round((m.won_value * Number(t.incentive_pct || 0)) / 100),
    });
  }
  res.json(out);
});

module.exports = ctrl;
