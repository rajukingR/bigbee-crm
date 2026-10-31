const router = require('express').Router();
const ctrl = require('../controllers/reports.controller');
const { authorize } = require('../middleware/auth');

// Any user may log their own exports (each list checks its own export permission in the UI)
router.post('/log-export', ctrl.logExport);
router.get('/:report', authorize('reports', 'view'), ctrl.run);

module.exports = router;
