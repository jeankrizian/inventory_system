const express = require('express');
const { body } = require('express-validator');
const CategoryController = require('../controllers/CategoryController');
const { requireAuth, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.post('/', [body('name').notEmpty(), validate], CategoryController.create);
router.put('/:id', [body('name').notEmpty(), validate], CategoryController.update);
router.delete('/:id', CategoryController.remove);

module.exports = router;
