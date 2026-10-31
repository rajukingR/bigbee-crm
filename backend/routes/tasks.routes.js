const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/tasks.controller');

module.exports = crudRouter(ctrl, 'tasks', (router) => {
  router.get('/:id/comments', authorize('tasks', 'view'), ctrl.comments);
  router.post('/:id/comments', authorize('tasks', 'view'), ctrl.addComment);
});
