const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/activities.controller');

module.exports = crudRouter(ctrl, 'activities', (router) => {
  router.get('/follow-ups', authorize(['activities', 'leads', 'tasks'], 'view'), ctrl.followUps);
});
