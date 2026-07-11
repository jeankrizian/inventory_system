const express = require('express');
const { body } = require('express-validator');
const InventoryController = require('../controllers/InventoryController');
const { requireAuth, requireViewInventory, requireManageInventory, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const createItemValidation = [
  body('item_name').notEmpty().withMessage('Item name is required'),
  body().custom((_, { req }) => {
    if (!req.body.department_id && !req.body.category_id) {
      throw new Error('Department is required');
    }
    return true;
  }),
  body('asset_count').optional().isInt({ min: 1, max: 500 }).withMessage('Asset count must be between 1 and 500'),
  body('quantity').optional().isInt({ min: 1, max: 500 }).withMessage('Asset count must be between 1 and 500'),
  validate
];

router.get('/', requireViewInventory, InventoryController.getAll);
router.get('/next-code', requireManageInventory, InventoryController.getNextCode);
router.get('/:id/timeline', requireViewInventory, InventoryController.getTimeline);
router.get('/:id', requireViewInventory, InventoryController.getById);
router.post('/', requireManageInventory, createItemValidation, InventoryController.create);
router.put('/:id', requireManageInventory, InventoryController.update);
router.delete('/:id', requireManageInventory, InventoryController.remove);

module.exports = router;
