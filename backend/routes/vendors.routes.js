const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/vendors.controller');

module.exports = crudRouter(ctrl, 'vendors', (router) => {
  router.get('/:id/history', authorize('vendors', 'view'), ctrl.history);
});
