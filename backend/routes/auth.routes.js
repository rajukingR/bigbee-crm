const router = require('express').Router();
const ctrl = require('../controllers/auth.controller');
const { authenticate } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

router.post('/login', ctrl.login);
router.get('/me', authenticate, ctrl.me);
router.put('/change-password', authenticate, ctrl.changePassword);
router.put('/profile', authenticate, upload.single('photo'), ctrl.updateProfile);

module.exports = router;
