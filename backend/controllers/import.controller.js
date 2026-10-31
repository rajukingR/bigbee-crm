/**
 * Bulk import from CSV templates with field mapping, validation,
 * duplicate checks and an error report.
 */
const { query, queryOne } = require('../config/db');
const { asyncHandler, ApiError, codeFor } = require('../utils/helpers');
const { logAudit } = require('../utils/audit');

/** Minimal RFC-4180 CSV parser (quotes, escaped quotes, commas & newlines in quotes). */
function parseCsv(text) {
  const rows = [];
  let row = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"' && text[i + 1] === '"') { cur += '"'; i++; }
      else if (ch === '"') inQ = false;
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = '';
      if (row.some((c) => c.trim() !== '')) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c.trim() !== '')) rows.push(row);
  return rows;
}

const lookup = async (table, name) => {
  if (!name) return null;
  const r = await queryOne(`SELECT id FROM ${table} WHERE LOWER(name) = LOWER(?)`, [String(name).trim()]);
  return r ? r.id : undefined;
};
const employeeByEmail = async (email) => {
  if (!email) return null;
  const r = await queryOne('SELECT id FROM employees WHERE email = ?', [email.trim()]);
  return r ? r.id : undefined;
};

const TEMPLATES = {
  companies: {
    columns: ['name*', 'industry', 'company_size', 'website', 'phone', 'email', 'address', 'city', 'state', 'gst_no', 'client_type', 'owner_email', 'notes'],
    async row(r, req) {
      const industry_id = await lookup('industries', r.industry);
      if (industry_id === undefined) throw new Error(`Unknown industry "${r.industry}"`);
      const owner_id = await employeeByEmail(r.owner_email);
      if (owner_id === undefined) throw new Error(`Unknown owner email "${r.owner_email}"`);
      const dup = await queryOne('SELECT id FROM companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [r.name]);
      if (dup) throw new Error('Duplicate company name');
      const res = await query(
        `INSERT INTO companies (name, industry_id, company_size, website, phone, email, address, city, state, gst_no, client_type, owner_id, notes, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [r.name, industry_id, r.company_size || null, r.website || null, r.phone || null, r.email || null, r.address || null, r.city || null, r.state || null, r.gst_no || null,
          ['Prospect', 'Existing Client', 'Existing Data'].includes(r.client_type) ? r.client_type : 'Prospect', owner_id || req.user.id, r.notes || null, req.user.id]
      );
      await query('UPDATE companies SET company_code = ? WHERE id = ?', [codeFor('CMP', res.insertId), res.insertId]);
    },
  },
  contacts: {
    columns: ['name*', 'company_name', 'designation', 'department', 'phone', 'email', 'location', 'decision_role'],
    async row(r, req) {
      let company_id = null;
      if (r.company_name) {
        const c = await queryOne('SELECT id FROM companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [r.company_name]);
        if (!c) throw new Error(`Company "${r.company_name}" not found – import companies first`);
        company_id = c.id;
      }
      if (r.phone || r.email) {
        const dup = await queryOne(`SELECT id FROM contacts WHERE (phone = ? AND ? <> '') OR (email = ? AND ? <> '')`, [r.phone || '', r.phone || '', r.email || '', r.email || '']);
        if (dup) throw new Error('Duplicate phone / email');
      }
      const roles = ['Decision Maker', 'Influencer', 'Gatekeeper', 'User', 'Other'];
      await query(
        'INSERT INTO contacts (company_id, name, designation, department, phone, email, location, decision_role, owner_id, created_by) VALUES (?,?,?,?,?,?,?,?,?,?)',
        [company_id, r.name, r.designation || null, r.department || null, r.phone || null, r.email || null, r.location || null, roles.includes(r.decision_role) ? r.decision_role : 'Other', req.user.id, req.user.id]
      );
    },
  },
  leads: {
    columns: ['company_name*', 'contact_name', 'phone', 'email', 'city', 'lead_type', 'lead_source', 'service', 'event_type', 'tentative_event_date', 'expected_budget', 'requirement', 'owner_email', 'priority', 'next_follow_up'],
    async row(r, req) {
      const ids = {
        lead_type_id: await lookup('lead_types', r.lead_type),
        lead_source_id: await lookup('lead_sources', r.lead_source),
        service_id: await lookup('services', r.service),
        event_type_id: await lookup('lead_event_types', r.event_type),
      };
      for (const [k, v] of Object.entries(ids)) if (v === undefined) throw new Error(`Unknown ${k.replace('_id', '').replace('_', ' ')}`);
      const owner_id = await employeeByEmail(r.owner_email);
      if (owner_id === undefined) throw new Error(`Unknown owner email "${r.owner_email}"`);
      let dup = null;
      if (r.phone || r.email) dup = await queryOne(`SELECT id FROM leads WHERE (phone = ? AND ? <> '') OR (email = ? AND ? <> '') LIMIT 1`, [r.phone || '', r.phone || '', r.email || '', r.email || '']);
      const company = await queryOne('SELECT id FROM companies WHERE LOWER(TRIM(name)) = LOWER(TRIM(?))', [r.company_name]);
      const status = await queryOne("SELECT id FROM lead_statuses WHERE name = 'New'");
      const res = await query(
        `INSERT INTO leads (company_id, company_name, contact_name, phone, email, city, lead_type_id, lead_source_id, service_id, event_type_id,
           tentative_event_date, expected_budget, requirement, owner_id, priority, next_follow_up, lead_status_id, duplicate_of, created_by)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [company ? company.id : null, r.company_name, r.contact_name || null, r.phone || null, r.email || null, r.city || null,
          ids.lead_type_id, ids.lead_source_id, ids.service_id, ids.event_type_id, r.tentative_event_date || null, Number(r.expected_budget) || 0,
          r.requirement || null, owner_id || req.user.id, ['Low', 'Medium', 'High', 'Urgent'].includes(r.priority) ? r.priority : 'Medium',
          r.next_follow_up || null, status ? status.id : null, dup ? dup.id : null, req.user.id]
      );
      await query('UPDATE leads SET lead_code = ? WHERE id = ?', [codeFor('LD', res.insertId), res.insertId]);
      await query('INSERT INTO lead_assignments (lead_id, to_owner_id, reason, assigned_by) VALUES (?,?,?,?)', [res.insertId, owner_id || req.user.id, 'Imported', req.user.id]);
    },
  },
  vendors: {
    columns: ['name*', 'category', 'services', 'contact_person', 'phone', 'email', 'city', 'gst_no', 'pan_no', 'payment_terms'],
    async row(r, req) {
      const category_id = await lookup('categories', r.category);
      if (category_id === undefined) throw new Error(`Unknown category "${r.category}"`);
      const dup = await queryOne(`SELECT id FROM vendors WHERE LOWER(name) = LOWER(?) OR (gst_no = ? AND ? <> '')`, [r.name, r.gst_no || '', r.gst_no || '']);
      if (dup) throw new Error('Duplicate vendor name / GST');
      const res = await query(
        'INSERT INTO vendors (name, category_id, services, contact_person, phone, email, city, gst_no, pan_no, payment_terms, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?)',
        [r.name, category_id, r.services || null, r.contact_person || null, r.phone || null, r.email || null, r.city || null, r.gst_no || null, r.pan_no || null, r.payment_terms || null, req.user.id]
      );
      await query('UPDATE vendors SET vendor_code = ? WHERE id = ?', [codeFor('VND', res.insertId), res.insertId]);
    },
  },
};

exports.template = asyncHandler(async (req, res) => {
  const t = TEMPLATES[req.params.type];
  if (!t) throw new ApiError(404, 'Unknown import type');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${req.params.type}_template.csv"`);
  res.send(t.columns.map((c) => c.replace('*', '')).join(',') + '\n');
});

exports.types = asyncHandler(async (req, res) => {
  res.json(Object.entries(TEMPLATES).map(([key, t]) => ({ key, columns: t.columns })));
});

exports.run = asyncHandler(async (req, res) => {
  const t = TEMPLATES[req.params.type];
  if (!t) throw new ApiError(404, 'Unknown import type');
  if (!req.file) throw new ApiError(400, 'Upload a CSV file');
  const rows = parseCsv(req.file.buffer.toString('utf8').replace(/^﻿/, ''));
  if (rows.length < 2) throw new ApiError(400, 'File has no data rows');
  // Field mapping: header -> template column (case / space insensitive)
  const norm = (s) => String(s).toLowerCase().trim().replace(/[\s-]+/g, '_').replace('*', '');
  const header = rows[0].map(norm);
  const known = t.columns.map(norm);
  const required = t.columns.filter((c) => c.endsWith('*')).map(norm);
  const missing = required.filter((r) => !header.includes(r));
  if (missing.length) throw new ApiError(400, `Missing required column(s): ${missing.join(', ')}`);
  const errors = [];
  let imported = 0;
  for (let i = 1; i < rows.length; i++) {
    const rec = {};
    header.forEach((h, idx) => { if (known.includes(h)) rec[h] = (rows[i][idx] || '').trim(); });
    try {
      for (const r of required) if (!rec[r]) throw new Error(`${r} is required`);
      await t.row(rec, req);
      imported++;
    } catch (e) {
      errors.push({ row: i + 1, error: e.message, data: rec });
    }
  }
  await logAudit(req, 'import', req.params.type, null, { imported, failed: errors.length });
  res.json({ total: rows.length - 1, imported, failed: errors.length, errors, ignored_columns: header.filter((h) => !known.includes(h)) });
});
