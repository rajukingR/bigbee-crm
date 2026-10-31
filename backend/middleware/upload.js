const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const multer = require('multer');

const UPLOAD_ROOT = path.resolve(__dirname, '..', process.env.UPLOAD_DIR || 'uploads');

// Images and PDF files only
const ALLOWED = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/svg+xml': '.svg',
  'application/pdf': '.pdf',
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const sub = new Date().toISOString().slice(0, 7); // yyyy-mm
    const dir = path.join(UPLOAD_ROOT, sub);
    fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || ALLOWED[file.mimetype] || '';
    cb(null, `${Date.now()}-${crypto.randomBytes(6).toString('hex')}${ext}`);
  },
});

const fileFilter = (req, file, cb) => {
  if (ALLOWED[file.mimetype]) return cb(null, true);
  const err = new Error('Only images (JPG, PNG, WEBP, GIF, SVG) and PDF files are allowed');
  err.status = 400;
  cb(err);
};

const upload = multer({ storage, fileFilter, limits: { fileSize: 10 * 1024 * 1024 } });

/** Path stored in DB / served at /uploads/... */
function publicPath(file) {
  return path.relative(UPLOAD_ROOT, file.path).split(path.sep).join('/');
}

function removeFile(relPath) {
  if (!relPath) return;
  const full = path.join(UPLOAD_ROOT, relPath);
  if (full.startsWith(UPLOAD_ROOT)) fs.promises.unlink(full).catch(() => {});
}

module.exports = { upload, publicPath, removeFile, UPLOAD_ROOT };
