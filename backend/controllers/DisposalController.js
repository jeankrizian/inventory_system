const DisposalModel = require('../models/DisposalModel');
const InventoryModel = require('../models/InventoryModel');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser, actorExcludeOptions } = require('../utils/notificationService');
const { disposalLink } = require('../utils/notificationLinks');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');
const DocumentService = require('../utils/documentService');
const { buildAssetNotificationMessage } = require('../utils/assetNotificationHelper');

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

  async getByAsset(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.inventoryItemId);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      const data = await DisposalModel.getByAsset(req.params.inventoryItemId);
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

      if (item.status === 'Disposed') {
        return sendError(res, 'Asset is already disposed', 400);
      }
      if (item.status !== 'Available') {
        return sendError(res, `Disposal can only be requested for available assets (current status: ${item.status})`, 400);
      }

      const ComponentModel = require('../models/ComponentModel');
      const linkedComponents = await ComponentModel.countActiveByParent(item.id);
      const [childRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM inventory_items
         WHERE parent_asset_id = ? AND (is_archived = 0) AND status != 'Disposed'`,
        [item.id]
      );
      const linkedInventoryChildren = Number(childRows[0]?.cnt || 0);
      if (linkedComponents > 0 || linkedInventoryChildren > 0) {
        const total = Math.max(linkedComponents, linkedInventoryChildren) || linkedComponents + linkedInventoryChildren;
        return sendError(
          res,
          `This Durable asset has ${total} linked component(s). Resolve them first by disposing them together, detaching them, or transferring them to another parent asset before requesting disposal.`,
          400
        );
      }

      const reason = String(req.body.reason || '').trim();
      if (!reason) {
        return sendError(res, 'Disposal reason is required', 400);
      }

      const existingPending = await DisposalModel.findPendingByInventoryItem(item.id);
      if (existingPending) {
        return sendError(
          res,
          `A pending disposal request already exists for this asset (${existingPending.transaction_code})`,
          400
        );
      }

      const quantity = 1;

      const result = await DisposalModel.create({
        ...req.body,
        reason,
        quantity,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Disposal', `Disposal request ${result.transaction_code}`, req.ip, {
        entity_type: 'disposal_request',
        entity_id: result.id,
        reference_code: result.transaction_code,
        field_name: 'status',
        old_value: null,
        new_value: 'Pending'
      });
      await notifyPropertyManagers({
        title: 'Disposal Request',
        message: buildAssetNotificationMessage({
          action: 'Disposal request submitted',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: result.transaction_code
        }),
        type: 'disposal_request',
        reference_id: result.id,
        link_url: disposalLink(result.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, result, 'Disposal request created', 201);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async inspect(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (disposal.status !== 'Pending') return sendError(res, 'Only pending requests can be inspected', 400);

      const inspectionNotes = String(req.body.inspection_notes || '').trim();
      if (!inspectionNotes) {
        return sendError(res, 'Inspection notes are required', 400);
      }

      await DisposalModel.inspect(req.params.id, req.session.user.id, inspectionNotes);
      await logActivity(req.session.user.id, 'INSPECT', 'Disposal', `Inspected ${disposal.transaction_code}`, req.ip, {
        entity_type: 'disposal_request',
        entity_id: disposal.id,
        reference_code: disposal.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Inspected'
      });
      sendSuccess(res, null, 'Inspection recorded');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async approve(req, res) {
    const connection = await pool.getConnection();
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (disposal.status !== 'Inspected') {
        return sendError(res, 'Only inspected requests can be approved', 400);
      }

      const disposalMethod = String(req.body.disposal_method || '').trim();
      const disposalDate = String(req.body.disposal_date || '').trim() || new Date().toISOString().split('T')[0];
      if (!disposalMethod) {
        return sendError(res, 'Disposal method is required', 400);
      }

      const ComponentModel = require('../models/ComponentModel');
      const linkedComponents = await ComponentModel.countActiveByParent(disposal.inventory_item_id);
      const [childRows] = await pool.query(
        `SELECT COUNT(*) AS cnt FROM inventory_items
         WHERE parent_asset_id = ? AND (is_archived = 0) AND status != 'Disposed'`,
        [disposal.inventory_item_id]
      );
      const linkedInventoryChildren = Number(childRows[0]?.cnt || 0);
      if (linkedComponents > 0 || linkedInventoryChildren > 0) {
        connection.release();
        const total = Math.max(linkedComponents, linkedInventoryChildren) || linkedComponents + linkedInventoryChildren;
        return sendError(
          res,
          `Cannot complete disposal: this asset still has ${total} linked component(s). Dispose, detach, or reassign the components first.`,
          400
        );
      }

      await connection.beginTransaction();
      try {
        const marked = await InventoryModel.markDisposed(disposal.inventory_item_id, connection);
        if (!marked) {
          throw new Error('Asset must be available to complete disposal');
        }
        const updated = await DisposalModel.updateStatus(disposal.id, 'Completed', req.session.user.id, {
          disposal_method: disposalMethod,
          disposal_date: disposalDate,
          notes: req.body.notes
        }, connection);
        if (!updated) {
          throw new Error('Failed to update disposal request');
        }
        await connection.commit();
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      }

      await logActivity(req.session.user.id, 'APPROVE', 'Disposal', `Approved ${disposal.transaction_code}`, req.ip, {
        entity_type: 'disposal_request',
        entity_id: disposal.id,
        reference_code: disposal.transaction_code,
        field_name: 'status',
        old_value: disposal.status,
        new_value: 'Completed'
      });

      let generatedDocument = null;
      try {
        const doc = await DocumentService.refreshRDF(disposal.id, req.session.user.id);
        if (doc) {
          generatedDocument = {
            id: doc.id,
            document_number: doc.document_number,
            document_type: 'RDF'
          };
        }
      } catch (docErr) {
        console.error('RDF generation failed:', docErr.message);
      }

      await notifyUser(disposal.requested_by, {
        title: 'Disposal Approved',
        message: buildAssetNotificationMessage({
          action: 'Disposal request approved',
          itemName: disposal.item_name,
          propertyTag: disposal.property_tag,
          detail: disposal.transaction_code
        }),
        type: 'disposal_approved',
        reference_id: disposal.id,
        link_url: disposalLink(disposal.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, { generated_document: generatedDocument }, 'Disposal approved and inventory updated');
    } catch (err) {
      sendError(res, err.message, 500);
    } finally {
      connection.release();
    }
  },

  async reject(req, res) {
    try {
      const disposal = await getScopedDisposal(req, res);
      if (!disposal) return;
      if (['Completed', 'Rejected'].includes(disposal.status)) {
        return sendError(res, 'Request cannot be rejected', 400);
      }

      const rejectionReason = String(req.body.rejection_reason || req.body.reason || '').trim();
      if (!rejectionReason) {
        return sendError(res, 'Rejection reason is required', 400);
      }

      await DisposalModel.updateStatus(disposal.id, 'Rejected', req.session.user.id, {
        notes: rejectionReason
      });
      await logActivity(req.session.user.id, 'REJECT', 'Disposal', `Rejected ${disposal.transaction_code}`, req.ip, {
        entity_type: 'disposal_request',
        entity_id: disposal.id,
        reference_code: disposal.transaction_code,
        field_name: 'status',
        old_value: disposal.status,
        new_value: 'Rejected'
      });

      await notifyUser(disposal.requested_by, {
        title: 'Disposal Rejected',
        message: `Your disposal request ${disposal.transaction_code} has been rejected. Reason: ${rejectionReason}`,
        type: 'disposal_rejected',
        reference_id: disposal.id,
        link_url: disposalLink(disposal.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, null, 'Disposal rejected');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = DisposalController;
