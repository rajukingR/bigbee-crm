const { query, queryOne } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { notify } = require('../utils/notify');
const { getSubordinateIds } = require('../utils/scope');

async function refreshProjectProgress(projectId) {
  if (!projectId) return;
  const r = await queryOne(
    "SELECT COUNT(*) AS total, SUM(status = 'Completed') AS done FROM tasks WHERE project_id = ? AND status <> 'Cancelled'",
    [projectId]
  );
  const progress = r.total ? Math.round((Number(r.done) / Number(r.total)) * 100) : 0;
  await query('UPDATE projects SET progress = ? WHERE id = ?', [progress, projectId]);
}

const ctrl = crudController({
  table: 'tasks',
  module: 'tasks',
  select: `t.*, e.full_name AS owner_name, d.name AS department_name, p.project_code, p.name AS project_name,
    m.title AS milestone_title, cb.full_name AS created_by_name, dep.title AS depends_on_title,
    CASE WHEN t.status NOT IN ('Completed','Cancelled') AND t.due_date < NOW() THEN 1 ELSE 0 END AS is_overdue,
    (SELECT COUNT(*) FROM task_comments c WHERE c.task_id = t.id) AS comment_count`,
  joins: `LEFT JOIN employees e ON e.id = t.owner_id LEFT JOIN departments d ON d.id = t.department_id
    LEFT JOIN projects p ON p.id = t.project_id LEFT JOIN milestones m ON m.id = t.milestone_id
    LEFT JOIN employees cb ON cb.id = t.created_by LEFT JOIN tasks dep ON dep.id = t.depends_on`,
  fields: ['title', 'description', 'related_type', 'related_id', 'project_id', 'milestone_id', 'parent_id', 'depends_on', 'owner_id', 'department_id', 'priority', 'start_date', 'due_date', 'status'],
  trackCreator: true,
  required: ['title'],
  searchFields: ['t.title', 't.description', 'p.project_code', 'p.name'],
  filters: {
    status: 't.status', priority: 't.priority', project_id: 't.project_id', owner_id: 't.owner_id',
    department_id: 't.department_id', related_type: 't.related_type', related_id: 't.related_id', milestone_id: 't.milestone_id',
  },
  dateField: 't.due_date',
  ownerColumns: ['t.owner_id', 't.created_by', 'p.manager_id', 'p.cs_owner_id', 'p.ops_owner_id'],
  defaultSort: 't.due_date IS NULL, t.due_date ASC',
  sortable: ['t.due_date', 't.priority', 't.created_at'],
  extraWhere: async (req) => {
    const v = req.query.view;
    if (v === 'my') return { sql: ' AND t.owner_id = ?', params: [req.user.id] };
    if (v === 'team') {
      const ids = await getSubordinateIds(req.user.id);
      if (!ids.length) return { sql: ' AND 1=0', params: [] };
      return { sql: ` AND t.owner_id IN (${ids.map(() => '?').join(',')})`, params: ids };
    }
    if (v === 'overdue') return { sql: " AND t.status NOT IN ('Completed','Cancelled') AND t.due_date < NOW()", params: [] };
    if (v === 'open') return { sql: " AND t.status NOT IN ('Completed','Cancelled')", params: [] };
    return null;
  },
  beforeSave: async (data, req, existing) => {
    if (!existing && !data.owner_id) data.owner_id = req.user.id;
    if (data.owner_id && !data.department_id) {
      const o = await queryOne('SELECT department_id FROM employees WHERE id = ?', [data.owner_id]);
      if (o) data.department_id = o.department_id;
    }
    if (data.project_id && !data.related_type) {
      data.related_type = 'project';
      data.related_id = data.project_id;
    }
    if (data.status === 'Completed' && (!existing || existing.status !== 'Completed')) {
      const dep = existing && existing.depends_on ? await queryOne('SELECT status, title FROM tasks WHERE id = ?', [existing.depends_on]) : null;
      if (dep && dep.status !== 'Completed') throw new ApiError(409, `Depends on "${dep.title}" which is not completed yet`);
      data.completed_at = new Date();
    }
    if (data.status && data.status !== 'Completed') data.completed_at = null;
    return data;
  },
  afterCreate: async (row, req) => {
    if (row.owner_id && row.owner_id !== req.user.id) {
      await notify(row.owner_id, 'New task assigned', row.title, row.project_id ? `/projects/${row.project_id}` : '/tasks', 'task');
    }
    await refreshProjectProgress(row.project_id);
  },
  afterUpdate: async (row, existing, req) => {
    if (row.owner_id && row.owner_id !== existing.owner_id && row.owner_id !== req.user.id) {
      await notify(row.owner_id, 'Task assigned to you', row.title, row.project_id ? `/projects/${row.project_id}` : '/tasks', 'task');
    }
    await refreshProjectProgress(row.project_id);
  },
});

ctrl.comments = asyncHandler(async (req, res) => {
  res.json(await query(
    'SELECT c.*, e.full_name AS user_name FROM task_comments c LEFT JOIN employees e ON e.id = c.user_id WHERE c.task_id = ? ORDER BY c.id DESC',
    [req.params.id]
  ));
});

ctrl.addComment = asyncHandler(async (req, res) => {
  if (!req.body.comment) throw new ApiError(400, 'Comment is required');
  await query('INSERT INTO task_comments (task_id, comment, user_id) VALUES (?,?,?)', [req.params.id, req.body.comment, req.user.id]);
  const t = await queryOne('SELECT owner_id, title, project_id FROM tasks WHERE id = ?', [req.params.id]);
  if (t && t.owner_id !== req.user.id) await notify(t.owner_id, 'New comment on task', `${t.title}: ${req.body.comment.slice(0, 120)}`, t.project_id ? `/projects/${t.project_id}` : '/tasks', 'task');
  res.status(201).json({ message: 'Comment added' });
});

module.exports = ctrl;
