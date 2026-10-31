const router = require('express').Router();
const ctrl = require('../controllers/dashboard.controller');
const { authorize } = require('../middleware/auth');

router.get('/', authorize('dashboard', 'view'), ctrl.main);
router.get('/manager', authorize('manager_dashboard', 'view'), ctrl.manager);

module.exports = router;
