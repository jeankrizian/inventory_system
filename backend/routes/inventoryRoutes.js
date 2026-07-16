const express = require('express');
const multer = require('multer');
const { body } = require('express-validator');
const InventoryController = require('../controllers/InventoryController');
const {
  requireAuth,
  requireViewInventory,
  requireManageInventory,
  validate
} = require('../middleware/auth');

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

const createItemValidation = [
  body('item_name').notEmpty().withMessage('Item name is required'),
  body().custom((_, { req }) => {
    if (!req.body.department_id && !req.body.category_id) {
      throw new Error('Department is required');
    }
    return true;
  }),
  body('asset_count').optional().isInt({ min: 1, max: 500 }).withMessage('Asset count must be between 1 and 500'),
  body('quantity').optional().isInt({ min: 1, max: 500 }).withMessage('Asset count must be between 1 and 500'),
  validate
];

function handleUpload(req, res, next) {
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 10MB.'
      : (err.message || 'File upload failed');
    return res.status(400).json({ success: false, message });
  });
}

router.get('/', requireViewInventory, InventoryController.getAll);
router.get('/import/template', requireManageInventory, InventoryController.downloadImportTemplate);
router.post('/import/preview', requireManageInventory, handleUpload, InventoryController.previewImport);
router.post('/import/confirm', requireManageInventory, InventoryController.confirmImport);
router.get('/next-code', requireManageInventory, InventoryController.getNextCode);
router.get('/:id/timeline', requireViewInventory, InventoryController.getTimeline);
router.get('/:id', requireViewInventory, InventoryController.getById);
router.post('/', requireManageInventory, createItemValidation, InventoryController.create);
router.put('/:id', requireManageInventory, InventoryController.update);
router.delete('/:id', requireManageInventory, InventoryController.remove);

module.exports = router;
