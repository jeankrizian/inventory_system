const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', DashboardController.getAll);
router.get('/stats', DashboardController.getStats);
router.get('/charts', DashboardController.getCharts);
router.get('/tables', DashboardController.getTables);

module.exports = router;
