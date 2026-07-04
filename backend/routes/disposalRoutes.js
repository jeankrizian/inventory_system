const express = require('express');
const DisposalController = require('../controllers/DisposalController');
const {
  requireAuth,
  requireOperateDisposal,
  requireSubmitDisposal,
  requireViewDisposal
} = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

router.get('/', requireViewDisposal, DisposalController.getAll);
router.get('/:id', requireViewDisposal, DisposalController.getById);
router.post('/', requireSubmitDisposal, DisposalController.create);
router.put('/:id/inspect', requireOperateDisposal, DisposalController.inspect);
router.put('/:id/approve', requireOperateDisposal, DisposalController.approve);
router.put('/:id/reject', requireOperateDisposal, DisposalController.reject);

module.exports = router;
