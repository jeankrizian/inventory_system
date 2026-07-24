const express = require('express');
const multer = require('multer');
const ComponentController = require('../controllers/ComponentController');
const { requireAuth, requireManageInventory } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    const allowedMime = new Set([
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'application/octet-stream'
    ]);
    if (name.endsWith('.xlsx') || name.endsWith('.xls') || allowedMime.has(file.mimetype)) {
      cb(null, true);
      return;
    }
    cb(new Error('Only .xlsx or .xls files are allowed'));
  }
});

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 10MB.'
      : (err.message || 'File upload failed');
    return res.status(400).json({ success: false, message });
  });
}

router.get('/import/template', requireManageInventory, ComponentController.downloadImportTemplate);
router.post('/import/preview', requireManageInventory, handleUpload, ComponentController.previewImport);
router.post('/import/confirm', requireManageInventory, ComponentController.confirmImport);

router.get('/', requireManageInventory, ComponentController.getAll);
router.get('/parent/:parentId', requireManageInventory, ComponentController.getByParent);
router.post('/', requireManageInventory, ComponentController.create);
router.put('/:id', requireManageInventory, ComponentController.update);
router.post('/:id/replace', requireManageInventory, ComponentController.replace);

module.exports = router;
