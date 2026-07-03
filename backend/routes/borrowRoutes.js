const express = require('express');
const { body } = require('express-validator');
const BorrowController = require('../controllers/BorrowController');
const { requireAuth, requireAdmin, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', BorrowController.getAll);
router.get('/returns', BorrowController.getReturns);
router.get('/:id', BorrowController.getById);
router.post('/', [
  body('borrower_name').notEmpty(),
  body('borrow_date').notEmpty(),
  body('items').isArray({ min: 1 }),
  validate
], BorrowController.create);
router.put('/:id/approve', requireAdmin, BorrowController.approve);
router.put('/:id/reject', requireAdmin, BorrowController.reject);
router.post('/:id/return', BorrowController.processReturn);

module.exports = router;
