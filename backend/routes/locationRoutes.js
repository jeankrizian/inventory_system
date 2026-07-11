const express = require('express');
const { body } = require('express-validator');
const LocationController = require('../controllers/LocationController');
const { requireAuth, requireSystemManage, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', LocationController.getAll);
router.get('/:id', LocationController.getById);
router.post('/', requireSystemManage, [body('name').notEmpty().withMessage('Location name is required'), validate], LocationController.create);
router.put('/:id', requireSystemManage, [body('name').notEmpty().withMessage('Location name is required'), validate], LocationController.update);
router.delete('/:id', requireSystemManage, LocationController.remove);

module.exports = router;
