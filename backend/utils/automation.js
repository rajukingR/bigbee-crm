/**
 * Background automation (runs every 30 minutes):
 *  - overdue lead / opportunity follow-ups -> owner + reporting manager
 *  - inactive leads and leads without a next action -> owner
 *  - overdue high-priority tasks -> escalate to manager
 *  - invoice collection follow-ups due -> finance owner
 *  - daily client bucket recalculation
 */
const { query } = require('../config/db');
const { notify } = require('./notify');
const { getNumber } = require('./settings');

async function overdueFollowUps() {
  const leads = await query(
    `SELECT l.id, l.lead_code, COALESCE(l.company_name, l.contact_name) AS name, l.owner_id, e.reports_to
       FROM leads l LEFT JOIN employees e ON e.id = l.owner_id
      WHERE l.is_converted = 0 AND l.next_follow_up < NOW() LIMIT 500`
  );
  for (const l of leads) {
    await notify([l.owner_id, l.reports_to], 'Overdue follow-up', `${l.lead_code} – ${l.name || ''}`, `/leads/${l.id}`, 'overdue', `lead-overdue-${l.id}`);
  }
  const opps = await query(
    `SELECT o.id, o.opp_code, o.title, o.owner_id, e.reports_to FROM opportunities o
       JOIN funnel_statuses f ON f.id = o.funnel_status_id LEFT JOIN employees e ON e.id = o.owner_id
      WHERE f.stage_type IN ('open','hold') AND o.next_follow_up < NOW() LIMIT 500`
  );
  for (const o of opps) {
    await notify([o.owner_id, o.reports_to], 'Overdue opportunity follow-up', `${o.opp_code} – ${o.title}`, `/opportunities/${o.id}`, 'overdue', `opp-overdue-${o.id}`);
  }
}

async function inactiveLeads() {
  const days = Math.floor(await getNumber('inactive_lead_days', 7));
  const rows = await query(
    `SELECT id, lead_code, owner_id, next_follow_up, next_action FROM leads
      WHERE is_converted = 0 AND qualification <> 'Disqualified'
        AND (COALESCE(last_activity_at, created_at) < DATE_SUB(NOW(), INTERVAL ${days} DAY)
             OR (next_follow_up IS NULL AND (next_action IS NULL OR next_action = '')))
      LIMIT 500`
  );
  for (const r of rows) {
    const noAction = !r.next_follow_up && !r.next_action;
    await notify(r.owner_id, noAction ? 'Lead has no next action' : 'Inactive lead', `${r.lead_code} needs attention`, `/leads/${r.id}`, 'warning', `lead-inactive-${r.id}`);
  }
}

async function escalateTasks() {
  const days = Math.floor(await getNumber('escalate_overdue_days', 2));
  const rows = await query(
    `SELECT t.id, t.title, t.owner_id, t.project_id, e.reports_to FROM tasks t LEFT JOIN employees e ON e.id = t.owner_id
      WHERE t.status NOT IN ('Completed','Cancelled') AND t.priority IN ('High','Urgent') AND t.escalated = 0
        AND t.due_date < DATE_SUB(NOW(), INTERVAL ${days} DAY) LIMIT 200`
  );
  for (const t of rows) {
    await query('UPDATE tasks SET escalated = 1 WHERE id = ?', [t.id]);
    await notify(t.reports_to, 'Task escalated (overdue)', t.title, t.project_id ? `/projects/${t.project_id}` : '/tasks', 'escalation', `task-esc-${t.id}`);
  }
  const ops = await query(
    `SELECT o.id, o.opp_code, o.title, e.reports_to FROM opportunities o JOIN funnel_statuses f ON f.id = o.funnel_status_id
       LEFT JOIN employees e ON e.id = o.owner_id
      WHERE f.stage_type = 'open' AND o.expected_value >= 1000000 AND o.next_follow_up < DATE_SUB(NOW(), INTERVAL ${days} DAY) LIMIT 200`
  );
  for (const o of ops) {
    await notify(o.reports_to, 'High-value opportunity overdue', `${o.opp_code} – ${o.title}`, `/opportunities/${o.id}`, 'escalation', `opp-esc-${o.id}`);
  }
}

async function collectionFollowUps() {
  const rows = await query(
    `SELECT id, invoice_no, owner_id FROM invoices
      WHERE status NOT IN ('Paid','Cancelled','Draft') AND (next_follow_up <= CURDATE() OR due_date < CURDATE()) LIMIT 300`
  );
  for (const r of rows) {
    await notify(r.owner_id, 'Collection follow-up due', `Invoice ${r.invoice_no} is due / overdue`, '/finance/invoices', 'finance', `inv-${r.id}`);
  }
}

async function recalcBuckets() {
  await query(`UPDATE companies c
      LEFT JOIN (SELECT company_id, SUM(confirmed_value + change_order_value) AS rev FROM projects WHERE status <> 'Cancelled' GROUP BY company_id) p ON p.company_id = c.id
      SET c.client_type = IF(COALESCE(p.rev,0) > 0, 'Existing Client', c.client_type),
          c.bucket = CASE WHEN COALESCE(p.rev,0) >= 5000000 THEN 'A' WHEN COALESCE(p.rev,0) >= 2000000 THEN 'B'
                          WHEN COALESCE(p.rev,0) > 0 THEN 'C' ELSE c.bucket END`);
}

/** Operations: execution checklist items overdue or flagged as an issue. */
async function executionAlerts() {
  const rows = await query(
    `SELECT x.id, x.item, x.status, x.owner_id, p.ops_owner_id, p.id AS project_id, p.project_code
       FROM execution_items x JOIN projects p ON p.id = x.project_id
      WHERE x.status NOT IN ('Ready','Done') AND (x.due_date < NOW() OR x.status = 'Issue')
        AND p.status NOT IN ('Closed','Cancelled') LIMIT 300`
  );
  for (const r of rows) {
    await notify([r.owner_id, r.ops_owner_id], r.status === 'Issue' ? 'Execution issue' : 'Execution item overdue', `${r.project_code}: ${r.item}`, `/execution/${r.project_id}`, 'execution', `exec-${r.id}`);
  }
}

/** Client Servicing: client approvals pending past their date; proposals awaiting client response. */
async function clientServicingAlerts() {
  const ms = await query(
    `SELECT m.id, m.title, p.id AS project_id, p.project_code, p.cs_owner_id, p.manager_id
       FROM milestones m JOIN projects p ON p.id = m.project_id
      WHERE m.milestone_type = 'Client Approval' AND m.status NOT IN ('Completed','Cancelled') AND m.planned_date < CURDATE() LIMIT 300`
  );
  for (const m of ms) {
    await notify([m.cs_owner_id, m.manager_id], 'Client approval overdue', `${m.project_code}: ${m.title}`, `/projects/${m.project_id}`, 'approval', `ms-${m.id}`);
  }
  const props = await query(
    `SELECT id, proposal_code, version, owner_id FROM proposals
      WHERE is_latest = 1 AND status = 'Sent' AND next_follow_up IS NOT NULL AND next_follow_up <= NOW() LIMIT 300`
  );
  for (const pr of props) {
    await notify(pr.owner_id, 'Proposal follow-up due', `${pr.proposal_code} v${pr.version} is awaiting client response`, `/proposals/${pr.id}`, 'proposal', `prop-${pr.id}`);
  }
}

/** Everyone (Creative, CS, Ops …): tasks due today. */
async function tasksDueToday() {
  const rows = await query(
    `SELECT id, title, owner_id, project_id FROM tasks
      WHERE status NOT IN ('Completed','Cancelled') AND DATE(due_date) = CURDATE() LIMIT 500`
  );
  for (const t of rows) {
    await notify(t.owner_id, 'Task due today', t.title, t.project_id ? `/projects/${t.project_id}` : '/tasks', 'task', `task-today-${t.id}`);
  }
}

let lastDaily = null;
async function runOnce() {
  try {
    await overdueFollowUps();
    await inactiveLeads();
    await escalateTasks();
    await collectionFollowUps();
    await executionAlerts();
    await clientServicingAlerts();
    await tasksDueToday();
    const today = new Date().toISOString().slice(0, 10);
    if (lastDaily !== today) {
      await recalcBuckets();
      lastDaily = today;
    }
  } catch (e) {
    console.error('automation error:', e.message);
  }
}

function startAutomation() {
  setTimeout(runOnce, 15 * 1000);
  setInterval(runOnce, 30 * 60 * 1000);
}

module.exports = { startAutomation, runOnce };
