const { query, queryOne } = require('../config/db');
const { asyncHandler, ApiError } = require('../utils/helpers');
const { publicPath, removeFile } = require('../middleware/upload');
const { logAudit } = require('../utils/audit');

const ENTITY_TYPES = ['company', 'contact', 'lead', 'opportunity', 'proposal', 'project', 'task', 'vendor', 'quotation', 'purchase_order', 'vendor_bill', 'invoice', 'expense', 'campaign', 'execution', 'incident', 'feedback', 'employee', 'change_request', 'escalation'];

exports.list = asyncHandler(async (req, res) => {
  const { entity_type, entity_id } = req.query;
  if (!entity_type || !entity_id) throw new ApiError(400, 'entity_type and entity_id are required');
  res.json(await query(
    `SELECT a.*, e.full_name AS uploaded_by_name FROM attachments a LEFT JOIN employees e ON e.id = a.uploaded_by
      WHERE a.entity_type = ? AND a.entity_id = ? ORDER BY a.id DESC`,
    [entity_type, entity_id]
  ));
});

exports.upload = asyncHandler(async (req, res) => {
  const { entity_type, entity_id, doc_type } = req.body;
  if (!ENTITY_TYPES.includes(entity_type) || !entity_id) throw new ApiError(400, 'Invalid entity');
  const files = req.files || [];
  if (!files.length) throw new ApiError(400, 'Select at least one image or PDF file');
  for (const f of files) {
    await query(
      `INSERT INTO attachments (entity_type, entity_id, doc_type, original_name, file_name, file_path, mime_type, file_size, uploaded_by)
       VALUES (?,?,?,?,?,?,?,?,?)`,
      [entity_type, entity_id, doc_type || null, f.originalname, f.filename, publicPath(f), f.mimetype, f.size, req.user.id]
    );
  }
  await logAudit(req, 'upload', entity_type, Number(entity_id), { files: files.map((f) => f.originalname), doc_type });
  res.status(201).json({ message: `${files.length} file(s) uploaded` });
});

exports.remove = asyncHandler(async (req, res) => {
  const a = await queryOne('SELECT * FROM attachments WHERE id = ?', [req.params.id]);
  if (!a) throw new ApiError(404, 'File not found');
  if (a.uploaded_by !== req.user.id && !req.user.is_super_admin && req.user.data_scope !== 'all') {
    throw new ApiError(403, 'Only the uploader or an administrator can delete this file');
  }
  await query('DELETE FROM attachments WHERE id = ?', [a.id]);
  const stillUsed = await queryOne('SELECT COUNT(*) AS c FROM attachments WHERE file_path = ?', [a.file_path]);
  if (!stillUsed.c) removeFile(a.file_path);
  await logAudit(req, 'delete_file', a.entity_type, a.entity_id, { file: a.original_name });
  res.json({ message: 'File deleted' });
});
