const express = require('express');
const { body } = require('express-validator');
const SupplierController = require('../controllers/SupplierController');
const { requireAuth, requireSuppliersManage, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireSuppliersManage);

router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.post('/', requireSuppliersManage, [body('name').notEmpty().withMessage('Supplier name is required'), validate], SupplierController.create);
router.put('/:id', requireSuppliersManage, [body('name').notEmpty().withMessage('Supplier name is required'), validate], SupplierController.update);
router.delete('/:id', requireSuppliersManage, SupplierController.remove);

module.exports = router;
