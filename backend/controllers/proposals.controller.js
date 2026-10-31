const { query, queryOne, transaction } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError, pick, num, round2, insertSql, updateSql, codeFor } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');
const { getNumber } = require('../utils/settings');
const { createApproval } = require('../utils/approvals');

const HEADER_FIELDS = [
  'title', 'opportunity_id', 'company_id', 'contact_id', 'event_type_id', 'event_date', 'venue', 'pax',
  'discount_pct', 'agency_fee_pct', 'tax_pct', 'payment_terms', 'assumptions', 'exclusions',
  'client_feedback', 'negotiation_notes', 'next_follow_up', 'owner_id',
];

const EDITABLE = ['Draft', 'Rejected', 'Pending Approval', 'Approved'];

/** Calculate line amounts, totals and margin. */
function calculate(header, items) {
  const lines = (items || [])
    .filter((i) => i && i.description)
    .map((i, idx) => {
      const qty = num(i.quantity || 1);
      return {
        section: i.section || null,
        description: i.description,
        quantity: qty,
        unit: i.unit || null,
        unit_rate: num(i.unit_rate),
        amount: round2(qty * num(i.unit_rate)),
        unit_cost: num(i.unit_cost),
        cost_amount: round2(qty * num(i.unit_cost)),
        sort_order: idx + 1,
      };
    });
  const subtotal = round2(lines.reduce((a, l) => a + l.amount, 0));
  const cost = round2(lines.reduce((a, l) => a + l.cost_amount, 0));
  const discountAmt = round2((subtotal * num(header.discount_pct)) / 100);
  const afterDiscount = subtotal - discountAmt;
  const agencyAmt = round2((afterDiscount * num(header.agency_fee_pct)) / 100);
  const taxable = round2(afterDiscount + agencyAmt);
  const taxAmt = round2((taxable * num(header.tax_pct)) / 100);
  const margin = round2(taxable - cost);
  return {
    lines,
    totals: {
      subtotal,
      discount_amount: discountAmt,
      agency_fee_amount: agencyAmt,
      taxable_amount: taxable,
      tax_amount: taxAmt,
      total_amount: round2(taxable + taxAmt),
      estimated_cost: cost,
      margin_amount: margin,
      margin_pct: taxable ? round2((margin / taxable) * 100) : 0,
    },
  };
}

/** Commercial exception rules -> approval required? */
async function approvalCheck(header, totals) {
  const reasons = [];
  const discountLimit = await getNumber('discount_threshold_pct', 10);
  const marginMin = await getNumber('margin_threshold_pct', 20);
  if (num(header.discount_pct) > discountLimit) reasons.push(`Discount ${header.discount_pct}% exceeds ${discountLimit}%`);
  if (totals.taxable_amount > 0 && totals.margin_pct < marginMin) reasons.push(`Margin ${totals.margin_pct}% below ${marginMin}%`);
  if (header.payment_terms && /credit|90 days|120 days|post event|after event/i.test(header.payment_terms)) {
    reasons.push('Non-standard payment terms');
  }
  return reasons;
}

async function saveItems(conn, proposalId, lines) {
  await conn.query('DELETE FROM proposal_items WHERE proposal_id = ?', [proposalId]);
  for (const l of lines) {
    const ins = insertSql('proposal_items', { ...l, proposal_id: proposalId });
    await conn.query(ins.sql, ins.params);
  }
}

const base = crudController({
  table: 'proposals',
  module: 'proposals',
  select: `t.*, co.name AS company_name, op.opp_code, op.title AS opportunity_title, o.full_name AS owner_name,
           ab.full_name AS approved_by_name, ct.name AS contact_name, et.name AS event_type_name`,
  joins: `LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN opportunities op ON op.id = t.opportunity_id
          LEFT JOIN employees o ON o.id = t.owner_id LEFT JOIN employees ab ON ab.id = t.approved_by
          LEFT JOIN contacts ct ON ct.id = t.contact_id LEFT JOIN lead_event_types et ON et.id = t.event_type_id`,
  searchFields: ['t.proposal_code', 't.title', 'co.name', 'op.opp_code'],
  filters: { status: 't.status', owner_id: 't.owner_id', company_id: 't.company_id', opportunity_id: 't.opportunity_id', is_latest: 't.is_latest' },
  dateField: 't.created_at',
  ownerColumns: ['t.owner_id', 't.created_by'],
});

exports.list = base.list;
exports.remove = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  if (!['Draft', 'Rejected'].includes(p.status)) throw new ApiError(409, 'Only Draft or Rejected proposals can be deleted');
  await query('DELETE FROM proposals WHERE id = ?', [p.id]);
  if (p.version > 1) {
    await query('UPDATE proposals SET is_latest = 1 WHERE root_id = ? AND version = ?', [p.root_id, p.version - 1]);
  }
  await logAudit(req, 'delete', 'proposals', p.id, p);
  res.json({ message: 'Deleted' });
});

async function fetchProposal(id, req) {
  const p = await base.findById(id, req);
  if (!p) throw new ApiError(404, 'Proposal not found');
  p.items = await query('SELECT * FROM proposal_items WHERE proposal_id = ? ORDER BY sort_order', [p.id]);
  p.versions = await query(
    `SELECT id, version, status, total_amount, margin_pct, sent_date, created_at, is_latest FROM proposals
      WHERE root_id = ? ORDER BY version DESC`,
    [p.root_id || p.id]
  );
  p.approvals = await query(
    `SELECT a.*, r.full_name AS requested_by_name, d.full_name AS decided_by_name FROM approvals a
       LEFT JOIN employees r ON r.id = a.requested_by LEFT JOIN employees d ON d.id = a.decided_by
      WHERE a.entity_type = 'proposal' AND a.entity_id = ? ORDER BY a.id DESC`,
    [p.id]
  );
  return p;
}

exports.get = asyncHandler(async (req, res) => {
  res.json(await fetchProposal(req.params.id, req));
});

exports.create = asyncHandler(async (req, res) => {
  const header = pick(req.body, HEADER_FIELDS);
  if (!header.title) throw new ApiError(400, 'Title is required');
  if (header.opportunity_id) {
    const opp = await queryOne('SELECT company_id, contact_id, event_type_id, event_date FROM opportunities WHERE id = ?', [header.opportunity_id]);
    if (opp) {
      header.company_id = header.company_id || opp.company_id;
      header.contact_id = header.contact_id || opp.contact_id;
      header.event_type_id = header.event_type_id || opp.event_type_id;
      header.event_date = header.event_date || opp.event_date;
    }
  }
  if (header.tax_pct === undefined || header.tax_pct === null) header.tax_pct = await getNumber('default_tax_pct', 18);
  const { lines, totals } = calculate(header, req.body.items);
  const data = { ...header, ...totals, owner_id: header.owner_id || req.user.id, created_by: req.user.id, status: 'Draft', version: 1, is_latest: 1 };
  const id = await transaction(async (conn) => {
    const ins = insertSql('proposals', data);
    const [r] = await conn.query(ins.sql, ins.params);
    await conn.query('UPDATE proposals SET proposal_code = ?, root_id = ? WHERE id = ?', [codeFor('PRP', r.insertId), r.insertId, r.insertId]);
    await saveItems(conn, r.insertId, lines);
    return r.insertId;
  });
  await logAudit(req, 'create', 'proposals', id, { title: data.title, total: totals.total_amount });
  res.status(201).json(await fetchProposal(id, req));
});

exports.update = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  const header = pick(req.body, HEADER_FIELDS);
  const commercialChange = req.body.items !== undefined || ['discount_pct', 'agency_fee_pct', 'tax_pct', 'payment_terms'].some((k) => header[k] !== undefined);
  if (commercialChange && !EDITABLE.includes(p.status)) {
    throw new ApiError(409, `Proposal is ${p.status}. Create a revision to change commercials.`);
  }
  const merged = { ...p, ...header };
  let data = { ...header };
  await transaction(async (conn) => {
    if (req.body.items !== undefined) {
      const { lines, totals } = calculate(merged, req.body.items);
      data = { ...data, ...totals };
      await saveItems(conn, p.id, lines);
    } else if (commercialChange) {
      const [items] = await conn.query('SELECT * FROM proposal_items WHERE proposal_id = ?', [p.id]);
      data = { ...data, ...calculate(merged, items).totals };
    }
    if (commercialChange && p.status === 'Approved') data.status = 'Draft';
    if (Object.keys(data).length) {
      const up = updateSql('proposals', data, p.id);
      await conn.query(up.sql, up.params);
    }
  });
  await logAudit(req, 'update', 'proposals', p.id, data);
  res.json(await fetchProposal(p.id, req));
});

/** Submit for approval. Auto-approves when no commercial exception. */
exports.submit = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  if (!['Draft', 'Rejected'].includes(p.status)) throw new ApiError(409, `Proposal is already ${p.status}`);
  const reasons = await approvalCheck(p, p);
  if (reasons.length) {
    await query("UPDATE proposals SET status = 'Pending Approval', approval_required = 1, approval_reason = ? WHERE id = ?", [reasons.join('; '), p.id]);
    await createApproval({
      entityType: 'proposal', entityId: p.id, requestType: 'Proposal commercial exception',
      title: `${p.proposal_code} v${p.version} – ${p.title}`, amount: p.total_amount, reason: reasons.join('; '),
      req, link: `/proposals/${p.id}`,
    });
  } else {
    await query("UPDATE proposals SET status = 'Approved', approval_required = 0, approval_reason = NULL, approved_by = ?, approved_at = NOW() WHERE id = ?", [req.user.id, p.id]);
  }
  await logAudit(req, 'submit', 'proposals', p.id, { reasons });
  res.json(await fetchProposal(p.id, req));
});

/** Mark as sent to client (logs an activity and advances the funnel stage). */
exports.send = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  if (p.status !== 'Approved' && p.status !== 'Sent') throw new ApiError(409, 'Proposal must be approved before sending');
  const sentDate = req.body.sent_date || new Date().toISOString().slice(0, 10);
  await query("UPDATE proposals SET status = 'Sent', sent_date = ?, next_follow_up = COALESCE(?, next_follow_up) WHERE id = ?", [sentDate, req.body.next_follow_up || null, p.id]);
  if (p.opportunity_id) {
    await query(
      `INSERT INTO activities (related_type, related_id, activity_type, subject, outcome, activity_date, next_follow_up, owner_id)
       VALUES ('opportunity', ?, 'Proposal Sent', ?, ?, NOW(), ?, ?)`,
      [p.opportunity_id, `${p.proposal_code} v${p.version} sent`, `Total ₹${p.total_amount}`, req.body.next_follow_up || null, req.user.id]
    );
    const opp = await queryOne('SELECT o.*, f.sort_order FROM opportunities o LEFT JOIN funnel_statuses f ON f.id = o.funnel_status_id WHERE o.id = ?', [p.opportunity_id]);
    const propStage = await queryOne("SELECT * FROM funnel_statuses WHERE name LIKE 'Proposal%' LIMIT 1");
    if (opp && propStage && (opp.sort_order || 0) < propStage.sort_order) {
      await query('UPDATE opportunities SET funnel_status_id = ?, probability = IF(probability_override = 1, probability, ?), stage_changed_at = NOW(), last_activity_at = NOW() WHERE id = ?', [propStage.id, propStage.probability, opp.id]);
      await query(
        'INSERT INTO opportunity_stage_history (opportunity_id, from_status_id, to_status_id, probability, remarks, changed_by) VALUES (?,?,?,?,?,?)',
        [opp.id, opp.funnel_status_id, propStage.id, propStage.probability, 'Proposal sent', req.user.id]
      );
    } else if (opp) {
      await query('UPDATE opportunities SET last_activity_at = NOW() WHERE id = ?', [opp.id]);
    }
  }
  await logAudit(req, 'send', 'proposals', p.id, { sent_date: sentDate });
  res.json(await fetchProposal(p.id, req));
});

/** Client response: Accepted / Lost, feedback and negotiation notes. */
exports.clientResponse = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  const { status, client_feedback, negotiation_notes, next_follow_up } = req.body;
  if (status && !['Accepted', 'Lost', 'Sent'].includes(status)) throw new ApiError(400, 'Invalid status');
  await query(
    `UPDATE proposals SET status = COALESCE(?, status), client_feedback = COALESCE(?, client_feedback),
       negotiation_notes = COALESCE(?, negotiation_notes), next_follow_up = COALESCE(?, next_follow_up) WHERE id = ?`,
    [status || null, client_feedback || null, negotiation_notes || null, next_follow_up || null, p.id]
  );
  await logAudit(req, 'client_response', 'proposals', p.id, req.body);
  res.json(await fetchProposal(p.id, req));
});

/** Create a new version; previous submissions are preserved. */
exports.revise = asyncHandler(async (req, res) => {
  const p = await queryOne('SELECT * FROM proposals WHERE id = ?', [req.params.id]);
  if (!p) throw new ApiError(404, 'Proposal not found');
  if (!p.is_latest) throw new ApiError(409, 'Only the latest version can be revised');
  const newId = await transaction(async (conn) => {
    const copy = { ...p };
    ['id', 'created_at', 'updated_at', 'approved_by', 'approved_at', 'sent_date', 'approval_required', 'approval_reason'].forEach((k) => delete copy[k]);
    Object.assign(copy, { version: p.version + 1, is_latest: 1, status: 'Draft', root_id: p.root_id || p.id, created_by: req.user.id });
    const ins = insertSql('proposals', copy);
    const [r] = await conn.query(ins.sql, ins.params);
    await conn.query(
      `INSERT INTO proposal_items (proposal_id, section, description, quantity, unit, unit_rate, amount, unit_cost, cost_amount, sort_order)
       SELECT ?, section, description, quantity, unit, unit_rate, amount, unit_cost, cost_amount, sort_order FROM proposal_items WHERE proposal_id = ?`,
      [r.insertId, p.id]
    );
    await conn.query("UPDATE proposals SET is_latest = 0, status = IF(status IN ('Sent','Approved','Pending Approval','Draft','Rejected'), 'Revised', status) WHERE id = ?", [p.id]);
    await conn.query(
      `INSERT INTO attachments (entity_type, entity_id, doc_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by)
       SELECT 'proposal', ?, doc_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by FROM attachments
        WHERE entity_type = 'proposal' AND entity_id = ?`,
      [r.insertId, p.id]
    );
    return r.insertId;
  });
  await logAudit(req, 'revise', 'proposals', newId, { from: p.id, version: p.version + 1 });
  res.json(await fetchProposal(newId, req));
});
