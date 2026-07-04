const express = require('express');
const { body } = require('express-validator');
const CategoryController = require('../controllers/CategoryController');
const { requireAuth, requireSystemManage, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', CategoryController.getAll);
router.get('/:id', CategoryController.getById);
router.post('/', requireSystemManage, [body('name').notEmpty(), validate], CategoryController.create);
router.put('/:id', requireSystemManage, [body('name').notEmpty(), validate], CategoryController.update);
router.delete('/:id', requireSystemManage, CategoryController.remove);

module.exports = router;
