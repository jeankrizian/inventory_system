const express = require('express');
const { body } = require('express-validator');
const InventoryController = require('../controllers/InventoryController');
const { requireAuth, validate } = require('../middleware/auth');

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

router.get('/', InventoryController.getAll);
router.get('/:id', InventoryController.getById);
router.post('/', itemValidation, InventoryController.create);
router.put('/:id', InventoryController.update);
router.delete('/:id', InventoryController.remove);

module.exports = router;
