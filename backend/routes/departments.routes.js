const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/departments.controller');

module.exports = crudRouter(ctrl, 'departments');
