const express = require('express');
const { body } = require('express-validator');
const AuthController = require('../controllers/AuthController');
const { validate } = require('../middleware/auth');
const { isValidSchoolEmail, isValidUsername } = require('../utils/authValidation');

const router = express.Router();

const schoolEmailValidator = body('email')
  .trim()
  .notEmpty().withMessage('Email is required')
  .custom((value) => {
    if (!isValidSchoolEmail(value)) {
      throw new Error('Only @caviteinstitute.edu.ph email addresses are allowed');
    }
    return true;
  });

router.post('/login', [
  body('username').notEmpty().withMessage('Username is required'),
  body('password').notEmpty().withMessage('Password is required'),
  validate
], AuthController.login);

router.post('/register', [
  body('full_name').trim().notEmpty().withMessage('Full name is required'),
  body('username')
    .trim()
    .notEmpty().withMessage('Username is required')
    .isLength({ min: 4, max: 30 }).withMessage('Username must be between 4 and 30 characters')
    .custom((value) => {
      if (/\s/.test(value)) throw new Error('Username cannot contain spaces');
      if (!isValidUsername(value)) {
        throw new Error('Username may only contain letters, numbers, underscores, and periods');
      }
      return true;
    }),
  schoolEmailValidator,
  body('password').isLength({ min: 8 }).withMessage('Password must be at least 8 characters'),
  body('confirm_password').custom((value, { req }) => {
    if (value !== req.body.password) throw new Error('Passwords do not match');
    return true;
  }),
  validate
], AuthController.register);

router.post('/forgot-password', [
  schoolEmailValidator,
  validate
], AuthController.forgotPassword);

router.get('/registration-roles', AuthController.getRegistrationRoles);

router.post('/logout', AuthController.logout);
router.get('/me', AuthController.me);

module.exports = router;
