const express = require('express');
const { body } = require('express-validator');
const InventoryController = require('../controllers/InventoryController');
const { requireAuth, requireViewInventory, requireManageInventory, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const itemValidation = [
  body('item_code').notEmpty().withMessage('Item code is required'),
  body('item_name').notEmpty().withMessage('Item name is required'),
  body().custom((_, { req }) => {
    if (!req.body.department_id && !req.body.category_id) {
      throw new Error('Department is required');
    }
    return true;
  }),
  body('quantity').isInt({ min: 0 }).withMessage('Quantity must be a positive number'),
  validate
];

router.get('/', requireViewInventory, InventoryController.getAll);
router.get('/:id', requireViewInventory, InventoryController.getById);
router.post('/', requireManageInventory, itemValidation, InventoryController.create);
router.put('/:id', requireManageInventory, InventoryController.update);
router.delete('/:id', requireManageInventory, InventoryController.remove);

module.exports = router;
