const express = require('express');
const { body } = require('express-validator');
const DepartmentController = require('../controllers/DepartmentController');
const { requireAuth, requireSystemManage, validate } = require('../middleware/auth');

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
router.post('/', requireSystemManage, departmentValidation, DepartmentController.create);
router.put('/:id', requireSystemManage, departmentValidation, DepartmentController.update);
router.delete('/:id', requireSystemManage, DepartmentController.remove);

module.exports = router;
