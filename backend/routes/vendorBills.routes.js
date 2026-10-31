const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/vendorBills.controller');

module.exports = crudRouter(ctrl, 'vendor_bills', (router) => {
  router.get('/:id/payments', authorize('vendor_bills', 'view'), ctrl.payments);
  router.post('/:id/payments', authorize('vendor_bills', 'edit'), ctrl.addPayment);
  router.delete('/payments/:paymentId', authorize('vendor_bills', 'delete'), ctrl.removePayment);
});
