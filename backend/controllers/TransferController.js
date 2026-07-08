const TransferModel = require('../models/TransferModel');
const InventoryModel = require('../models/InventoryModel');
const DepartmentModel = require('../models/DepartmentModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser, notifyCustodiansForItem } = require('../utils/notificationService');
const { transferLink } = require('../utils/notificationLinks');
const { canTransfer, isSemiDurable } = require('../utils/assetClassification');
const { getAccessScope, itemMatchesScope, transferMatchesScope } = require('../utils/roleHelpers');
const DocumentService = require('../utils/documentService');

const TransferController = {
  async getAll(req, res) {
    try {
      const scope = getAccessScope(req.session.user);
      const data = await TransferModel.getAll({
        status: req.query.status,
        search: req.query.search,
        inventory_item_id: req.query.inventory_item_id,
        scope
      });
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getById(req, res) {
    try {
      const transfer = await TransferModel.findById(req.params.id);
      if (!transfer) return sendError(res, 'Transfer not found', 404);

      const item = await InventoryModel.findById(transfer.inventory_item_id);
      const scope = getAccessScope(req.session.user);
      const inScope = (item && itemMatchesScope(item, scope)) || transferMatchesScope(transfer, scope);
      if (!inScope) {
        return sendError(res, 'Access denied', 403);
      }

      sendSuccess(res, transfer);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getHistoryByAsset(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.inventoryItemId);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      const data = await TransferModel.getHistoryByAsset(req.params.inventoryItemId);
      sendSuccess(res, data);
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

      if (!canTransfer(item.asset_classification)) {
        return sendError(res, 'Consumable items cannot be transferred', 400);
      }
      if (!req.body.reason) return sendError(res, 'Reason for transfer is required', 400);

      const result = await TransferModel.create({
        ...req.body,
        from_location_id: req.body.from_location_id || item.location_id,
        from_department_id: req.body.from_department_id || item.department_id,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Transfer', `Transfer request ${result.transaction_code}`, req.ip);
      await notifyPropertyManagers({
        title: 'New Transfer Request',
        message: `New transfer request ${result.transaction_code} for ${item.item_name}.`,
        type: 'transfer_request',
        reference_id: result.id,
        link_url: transferLink(result.id)
      });
      await notifyCustodiansForItem(item, {
        title: 'Transfer Request',
        message: `Transfer request ${result.transaction_code} was filed for assigned asset ${item.item_name}.`,
        type: 'transfer_request',
        reference_id: result.id,
        link_url: transferLink(result.id),
        skipDuplicate: true
      });

      sendSuccess(res, result, 'Transfer request created', 201);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async approve(req, res) {
    try {
      const transfer = await TransferModel.findById(req.params.id);
      if (!transfer) return sendError(res, 'Transfer not found', 404);
      if (transfer.status !== 'Pending') return sendError(res, 'Only pending transfers can be approved', 400);

      const toDept = transfer.to_department_id
        ? await DepartmentModel.findById(transfer.to_department_id)
        : null;

      await InventoryModel.updateLocationAndDepartment(transfer.inventory_item_id, {
        location_id: transfer.to_location_id,
        department_id: transfer.to_department_id || transfer.from_department_id,
        custodian_id: toDept?.custodian_id || undefined
      });

      try {
        await DocumentService.refreshPARForCustodianAssignment(transfer.inventory_item_id, req.session.user.id);
      } catch (docErr) {
        console.error('Inventory PAR refresh failed:', docErr.message);
      }

      const item = await InventoryModel.findById(transfer.inventory_item_id);
      if (item && isSemiDurable(item.asset_classification)) {
        try {
          await DocumentService.refreshSALForSemiDurableIssuance(transfer.inventory_item_id, req.session.user.id);
        } catch (docErr) {
          console.error('SAL refresh failed:', docErr.message);
        }
      }

      await TransferModel.recordHistory(transfer, req.session.user.id);
      await TransferModel.updateStatus(transfer.id, 'Approved', req.session.user.id, {
        notes: req.body.remarks || req.body.notes
      });

      await logActivity(req.session.user.id, 'APPROVE', 'Transfer', `Approved ${transfer.transaction_code}`, req.ip);
      await notifyUser(transfer.requested_by, {
        title: 'Transfer Approved',
        message: `Your transfer request ${transfer.transaction_code} has been approved.`,
        type: 'transfer_approved',
        reference_id: transfer.id,
        link_url: transferLink(transfer.id)
      });
      await notifyUser(transfer.requested_by, {
        title: 'Transfer Completed',
        message: `Your transfer request ${transfer.transaction_code} has been completed.`,
        type: 'transfer_completed',
        reference_id: transfer.id,
        link_url: transferLink(transfer.id)
      });

      let generatedDocument = null;
      try {
        const doc = await DocumentService.generateTRFForTransfer(transfer.id, req.session.user.id);
        if (doc) {
          generatedDocument = { id: doc.id, document_number: doc.document_number, document_type: 'TRF' };
        }
      } catch (docErr) {
        console.error('TRF generation failed:', docErr.message);
      }

      sendSuccess(res, { generated_document: generatedDocument }, 'Transfer approved and inventory updated');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async reject(req, res) {
    try {
      const transfer = await TransferModel.findById(req.params.id);
      if (!transfer) return sendError(res, 'Transfer not found', 404);
      if (transfer.status !== 'Pending') return sendError(res, 'Only pending transfers can be rejected', 400);

      const reason = req.body.rejection_reason || req.body.reason || '';
      await TransferModel.updateStatus(transfer.id, 'Rejected', req.session.user.id, { rejection_reason: reason });
      await logActivity(req.session.user.id, 'REJECT', 'Transfer', `Rejected ${transfer.transaction_code}`, req.ip);

      await notifyUser(transfer.requested_by, {
        title: 'Transfer Rejected',
        message: `Your transfer request ${transfer.transaction_code} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'transfer_rejected',
        reference_id: transfer.id,
        link_url: transferLink(transfer.id)
      });

      sendSuccess(res, null, 'Transfer rejected');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = TransferController;
