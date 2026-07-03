const express = require('express');
const { body } = require('express-validator');
const LocationController = require('../controllers/LocationController');
const { requireAuth, validate } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', LocationController.getAll);
router.get('/:id', LocationController.getById);
router.post('/', [body('name').notEmpty(), validate], LocationController.create);
router.put('/:id', LocationController.update);
router.delete('/:id', LocationController.remove);

module.exports = router;
