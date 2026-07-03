const express = require('express');
const { body } = require('express-validator');
const UserController = require('../controllers/UserController');
const { requireAuth, requireAdmin, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/active', UserController.getActive);

router.use(requireAdmin);
router.get('/roles', UserController.getRoles);
router.get('/', UserController.getAll);
router.get('/:id', UserController.getById);
router.post('/', [
  body('full_name').notEmpty().withMessage('Full name is required'),
  body('username').notEmpty().withMessage('Username is required'),
  body('email').notEmpty().withMessage('Email is required'),
  body('role').notEmpty().withMessage('Role is required'),
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  validate
], UserController.create);
router.put('/:id', UserController.update);
router.delete('/:id', UserController.remove);

module.exports = router;
