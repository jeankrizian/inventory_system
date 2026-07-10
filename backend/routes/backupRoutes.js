const express = require('express');
const BackupController = require('../controllers/BackupController');
const { requireAuth, requireViewBackups, requireManageBackups } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireViewBackups);

router.get('/', BackupController.list);
router.get('/:id/download', BackupController.download);
router.post('/', requireManageBackups, BackupController.create);
router.post('/:id/restore', requireManageBackups, BackupController.restoreById);
router.delete('/:id', requireManageBackups, BackupController.remove);

module.exports = router;
