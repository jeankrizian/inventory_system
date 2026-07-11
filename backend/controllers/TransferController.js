const TransferModel = require('../models/TransferModel');
const InventoryModel = require('../models/InventoryModel');
const DepartmentModel = require('../models/DepartmentModel');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser, actorExcludeOptions } = require('../utils/notificationService');
const { transferLink } = require('../utils/notificationLinks');
const { canTransfer, isSemiDurable } = require('../utils/assetClassification');
const { getAccessScope, itemMatchesScope, transferMatchesScope } = require('../utils/roleHelpers');
const DocumentService = require('../utils/documentService');
const { buildAssetNotificationMessage } = require('../utils/assetNotificationHelper');

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
      if (item.is_archived) {
        return sendError(res, 'Archived assets cannot be transferred', 400);
      }
      const blockedStatuses = ['Borrowed', 'Under Maintenance', 'Disposed'];
      if (item.status !== 'Available' || blockedStatuses.includes(item.status)) {
        return sendError(
          res,
          `Only available assets can be transferred (current status: ${item.status || 'Unknown'})`,
          400
        );
      }
      if (!req.body.reason) return sendError(res, 'Reason for transfer is required', 400);
      const toDepartmentId = parseInt(req.body.to_department_id, 10);
      const toLocationId = parseInt(req.body.to_location_id, 10);
      if (!toDepartmentId || !toLocationId) {
        return sendError(res, 'Destination department and location are required', 400);
      }

      if (req.body.quantity !== undefined && req.body.quantity !== null && req.body.quantity !== '') {
        const quantity = parseInt(req.body.quantity, 10);
        if (!Number.isInteger(quantity) || quantity !== 1) {
          return sendError(res, 'Transfer quantity must be 1 for individual property assets', 400);
        }
      }

      const fromDepartmentId = parseInt(req.body.from_department_id, 10) || item.department_id;
      const fromLocationId = parseInt(req.body.from_location_id, 10) || item.location_id;
      if (
        fromDepartmentId
        && fromLocationId
        && toDepartmentId === fromDepartmentId
        && toLocationId === fromLocationId
      ) {
        return sendError(
          res,
          'Destination department and location must differ from the current department and location',
          400
        );
      }

      const existingPending = await TransferModel.findPendingByInventoryItem(item.id);
      if (existingPending) {
        return sendError(
          res,
          `A pending transfer already exists for this asset (${existingPending.transaction_code})`,
          400
        );
      }

      const result = await TransferModel.create({
        ...req.body,
        quantity: 1,
        to_department_id: toDepartmentId,
        to_location_id: toLocationId,
        from_location_id: fromLocationId,
        from_department_id: fromDepartmentId,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Transfer', `Transfer request ${result.transaction_code}`, req.ip, {
        entity_type: 'transfer_request',
        entity_id: result.id,
        reference_code: result.transaction_code,
        field_name: 'status',
        old_value: null,
        new_value: 'Pending'
      });
      await notifyPropertyManagers({
        title: 'New Transfer Request',
        message: buildAssetNotificationMessage({
          action: 'Transfer request submitted',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: result.transaction_code
        }),
        type: 'transfer_request',
        reference_id: result.id,
        link_url: transferLink(result.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, result, 'Transfer request created', 201);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async approve(req, res) {
    const connection = await pool.getConnection();
    try {
      const transfer = await TransferModel.findById(req.params.id);
      if (!transfer) return sendError(res, 'Transfer not found', 404);
      if (transfer.status !== 'Pending') return sendError(res, 'Only pending transfers can be approved', 400);

      const toDept = transfer.to_department_id
        ? await DepartmentModel.findById(transfer.to_department_id)
        : null;

      await connection.beginTransaction();

      try {
        await InventoryModel.updateLocationAndDepartment(transfer.inventory_item_id, {
          location_id: transfer.to_location_id,
          department_id: transfer.to_department_id || transfer.from_department_id,
          custodian_id: toDept?.custodian_id || undefined
        }, connection);

        await TransferModel.recordHistory(transfer, req.session.user.id, connection);
        await TransferModel.updateStatus(transfer.id, 'Approved', req.session.user.id, {
          notes: req.body.remarks || req.body.notes
        }, connection);

        await connection.commit();
      } catch (txErr) {
        await connection.rollback();
        throw txErr;
      }

      const item = await InventoryModel.findById(transfer.inventory_item_id);

      try {
        await DocumentService.refreshPARForCustodianAssignment(transfer.inventory_item_id, req.session.user.id);
      } catch (docErr) {
        console.error('Inventory PAR refresh failed:', docErr.message);
      }

      if (item && isSemiDurable(item.asset_classification)) {
        try {
          await DocumentService.refreshSALForSemiDurableIssuance(transfer.inventory_item_id, req.session.user.id);
        } catch (docErr) {
          console.error('SAL refresh failed:', docErr.message);
        }
      }

      await logActivity(req.session.user.id, 'APPROVE', 'Transfer', `Approved ${transfer.transaction_code}`, req.ip, {
        entity_type: 'transfer_request',
        entity_id: transfer.id,
        reference_code: transfer.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Approved'
      });
      await notifyUser(transfer.requested_by, {
        title: 'Transfer Approved',
        message: buildAssetNotificationMessage({
          action: 'Transfer request approved',
          itemName: item?.item_name,
          propertyTag: item?.property_tag,
          detail: transfer.transaction_code
        }),
        type: 'transfer_approved',
        reference_id: transfer.id,
        link_url: transferLink(transfer.id)
      }, actorExcludeOptions(req));

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
    } catch (err) {
      sendError(res, err.message, 500);
    } finally {
      connection.release();
    }
  },

  async reject(req, res) {
    try {
      const transfer = await TransferModel.findById(req.params.id);
      if (!transfer) return sendError(res, 'Transfer not found', 404);
      if (transfer.status !== 'Pending') return sendError(res, 'Only pending transfers can be rejected', 400);

      const reason = req.body.rejection_reason || req.body.reason || '';
      await TransferModel.updateStatus(transfer.id, 'Rejected', req.session.user.id, { rejection_reason: reason });
      await logActivity(req.session.user.id, 'REJECT', 'Transfer', `Rejected ${transfer.transaction_code}`, req.ip, {
        entity_type: 'transfer_request',
        entity_id: transfer.id,
        reference_code: transfer.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Rejected'
      });

      await notifyUser(transfer.requested_by, {
        title: 'Transfer Rejected',
        message: `Your transfer request ${transfer.transaction_code} has been rejected.${reason ? ` Reason: ${reason}` : ''}`,
        type: 'transfer_rejected',
        reference_id: transfer.id,
        link_url: transferLink(transfer.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, null, 'Transfer rejected');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = TransferController;
