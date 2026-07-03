const express = require('express');
const DisposalController = require('../controllers/DisposalController');
const { requireAuth, requireAdmin } = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', DisposalController.getAll);
router.get('/:id', DisposalController.getById);
router.post('/', DisposalController.create);
router.put('/:id/inspect', requireAdmin, DisposalController.inspect);
router.put('/:id/approve', requireAdmin, DisposalController.approve);
router.put('/:id/reject', requireAdmin, DisposalController.reject);

module.exports = router;
