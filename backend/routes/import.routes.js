const router = require('express').Router();
const multer = require('multer');
const ctrl = require('../controllers/import.controller');
const { authorize } = require('../middleware/auth');

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (/\.csv$/i.test(file.originalname)) return cb(null, true);
    const err = new Error('Please upload a .csv file (save Excel as CSV UTF-8)');
    err.status = 400;
    cb(err);
  },
});

router.get('/types', authorize('import', 'view'), ctrl.types);
router.get('/template/:type', authorize('import', 'view'), ctrl.template);
router.post('/:type', authorize('import', 'create'), csvUpload.single('file'), ctrl.run);

module.exports = router;
