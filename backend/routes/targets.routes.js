const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/targets.controller');

module.exports = crudRouter(ctrl, 'targets', (router) => {
  router.get('/achievement', authorize(['targets', 'reports'], 'view'), ctrl.achievement);
});
