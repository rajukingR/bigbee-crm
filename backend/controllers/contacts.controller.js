const { query } = require('../config/db');
const { crudController } = require('../utils/crudFactory');
const { asyncHandler, ApiError } = require('../utils/helpers');

async function findDuplicates({ phone, email, excludeId = 0 }) {
  const out = [];
  if (phone) {
    out.push(...(await query(
      `SELECT c.id, c.name, c.phone, c.email, co.name AS company_name, 'phone' AS matched_on
         FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
        WHERE c.id <> ? AND (c.phone = ? OR c.alt_phone = ?)`,
      [excludeId, phone, phone]
    )));
  }
  if (email) {
    out.push(...(await query(
      `SELECT c.id, c.name, c.phone, c.email, co.name AS company_name, 'email' AS matched_on
         FROM contacts c LEFT JOIN companies co ON co.id = c.company_id
        WHERE c.id <> ? AND c.email = ?`,
      [excludeId, email]
    )));
  }
  return out;
}

const ctrl = crudController({
  table: 'contacts',
  module: 'contacts',
  select: 't.*, co.name AS company_name, co.company_code, o.full_name AS owner_name',
  joins: 'LEFT JOIN companies co ON co.id = t.company_id LEFT JOIN employees o ON o.id = t.owner_id',
  fields: ['company_id', 'name', 'designation', 'department', 'phone', 'alt_phone', 'email', 'location', 'decision_role', 'is_primary', 'owner_id', 'notes'],
  trackCreator: true,
  required: ['name'],
  searchFields: ['t.name', 't.phone', 't.email', 'co.name', 't.designation'],
  filters: { company_id: 't.company_id', decision_role: 't.decision_role', owner_id: 't.owner_id' },
  defaultSort: 't.id DESC',
  beforeSave: async (data, req, existing) => {
    if (!existing && !data.owner_id) data.owner_id = req.user.id;
    if (req.body.force) return data;
    const dups = await findDuplicates({ phone: data.phone, email: data.email, excludeId: existing ? existing.id : 0 });
    if (dups.length) {
      throw new ApiError(409, `Possible duplicate contact: ${dups.map((d) => `${d.name}${d.company_name ? ' @ ' + d.company_name : ''} (${d.matched_on})`).join(', ')}`);
    }
    return data;
  },
});

ctrl.checkDuplicate = asyncHandler(async (req, res) => {
  res.json(await findDuplicates({ ...req.query, excludeId: req.query.exclude_id || 0 }));
});

module.exports = ctrl;
