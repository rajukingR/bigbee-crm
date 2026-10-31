const { crudRouter } = require('../utils/crudFactory');
const ctrl = require('../controllers/expenses.controller');

module.exports = crudRouter(ctrl, 'expenses');
