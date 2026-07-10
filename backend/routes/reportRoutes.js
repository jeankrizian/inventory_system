const express = require('express');
const ReportController = require('../controllers/ReportController');
const { requireAuth, requireReportsAccess, requireReportType, requireExportReportType } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth, requireReportsAccess);

router.get('/filter-options', ReportController.getFilterOptions);
router.get('/inventory', requireReportType('inventory'), ReportController.getInventoryReport);
router.get('/borrow', requireReportType('borrow'), ReportController.getBorrowReport);
router.get('/return', requireReportType('return'), ReportController.getReturnReport);
router.get('/low-stock', requireReportType('low-stock'), ReportController.getLowStockReport);
router.get('/supplier', requireReportType('supplier'), ReportController.getSupplierReport);
router.get('/transfers', requireReportType('transfers'), ReportController.getTransferReport);
router.get('/maintenance', requireReportType('maintenance'), ReportController.getMaintenanceReport);
router.get('/disposals', requireReportType('disposals'), ReportController.getDisposalReport);
router.get('/departments', requireReportType('departments'), ReportController.getDepartmentReport);
router.get('/asset-status', requireReportType('asset-status'), ReportController.getAssetStatusReport);
router.get('/custodians', requireReportType('custodians'), ReportController.getCustodianReport);
router.get('/export/pdf/:type', requireExportReportType, ReportController.exportPDF);
router.get('/export/excel/:type', requireExportReportType, ReportController.exportExcel);

module.exports = router;
