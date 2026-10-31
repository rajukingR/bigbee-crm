const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/companies.controller');

module.exports = crudRouter(ctrl, 'companies', (router) => {
  router.get('/check-duplicate', authorize('companies', 'view'), ctrl.checkDuplicate);
  router.post('/recalculate-buckets', authorize('companies', 'edit'), ctrl.recalculateBuckets);
  router.get('/:id/overview', authorize('companies', 'view'), ctrl.overview);
});
