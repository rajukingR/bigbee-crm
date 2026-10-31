const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/invoices.controller');

module.exports = crudRouter(ctrl, 'invoices', (router) => {
  router.get('/:id/receipts', authorize('invoices', 'view'), ctrl.receipts);
  router.post('/:id/receipts', authorize('invoices', 'edit'), ctrl.addReceipt);
  router.delete('/receipts/:receiptId', authorize('invoices', 'delete'), ctrl.removeReceipt);
});
