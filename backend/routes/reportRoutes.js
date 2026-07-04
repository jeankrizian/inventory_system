const express = require('express');
const ReportController = require('../controllers/ReportController');
const { requireAuth, requireReportsAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireReportsAccess);

router.get('/inventory', ReportController.getInventoryReport);
router.get('/borrow', ReportController.getBorrowReport);
router.get('/return', ReportController.getReturnReport);
router.get('/low-stock', ReportController.getLowStockReport);
router.get('/supplier', ReportController.getSupplierReport);
router.get('/transfers', ReportController.getTransferReport);
router.get('/maintenance', ReportController.getMaintenanceReport);
router.get('/disposals', ReportController.getDisposalReport);
router.get('/departments', ReportController.getDepartmentReport);
router.get('/asset-status', ReportController.getAssetStatusReport);
router.get('/custodians', ReportController.getCustodianReport);
router.get('/export/pdf/:type', ReportController.exportPDF);
router.get('/export/excel/:type', ReportController.exportExcel);

module.exports = router;
