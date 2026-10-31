const router = require('express').Router();
const ctrl = require('../controllers/notifications.controller');

router.get('/', ctrl.list);
router.put('/read-all', ctrl.markAllRead);
router.put('/:id/read', ctrl.markRead);

module.exports = router;
