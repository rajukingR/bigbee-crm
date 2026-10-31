const router = require('express').Router();
const ctrl = require('../controllers/settings.controller');
const { authorize } = require('../middleware/auth');

router.get('/', ctrl.list);
router.put('/', authorize('settings', 'edit'), ctrl.save);

module.exports = router;
