const { crudRouter } = require('../utils/crudFactory');
const { authorize } = require('../middleware/auth');
const ctrl = require('../controllers/contacts.controller');

module.exports = crudRouter(ctrl, 'contacts', (router) => {
  router.get('/check-duplicate', authorize('contacts', 'view'), ctrl.checkDuplicate);
});
