const router = require('express').Router();
const ctrl = require('../controllers/masters.controller');
const { authorize } = require('../middleware/auth');

// Dropdown data is readable by every logged-in user
router.get('/types', ctrl.types);
router.get('/lookups', ctrl.lookups);
router.get('/:type', ctrl.list);
router.post('/:type', authorize('masters', 'create'), ctrl.create);
router.put('/:type/:id', authorize('masters', 'edit'), ctrl.update);
router.delete('/:type/:id', authorize('masters', 'delete'), ctrl.remove);

module.exports = router;
