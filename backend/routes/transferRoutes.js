const express = require('express');
const TransferController = require('../controllers/TransferController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', TransferController.getAll);
router.get('/asset/:inventoryItemId/history', TransferController.getHistoryByAsset);
router.get('/:id', TransferController.getById);
router.post('/', TransferController.create);
router.put('/:id/approve', requireAdmin, TransferController.approve);
router.put('/:id/reject', requireAdmin, TransferController.reject);

module.exports = router;
