const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/purchaseOrders.controller');

module.exports = crudRouter(ctrl, 'purchase_orders', (router) => {
  router.post('/:id/submit', authorize('purchase_orders', 'edit'), ctrl.submit);
  router.post('/:id/status', authorize('purchase_orders', 'edit'), ctrl.setStatus);
});
