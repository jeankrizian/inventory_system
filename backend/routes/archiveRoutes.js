const express = require('express');
const ArchiveController = require('../controllers/ArchiveController');
const { requireAuth, requireArchiveAccess } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);
router.use(requireArchiveAccess);

router.get('/', ArchiveController.getAll);
router.put('/:module/:id/restore', ArchiveController.restore);

module.exports = router;
