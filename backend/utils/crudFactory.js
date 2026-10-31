/**
 * Generic list / get / create / update / delete handlers for a table.
 * Handles search, filters, pagination, data scope, unique codes and audit.
 */
const express = require('express');
const { query, queryOne } = require('../config/db');
const { asyncHandler, ApiError, pick, paginate, insertSql, updateSql, codeFor } = require('./helpers');
const { scopeClause } = require('./scope');
const { logAudit, diff } = require('./audit');
const { authorize } = require('../middleware/auth');

function crudController(cfg) {
  const {
    table,
    module,
    select = 't.*',
    joins = '',
    fields = [],
    required = [],
    searchFields = [],
    filters = {},
    dateField = null,
    ownerColumns = [],
    codeField = null,
    codePrefix = null,
    defaultSort = 't.id DESC',
    sortable = [],
    beforeSave = null,
    afterCreate = null,
    afterUpdate = null,
    beforeDelete = null,
    transformRow = null,
    extraWhere = null,
  } = cfg;

  const baseSql = `FROM ${table} t ${joins}`;

  async function buildWhere(req) {
    let where = ' WHERE 1=1';
    const params = [];
    const q = req.query;
    if (q.search && searchFields.length) {
      where += ` AND (${searchFields.map((f) => `${f} LIKE ?`).join(' OR ')})`;
      searchFields.forEach(() => params.push(`%${q.search}%`));
    }
    Object.entries(filters).forEach(([param, column]) => {
      if (q[param] !== undefined && q[param] !== '') {
        const values = String(q[param]).split(',');
        if (values.length > 1) {
          where += ` AND ${column} IN (${values.map(() => '?').join(',')})`;
          params.push(...values);
        } else {
          where += ` AND ${column} = ?`;
          params.push(q[param]);
        }
      }
    });
    if (dateField && q.from) {
      where += ` AND ${dateField} >= ?`;
      params.push(q.from);
    }
    if (dateField && q.to) {
      where += ` AND ${dateField} <= ?`;
      params.push(`${q.to} 23:59:59`);
    }
    if (extraWhere) {
      const extra = await extraWhere(req);
      if (extra && extra.sql) {
        where += extra.sql;
        params.push(...(extra.params || []));
      }
    }
    if (ownerColumns.length) {
      const s = await scopeClause(req.user, ownerColumns);
      where += s.sql;
      params.push(...s.params);
    }
    return { where, params };
  }

  const list = asyncHandler(async (req, res) => {
    const { page, limit, offset } = paginate(req.query);
    const { where, params } = await buildWhere(req);
    let order = defaultSort;
    if (req.query.sort && sortable.includes(req.query.sort)) {
      order = `${req.query.sort} ${req.query.order === 'asc' ? 'ASC' : 'DESC'}`;
    }
    const totalRow = await queryOne(`SELECT COUNT(*) AS total ${baseSql} ${where}`, params);
    let rows = await query(`SELECT ${select} ${baseSql} ${where} ORDER BY ${order} LIMIT ? OFFSET ?`, [
      ...params,
      limit,
      offset,
    ]);
    if (transformRow) rows = rows.map((r) => transformRow(r, req));
    res.json({ data: rows, total: totalRow.total, page, limit });
  });

  async function findById(id, req) {
    let row = await queryOne(`SELECT ${select} ${baseSql} WHERE t.id = ?`, [id]);
    if (row && transformRow) row = transformRow(row, req);
    return row;
  }

  const get = asyncHandler(async (req, res) => {
    const row = await findById(req.params.id, req);
    if (!row) throw new ApiError(404, 'Record not found');
    res.json(row);
  });

  const create = asyncHandler(async (req, res) => {
    let data = pick(req.body, fields);
    for (const f of required) {
      if (data[f] === undefined || data[f] === null || data[f] === '') throw new ApiError(400, `${f.replace(/_/g, ' ')} is required`);
    }
    if (fields.includes('created_by') || cfg.trackCreator) data.created_by = req.user.id;
    if (beforeSave) data = (await beforeSave(data, req, null)) || data;
    const ins = insertSql(table, data);
    const result = await query(ins.sql, ins.params);
    const id = result.insertId;
    if (codeField && codePrefix && !data[codeField]) {
      await query(`UPDATE ${table} SET ${codeField} = ? WHERE id = ?`, [codeFor(codePrefix, id), id]);
    }
    const row = await findById(id, req);
    await logAudit(req, 'create', module, id, data);
    if (afterCreate) await afterCreate(row, req);
    res.status(201).json(row);
  });

  const update = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!existing) throw new ApiError(404, 'Record not found');
    let data = pick(req.body, fields.filter((f) => f !== 'created_by'));
    if (beforeSave) data = (await beforeSave(data, req, existing)) || data;
    if (Object.keys(data).length) {
      const up = updateSql(table, data, id);
      await query(up.sql, up.params);
    }
    const row = await findById(id, req);
    await logAudit(req, 'update', module, Number(id), diff(existing, data));
    if (afterUpdate) await afterUpdate(row, existing, req);
    res.json(row);
  });

  const remove = asyncHandler(async (req, res) => {
    const id = req.params.id;
    const existing = await queryOne(`SELECT * FROM ${table} WHERE id = ?`, [id]);
    if (!existing) throw new ApiError(404, 'Record not found');
    if (beforeDelete) await beforeDelete(existing, req);
    await query(`DELETE FROM ${table} WHERE id = ?`, [id]);
    await logAudit(req, 'delete', module, Number(id), existing);
    res.json({ message: 'Deleted successfully' });
  });

  return { list, get, create, update, remove, findById };
}

/** Standard REST routes for a controller, guarded by the module permission. */
function crudRouter(ctrl, module, extend) {
  const router = express.Router();
  if (extend) extend(router);
  router.get('/', authorize(module, 'view'), ctrl.list);
  router.get('/:id', authorize(module, 'view'), ctrl.get);
  router.post('/', authorize(module, 'create'), ctrl.create);
  router.put('/:id', authorize(module, 'edit'), ctrl.update);
  router.delete('/:id', authorize(module, 'delete'), ctrl.remove);
  return router;
}

module.exports = { crudController, crudRouter };
