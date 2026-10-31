const router = require('express').Router();
const ctrl = require('../controllers/proposals.controller');
const { authorize } = require('../middleware/auth');

router.get('/', authorize('proposals', 'view'), ctrl.list);
router.get('/:id', authorize('proposals', 'view'), ctrl.get);
router.post('/', authorize('proposals', 'create'), ctrl.create);
router.put('/:id', authorize('proposals', 'edit'), ctrl.update);
router.post('/:id/submit', authorize('proposals', 'edit'), ctrl.submit);
router.post('/:id/send', authorize('proposals', 'edit'), ctrl.send);
router.post('/:id/response', authorize('proposals', 'edit'), ctrl.clientResponse);
router.post('/:id/revise', authorize('proposals', 'create'), ctrl.revise);
router.delete('/:id', authorize('proposals', 'delete'), ctrl.remove);

module.exports = router;
