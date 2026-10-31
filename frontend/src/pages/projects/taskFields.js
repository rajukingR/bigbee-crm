import { PRIORITIES, TASK_STATUSES, MILESTONE_TYPES, MILESTONE_STATUSES, toOptions } from '../../utils/constants';

export const TASK_FIELDS = (withProject = true) => [
  { name: 'title', label: 'Task', required: true, col: 'full' },
  ...(withProject
    ? [{ name: 'project_id', label: 'Project', type: 'select', remote: { endpoint: '/projects', label: (r) => `${r.project_code} – ${r.name}` }, onChange: (v) => ({ ...v, milestone_id: '', depends_on: '' }) }]
    : []),
  { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: (e) => `${e.full_name}${e.role_name ? ' – ' + e.role_name : ''}` },
  { name: 'department_id', label: 'Department', type: 'select', lookup: 'departments', help: 'Defaults to the owner’s department' },
  { name: 'priority', label: 'Priority', type: 'select', options: toOptions(PRIORITIES), allowEmpty: false },
  { name: 'status', label: 'Status', type: 'select', options: toOptions(TASK_STATUSES), allowEmpty: false },
  { name: 'start_date', label: 'Start Date', type: 'date' },
  { name: 'due_date', label: 'Due Date & Time', type: 'datetime' },
  {
    name: 'milestone_id',
    label: 'Milestone',
    type: 'select',
    remote: { endpoint: '/milestones', label: (r) => r.title, params: (v) => ({ project_id: v.project_id }), enabledIf: (v) => !!v.project_id },
    hidden: (v) => !v.project_id,
  },
  {
    name: 'depends_on',
    label: 'Depends on (task)',
    type: 'select',
    remote: { endpoint: '/tasks', label: (r) => r.title, params: (v) => ({ project_id: v.project_id }), enabledIf: (v) => !!v.project_id },
    hidden: (v) => !v.project_id,
  },
  { name: 'description', label: 'Notes / Checklist', type: 'textarea' },
];

export const TASK_KEYS = ['title', 'description', 'project_id', 'milestone_id', 'depends_on', 'owner_id', 'department_id', 'priority', 'start_date', 'due_date', 'status', 'related_type', 'related_id'];

export const MILESTONE_FIELDS = [
  { name: 'title', label: 'Milestone', required: true, col: 'full' },
  { name: 'milestone_type', label: 'Type', type: 'select', options: toOptions(MILESTONE_TYPES), allowEmpty: false },
  { name: 'status', label: 'Status', type: 'select', options: toOptions(MILESTONE_STATUSES), allowEmpty: false },
  { name: 'planned_date', label: 'Planned Date', type: 'date' },
  { name: 'actual_date', label: 'Actual Date', type: 'date' },
  { name: 'owner_id', label: 'Owner', type: 'select', lookup: 'employees', labelKey: 'full_name' },
  { name: 'notes', label: 'Notes', type: 'textarea' },
];
