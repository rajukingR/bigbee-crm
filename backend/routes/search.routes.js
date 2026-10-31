const router = require('express').Router();
const ctrl = require('../controllers/search.controller');

router.get('/', ctrl.search);

module.exports = router;
