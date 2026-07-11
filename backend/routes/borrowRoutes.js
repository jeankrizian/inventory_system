const express = require('express');
const { body } = require('express-validator');
const BorrowController = require('../controllers/BorrowController');
const {
  requireAuth,
  requireApproveBorrow,
  requireProcessReturn,
  requireSubmitBorrow,
  requireViewReturnHistory,
  validate
} = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', BorrowController.getAll);
router.get('/borrowable-items', requireSubmitBorrow, BorrowController.getBorrowableItems);
router.get('/borrowable-models/:itemCode/assets', requireSubmitBorrow, BorrowController.getModelAssets);
router.post('/preview-allocation', requireSubmitBorrow, BorrowController.previewAllocation);
router.get('/returns', requireViewReturnHistory, BorrowController.getReturns);
router.get('/asset/:inventoryItemId/history', BorrowController.getHistoryByAsset);
router.get('/:id', BorrowController.getById);
router.post('/', [
  requireSubmitBorrow,
  body('borrow_date').notEmpty(),
  body('purpose').trim().notEmpty().withMessage('Purpose is required'),
  body('items').isArray({ min: 1 }),
  validate
], BorrowController.create);
router.put('/:id/approve', requireApproveBorrow, BorrowController.approve);
router.put('/:id/reject', requireApproveBorrow, BorrowController.reject);
router.post('/:id/return', requireProcessReturn, BorrowController.processReturn);

module.exports = router;
