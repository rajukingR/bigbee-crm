const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/communicationLogs.controller');

module.exports = crudRouter(ctrl, 'projects');
