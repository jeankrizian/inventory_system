const express = require('express');
const ComponentController = require('../controllers/ComponentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', ComponentController.getAll);
router.get('/parent/:parentId', ComponentController.getByParent);
router.post('/', ComponentController.create);

module.exports = router;
