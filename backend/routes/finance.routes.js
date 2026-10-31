const router = require('express').Router();
const ctrl = require('../controllers/finance.controller');
const { authorize } = require('../middleware/auth');

router.get('/summary', authorize('profitability', 'view'), ctrl.summary);
router.get('/profitability', authorize('profitability', 'view'), ctrl.profitability);
router.get('/receivables', authorize(['profitability', 'invoices'], 'view'), ctrl.receivables);
router.get('/vendor-commitments', authorize(['profitability', 'purchase_orders'], 'view'), ctrl.vendorCommitments);

module.exports = router;
