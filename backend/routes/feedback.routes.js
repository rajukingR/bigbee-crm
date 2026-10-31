const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/feedback.controller');

module.exports = crudRouter(ctrl, 'feedback');
