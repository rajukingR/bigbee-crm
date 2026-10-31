const router = require('express').Router();
const ctrl = require('../controllers/audit.controller');
const { authorize } = require('../middleware/auth');

// Read-only: audit logs can never be edited through the API
router.get('/', authorize('audit_logs', 'view'), ctrl.list);
router.get('/modules', authorize('audit_logs', 'view'), ctrl.modules);

module.exports = router;
