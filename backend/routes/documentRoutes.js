const express = require('express');
const DocumentController = require('../controllers/DocumentController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', DocumentController.getAll);
router.get('/lookup', DocumentController.findByTransaction);
router.get('/by-inventory/:inventoryItemId', DocumentController.findByInventoryItem);
router.get('/:id/pdf', DocumentController.downloadPdf);
router.get('/:id', DocumentController.getById);

module.exports = router;
