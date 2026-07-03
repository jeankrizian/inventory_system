const express = require('express');
const ArchiveController = require('../controllers/ArchiveController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireAdmin);

router.get('/', ArchiveController.getAll);
router.put('/:module/:id/restore', ArchiveController.restore);

module.exports = router;
