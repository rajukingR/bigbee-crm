/**
 * Won opportunity -> Project conversion without re-entering data.
 * Carries forward client, scope, value, budget, payment terms and attachments,
 * and opens a draft BD -> CS/Operations handover checklist.
 */
const { query, queryOne } = require('../config/db');
const { codeFor } = require('./helpers');
const { notify } = require('./notify');

const DEFAULT_CHECKLIST = [
  'Client brief shared',
  'Final proposal / quotation attached',
  'Costing assumptions documented',
  'Exclusions documented',
  'Promises made to client listed',
  'Client stakeholders & contacts shared',
  'Approved budget confirmed',
  'Timeline & key dates shared',
  'Known risks shared',
  'PO / confirmation evidence attached',
].map((item) => ({ item, done: false }));

async function createProjectFromOpportunity(oppId, req, overrides = {}) {
  const opp = await queryOne('SELECT * FROM opportunities WHERE id = ?', [oppId]);
  if (!opp) throw new Error('Opportunity not found');
  if (opp.project_id) return opp.project_id;

  const proposal = await queryOne(
    `SELECT * FROM proposals WHERE opportunity_id = ? AND is_latest = 1
      ORDER BY FIELD(status,'Accepted','Approved','Sent') DESC, id DESC LIMIT 1`,
    [oppId]
  );

  const confirmed = Number(overrides.confirmed_value) || (proposal ? Number(proposal.taxable_amount) : 0) || Number(opp.expected_value) || 0;
  const estCost = proposal ? Number(proposal.estimated_cost) : 0;

  const r = await query(
    `INSERT INTO projects (name, opportunity_id, proposal_id, company_id, contact_id, service_id, event_type_id, location, city,
       event_start, event_end, proposal_value, confirmed_value, estimated_cost, approved_budget, agency_fee, tax_pct,
       payment_terms, scope, bd_owner_id, cs_owner_id, ops_owner_id, manager_id, status, created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'Handover Pending',?)`,
    [
      overrides.name || opp.title,
      opp.id,
      proposal ? proposal.id : null,
      opp.company_id,
      opp.contact_id,
      opp.service_id,
      opp.event_type_id,
      proposal ? proposal.venue : null,
      opp.city,
      opp.event_date,
      overrides.event_end || opp.event_date,
      proposal ? proposal.total_amount : opp.expected_value,
      confirmed,
      estCost,
      Number(overrides.approved_budget) || estCost,
      proposal ? proposal.agency_fee_amount : 0,
      proposal ? proposal.tax_pct : 18,
      proposal ? proposal.payment_terms : null,
      proposal ? proposal.assumptions : opp.notes,
      opp.owner_id,
      overrides.cs_owner_id || null,
      overrides.ops_owner_id || null,
      overrides.manager_id || overrides.cs_owner_id || null,
      req.user.id,
    ]
  );
  const projectId = r.insertId;
  await query('UPDATE projects SET project_code = ? WHERE id = ?', [codeFor('PRJ', projectId), projectId]);
  await query('UPDATE opportunities SET project_id = ? WHERE id = ?', [projectId, opp.id]);

  // Draft handover pre-filled from the proposal
  await query(
    `INSERT INTO project_handovers (project_id, brief, proposal_reference, costing_assumptions, exclusions, budget_notes,
       checklist, handed_over_by, received_by, status)
     VALUES (?,?,?,?,?,?,?,?,?,'Draft')`,
    [
      projectId,
      opp.notes,
      proposal ? `${proposal.proposal_code} v${proposal.version}` : null,
      proposal ? proposal.assumptions : null,
      proposal ? proposal.exclusions : null,
      estCost ? `Estimated cost ₹${estCost}` : null,
      JSON.stringify(DEFAULT_CHECKLIST),
      opp.owner_id,
      overrides.cs_owner_id || null,
    ]
  );

  // Carry attachments forward (same files, linked to the project)
  await query(
    `INSERT INTO attachments (entity_type, entity_id, doc_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by)
     SELECT 'project', ?, COALESCE(doc_type, entity_type), original_name, file_name, file_path, mime_type, file_size, uploaded_by
       FROM attachments WHERE (entity_type = 'opportunity' AND entity_id = ?) OR (entity_type = 'proposal' AND entity_id = ?)`,
    [projectId, opp.id, proposal ? proposal.id : 0]
  );

  if (proposal && proposal.status !== 'Accepted') {
    await query("UPDATE proposals SET status = 'Accepted' WHERE id = ?", [proposal.id]);
  }

  await notify(
    [overrides.cs_owner_id, overrides.ops_owner_id, overrides.manager_id],
    'New project handover',
    `Project created from won opportunity ${opp.opp_code}. Please review and accept the handover.`,
    `/projects/${projectId}`,
    'project'
  );
  return projectId;
}

module.exports = { createProjectFromOpportunity, DEFAULT_CHECKLIST };
