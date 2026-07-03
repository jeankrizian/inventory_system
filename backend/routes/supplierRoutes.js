const express = require('express');
const { body } = require('express-validator');
const SupplierController = require('../controllers/SupplierController');
const { requireAuth, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', SupplierController.getAll);
router.get('/:id', SupplierController.getById);
router.post('/', [body('name').notEmpty(), validate], SupplierController.create);
router.put('/:id', SupplierController.update);
router.delete('/:id', SupplierController.remove);

module.exports = router;
