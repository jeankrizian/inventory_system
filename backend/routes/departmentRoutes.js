const express = require('express');
const { body } = require('express-validator');
const DepartmentController = require('../controllers/DepartmentController');
const { requireAuth, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const departmentValidation = [
  body('name').notEmpty().withMessage('Department name is required'),
  body('code').notEmpty().withMessage('Department code is required'),
  body('status').optional().isIn(['Active', 'Inactive']),
  validate
];

router.get('/', DepartmentController.getAll);
router.get('/:id', DepartmentController.getById);
router.post('/', departmentValidation, DepartmentController.create);
router.put('/:id', departmentValidation, DepartmentController.update);
router.delete('/:id', DepartmentController.remove);

module.exports = router;
