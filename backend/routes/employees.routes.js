const router = require('express').Router();
const ctrl = require('../controllers/employees.controller');
const { authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.get('/org-chart', ctrl.orgChart);
router.get('/', authorize('employees', 'view'), ctrl.list);
router.get('/:id', authorize('employees', 'view'), ctrl.get);
router.post('/', authorize('employees', 'create'), upload.single('photo'), ctrl.create);
router.put('/:id', authorize('employees', 'edit'), upload.single('photo'), ctrl.update);
router.post('/:id/reassign', authorize('employees', 'edit'), ctrl.reassign);
router.delete('/:id', authorize('employees', 'delete'), ctrl.remove);

module.exports = router;
