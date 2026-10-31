const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/executionItems.controller');

module.exports = crudRouter(ctrl, 'execution', (router) => {
  router.get('/summary', authorize('execution', 'view'), ctrl.summary);
});
