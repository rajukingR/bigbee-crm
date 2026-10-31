const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/escalations.controller');

module.exports = crudRouter(ctrl, 'escalations');
