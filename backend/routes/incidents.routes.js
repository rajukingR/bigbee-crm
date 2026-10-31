const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/incidents.controller');

module.exports = crudRouter(ctrl, 'execution');
