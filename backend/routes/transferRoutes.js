const express = require('express');
const TransferController = require('../controllers/TransferController');
const {
  requireAuth,
  requireOperateTransfers,
  requireSubmitTransfer,
  requireViewTransfers
} = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireViewTransfers, TransferController.getAll);
router.get('/asset/:inventoryItemId/history', requireViewTransfers, TransferController.getHistoryByAsset);
router.get('/:id', requireViewTransfers, TransferController.getById);
router.post('/', requireSubmitTransfer, TransferController.create);
router.put('/:id/approve', requireOperateTransfers, TransferController.approve);
router.put('/:id/reject', requireOperateTransfers, TransferController.reject);

module.exports = router;
