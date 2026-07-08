const DisposalModel = require('../models/DisposalModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser, notifyCustodiansForItem } = require('../utils/notificationService');
const { disposalLink } = require('../utils/notificationLinks');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');
const DocumentService = require('../utils/documentService');

async function getScopedDisposal(req, res) {
  const disposal = await DisposalModel.findById(req.params.id);
  if (!disposal) {
    sendError(res, 'Disposal request not found', 404);
    return null;
  }
  const item = await InventoryModel.findById(disposal.inventory_item_id);
  const scope = getAccessScope(req.session.user);
  if (item && !itemMatchesScope(item, scope)) {
    sendError(res, 'Access denied', 403);
    return null;
  }
  return disposal;
}

const DisposalController = {
  async getAll(req, res) {
    try {
      const scope = getAccessScope(req.session.user);
      const data = await DisposalModel.getAll({
        status: req.query.status,
        search: req.query.search,
        scope
      });
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getById(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      sendSuccess(res, disposal);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async create(req, res) {
    try {
      const item = await InventoryModel.findById(req.body.inventory_item_id);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Item is outside your assigned scope', 403);
      }

      const result = await DisposalModel.create({
        ...req.body,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Disposal', `Disposal request ${result.transaction_code}`, req.ip);
      await notifyPropertyManagers({
        title: 'Disposal Request',
        message: `New disposal request ${result.transaction_code} for ${item.item_name}.`,
        type: 'disposal_request',
        reference_id: result.id,
        link_url: disposalLink(result.id)
      });
      await notifyCustodiansForItem(item, {
        title: 'Disposal Request',
        message: `Disposal request ${result.transaction_code} was filed for assigned asset ${item.item_name}.`,
        type: 'disposal_request',
        reference_id: result.id,
        link_url: disposalLink(result.id),
        skipDuplicate: true
      });

      let generatedDocument = null;
      try {
        const doc = await DocumentService.generateRDF(result.id, req.session.user.id);
        generatedDocument = { id: doc.id, document_number: doc.document_number, document_type: 'RDF' };
      } catch (docErr) {
        console.error('RDF generation failed:', docErr.message);
      }

      sendSuccess(res, { ...result, generated_document: generatedDocument }, 'Disposal request created', 201);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async inspect(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (disposal.status !== 'Pending') return sendError(res, 'Only pending requests can be inspected', 400);

      await DisposalModel.inspect(req.params.id, req.session.user.id, req.body.inspection_notes);
      await logActivity(req.session.user.id, 'INSPECT', 'Disposal', `Inspected ${disposal.transaction_code}`, req.ip);
      sendSuccess(res, null, 'Inspection recorded');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async approve(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (disposal.status !== 'Inspected') {
        return sendError(res, 'Only inspected requests can be approved', 400);
      }

      await InventoryModel.markDisposed(disposal.inventory_item_id, disposal.quantity);
      await DisposalModel.updateStatus(disposal.id, 'Completed', req.session.user.id, {
        disposal_method: req.body.disposal_method,
        disposal_date: req.body.disposal_date || new Date().toISOString().split('T')[0],
        notes: req.body.notes
      });
      await logActivity(req.session.user.id, 'APPROVE', 'Disposal', `Approved ${disposal.transaction_code}`, req.ip);

      let generatedDocument = null;
      try {
        const doc = await DocumentService.refreshRDF(disposal.id, req.session.user.id);
        generatedDocument = { id: doc.id, document_number: doc.document_number, document_type: 'RDF' };
      } catch (docErr) {
        console.error('RDF refresh failed:', docErr.message);
      }

      await notifyUser(disposal.requested_by, {
        title: 'Disposal Approved',
        message: `Your disposal request ${disposal.transaction_code} has been approved.`,
        type: 'disposal_approved',
        reference_id: disposal.id,
        link_url: disposalLink(disposal.id)
      });
      await notifyUser(disposal.requested_by, {
        title: 'Disposal Finalized',
        message: `Your disposal request ${disposal.transaction_code} has been finalized.`,
        type: 'disposal_finalized',
        reference_id: disposal.id,
        link_url: disposalLink(disposal.id)
      });

      sendSuccess(res, { generated_document: generatedDocument }, 'Disposal approved and inventory updated');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async reject(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (['Completed', 'Rejected'].includes(disposal.status)) {
        return sendError(res, 'Request cannot be rejected', 400);
      }

      await DisposalModel.updateStatus(disposal.id, 'Rejected', req.session.user.id, {
        notes: req.body.rejection_reason || req.body.reason || null
      });
      await logActivity(req.session.user.id, 'REJECT', 'Disposal', `Rejected ${disposal.transaction_code}`, req.ip);

      await notifyUser(disposal.requested_by, {
        title: 'Disposal Rejected',
        message: `Your disposal request ${disposal.transaction_code} has been rejected.`,
        type: 'disposal_rejected',
        reference_id: disposal.id,
        link_url: disposalLink(disposal.id)
      });

      sendSuccess(res, null, 'Disposal rejected');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = DisposalController;
