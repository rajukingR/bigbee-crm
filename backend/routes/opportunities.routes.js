const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const { upload } = require('../middleware/upload');
const ctrl = require('../controllers/opportunities.controller');

module.exports = crudRouter(ctrl, 'opportunities', (router) => {
  router.get('/pipeline', authorize('opportunities', 'view'), ctrl.pipeline);
  router.get('/:id/detail', authorize('opportunities', 'view'), ctrl.detail);
  router.post('/:id/stage', authorize('opportunities', 'edit'), ctrl.changeStage);
  router.post('/:id/won', authorize('opportunities', 'edit'), upload.single('evidence'), ctrl.markWon);
});
