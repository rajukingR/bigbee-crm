const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/projects.controller');

module.exports = crudRouter(ctrl, 'projects', (router) => {
  router.get('/:id/overview', authorize('projects', 'view'), ctrl.overview);
  router.get('/:id/financials', authorize('project_financials', 'view'), ctrl.financials);
  router.put('/:id/handover', authorize('projects', 'edit'), ctrl.saveHandover);
  router.post('/:id/handover/submit', authorize('projects', 'edit'), ctrl.submitHandover);
  router.post('/:id/handover/accept', authorize('projects', 'edit'), ctrl.acceptHandover);
  router.post('/:id/handover/clarify', authorize('projects', 'edit'), ctrl.clarifyHandover);
  router.post('/:id/apply-template', authorize('tasks', 'create'), ctrl.applyTemplate);
  router.post('/:id/close', authorize('projects', 'edit'), ctrl.close);
});
