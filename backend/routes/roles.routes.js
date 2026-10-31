const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/roles.controller');

module.exports = crudRouter(ctrl, 'roles');
