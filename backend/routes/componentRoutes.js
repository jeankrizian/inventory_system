const express = require('express');
const ComponentController = require('../controllers/ComponentController');
const { requireAuth, requireViewInventory, requireManageInventory } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireViewInventory, ComponentController.getAll);
router.get('/parent/:parentId', requireViewInventory, ComponentController.getByParent);
router.post('/', requireManageInventory, ComponentController.create);

module.exports = router;
