const router = require('express').Router();
const ctrl = require('../controllers/permissions.controller');
const { authorize } = require('../middleware/auth');

router.get('/modules', ctrl.modules);
router.get('/role/:roleId', authorize('permissions', 'view'), ctrl.getRolePermissions);
router.put('/role/:roleId', authorize('permissions', 'edit'), ctrl.saveRolePermissions);

module.exports = router;
