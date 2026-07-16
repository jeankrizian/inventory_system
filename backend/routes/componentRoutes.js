const express = require('express');
const ComponentController = require('../controllers/ComponentController');
const { requireAuth, requireManageInventory } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// Admin + Property Manager only for all Components endpoints
router.get('/', requireManageInventory, ComponentController.getAll);
router.get('/parent/:parentId', requireManageInventory, ComponentController.getByParent);
router.post('/', requireManageInventory, ComponentController.create);
router.post('/:id/replace', requireManageInventory, ComponentController.replace);

module.exports = router;
