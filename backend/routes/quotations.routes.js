const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/quotations.controller');

module.exports = crudRouter(ctrl, 'quotations', (router) => {
  router.get('/compare', authorize('quotations', 'view'), ctrl.compare);
  router.post('/:id/select', authorize('quotations', 'edit'), ctrl.select);
});
