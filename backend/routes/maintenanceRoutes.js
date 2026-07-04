const express = require('express');
const MaintenanceController = require('../controllers/MaintenanceController');
const {
  requireAuth,
  requireOperateMaintenance,
  requireSubmitMaintenance,
  requireViewMaintenance
} = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireViewMaintenance, MaintenanceController.getAll);
router.get('/asset/:inventoryItemId', requireViewMaintenance, MaintenanceController.getByAsset);
router.get('/:id', requireViewMaintenance, MaintenanceController.getById);
router.post('/', requireSubmitMaintenance, MaintenanceController.create);
router.put('/:id/approve', requireOperateMaintenance, MaintenanceController.approve);
router.put('/:id/reject', requireOperateMaintenance, MaintenanceController.reject);
router.put('/:id/reschedule', requireOperateMaintenance, MaintenanceController.reschedule);
router.put('/:id/start', requireOperateMaintenance, MaintenanceController.start);
router.put('/:id/complete', requireOperateMaintenance, MaintenanceController.complete);

module.exports = router;
