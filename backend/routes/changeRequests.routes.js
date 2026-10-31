const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/changeRequests.controller');

module.exports = crudRouter(ctrl, 'escalations', (router) => {
  router.post('/:id/resubmit', authorize('escalations', 'edit'), ctrl.resubmit);
});
