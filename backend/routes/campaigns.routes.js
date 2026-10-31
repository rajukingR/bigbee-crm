const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/campaigns.controller');

module.exports = crudRouter(ctrl, 'campaigns', (router) => {
  router.get('/roi', authorize(['campaigns', 'reports'], 'view'), ctrl.roiByChannel);
});
