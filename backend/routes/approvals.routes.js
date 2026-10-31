const router = require('express').Router();
const ctrl = require('../controllers/approvals.controller');
const { authorize } = require('../middleware/auth');

router.get('/', ctrl.list);
router.get('/counts', ctrl.counts);
router.post('/:id/decide', authorize('approvals', 'approve'), ctrl.decide);

module.exports = router;
