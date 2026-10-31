const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/leads.controller');

module.exports = crudRouter(ctrl, 'leads', (router) => {
  router.post('/bulk-assign', authorize('leads', 'edit'), ctrl.bulkAssign);
  router.get('/:id/detail', authorize('leads', 'view'), ctrl.detail);
  router.post('/:id/assign', authorize('leads', 'edit'), ctrl.assign);
  router.post('/:id/qualify', authorize('leads', 'edit'), ctrl.qualify);
  router.post('/:id/convert', authorize(['leads', 'opportunities'], 'create'), ctrl.convert);
});
