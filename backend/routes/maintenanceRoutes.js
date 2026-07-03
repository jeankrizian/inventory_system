const express = require('express');
const MaintenanceController = require('../controllers/MaintenanceController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', MaintenanceController.getAll);
router.get('/asset/:inventoryItemId', MaintenanceController.getByAsset);
router.get('/:id', MaintenanceController.getById);
router.post('/', MaintenanceController.create);
router.put('/:id/approve', requireAdmin, MaintenanceController.approve);
router.put('/:id/reject', requireAdmin, MaintenanceController.reject);
router.put('/:id/reschedule', requireAdmin, MaintenanceController.reschedule);
router.put('/:id/start', requireAdmin, MaintenanceController.start);
router.put('/:id/complete', requireAdmin, MaintenanceController.complete);

module.exports = router;
