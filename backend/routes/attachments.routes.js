const router = require('express').Router();
const ctrl = require('../controllers/attachments.controller');
const { upload } = require('../middleware/upload');

router.get('/', ctrl.list);
router.post('/', upload.array('files', 10), ctrl.upload);
router.delete('/:id', ctrl.remove);

module.exports = router;
