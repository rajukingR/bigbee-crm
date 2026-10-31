const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/milestones.controller');

module.exports = crudRouter(ctrl, 'tasks');
