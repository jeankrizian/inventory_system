const MaintenanceModel = require('../models/MaintenanceModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser, actorExcludeOptions } = require('../utils/notificationService');
const { maintenanceLink } = require('../utils/notificationLinks');
const { canMaintain } = require('../utils/assetClassification');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');
const { buildAssetNotificationMessage } = require('../utils/assetNotificationHelper');

async function getScopedRecord(req, res) {
  const record = await MaintenanceModel.findById(req.params.id);
  if (!record) {
    sendError(res, 'Maintenance request not found', 404);
    return null;
  }
  const item = await InventoryModel.findById(record.inventory_item_id);
  const scope = getAccessScope(req.session.user);
  if (item && !itemMatchesScope(item, scope)) {
    sendError(res, 'Access denied', 403);
    return null;
  }
  return record;
}

const MaintenanceController = {
  async getAll(req, res) {
    try {
      const scope = getAccessScope(req.session.user);
      const data = await MaintenanceModel.getAll({
        inventory_item_id: req.query.inventory_item_id,
        status: req.query.status,
        search: req.query.search,
        scope
      });
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getById(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      sendSuccess(res, record);
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

      const data = await MaintenanceModel.getByAsset(req.params.inventoryItemId);
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

      if (!canMaintain(item.asset_classification)) {
        return sendError(res, 'Maintenance is only available for Durable items', 400);
      }
      if (item.status !== 'Available') {
        return sendError(res, `Maintenance can only be requested for available assets (current status: ${item.status})`, 400);
      }
      if (!req.body.scheduled_date) return sendError(res, 'Scheduled maintenance date is required', 400);
      if (!req.body.reported_problem && !req.body.description) {
        return sendError(res, 'Reported problem is required', 400);
      }

      const existingPending = await MaintenanceModel.findPendingByInventoryItem(item.id);
      if (existingPending) {
        return sendError(
          res,
          `A pending maintenance request already exists for this asset (${existingPending.transaction_code})`,
          400
        );
      }

      const result = await MaintenanceModel.create({
        ...req.body,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Maintenance', `Maintenance request ${result.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: result.id,
        reference_code: result.transaction_code,
        field_name: 'status',
        old_value: null,
        new_value: 'Pending'
      });
      await notifyPropertyManagers({
        title: 'New Maintenance Request',
        message: buildAssetNotificationMessage({
          action: 'Maintenance request submitted',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: result.transaction_code
        }),
        type: 'maintenance_request',
        reference_id: result.id,
        link_url: maintenanceLink(result.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, result, 'Maintenance request submitted', 201);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async approve(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (record.status !== 'Pending') return sendError(res, 'Only pending requests can be approved', 400);

      await MaintenanceModel.approve(req.params.id, req.session.user.id, req.body.admin_remarks);
      const schedDate = req.body.scheduled_date || record.scheduled_date;
      let finalStatus = 'Approved';
      if (schedDate) {
        await MaintenanceModel.reschedule(req.params.id, {
          scheduled_date: schedDate,
          technician: req.body.technician,
          admin_remarks: req.body.admin_remarks
        });
        finalStatus = 'Scheduled';
      }

      await logActivity(req.session.user.id, 'APPROVE', 'Maintenance', `Approved ${record.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: record.id,
        reference_code: record.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: finalStatus
      });
      await notifyUser(record.requested_by, {
        title: 'Maintenance Approved',
        message: buildAssetNotificationMessage({
          action: 'Maintenance request approved',
          itemName: record.item_name,
          propertyTag: record.property_tag,
          detail: record.transaction_code
        }),
        type: 'maintenance_approved',
        reference_id: record.id,
        link_url: maintenanceLink(record.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, null, 'Maintenance request approved');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async reject(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (record.status !== 'Pending') return sendError(res, 'Only pending requests can be rejected', 400);

      const rejectionReason = (req.body.rejection_reason || req.body.reason || '').trim();
      if (!rejectionReason) {
        return sendError(res, 'Rejection reason is required', 400);
      }

      await MaintenanceModel.reject(req.params.id, req.session.user.id, rejectionReason);
      await logActivity(req.session.user.id, 'REJECT', 'Maintenance', `Rejected ${record.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: record.id,
        reference_code: record.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Cancelled'
      });
      await notifyUser(record.requested_by, {
        title: 'Maintenance Rejected',
        message: `Your maintenance request ${record.transaction_code} has been rejected. Reason: ${rejectionReason}`,
        type: 'maintenance_rejected',
        reference_id: record.id,
        link_url: maintenanceLink(record.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, null, 'Maintenance request rejected');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async reschedule(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (!['Pending', 'Approved', 'Scheduled'].includes(record.status)) {
        return sendError(res, 'This request cannot be rescheduled', 400);
      }
      if (!req.body.scheduled_date) return sendError(res, 'Scheduled date is required', 400);

      await MaintenanceModel.reschedule(req.params.id, req.body);
      await logActivity(req.session.user.id, 'UPDATE', 'Maintenance', `Rescheduled ${record.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: record.id,
        reference_code: record.transaction_code,
        field_name: 'scheduled_date',
        old_value: record.scheduled_date,
        new_value: req.body.scheduled_date
      });
      sendSuccess(res, null, 'Maintenance rescheduled');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async start(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (!['Approved', 'Scheduled'].includes(record.status)) {
        return sendError(res, 'Only approved or scheduled maintenance can be started', 400);
      }

      await MaintenanceModel.start(req.params.id, req.body);
      await logActivity(req.session.user.id, 'UPDATE', 'Maintenance', `Started ${record.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: record.id,
        reference_code: record.transaction_code,
        field_name: 'status',
        old_value: record.status,
        new_value: 'Ongoing'
      });
      if (record.requested_by) {
        await notifyUser(record.requested_by, {
          title: 'Maintenance Started',
          message: buildAssetNotificationMessage({
            action: 'Maintenance started',
            itemName: record.item_name,
            propertyTag: record.property_tag,
            detail: record.transaction_code
          }),
          type: 'maintenance_started',
          reference_id: record.id,
          link_url: maintenanceLink(record.id)
        }, actorExcludeOptions(req));
      }
      sendSuccess(res, null, 'Maintenance marked as ongoing');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async complete(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (!['Ongoing', 'In Progress', 'Scheduled', 'Approved'].includes(record.status)) {
        return sendError(res, 'This maintenance cannot be completed', 400);
      }

      await MaintenanceModel.complete(req.params.id, {
        completed_date: req.body.completed_date || new Date().toISOString().split('T')[0],
        performed_by: req.session.user.id,
        service_provider: req.body.service_provider || record.service_provider,
        cost: req.body.cost,
        completion_remarks: req.body.completion_remarks || req.body.description,
        next_maintenance_date: req.body.next_maintenance_date
      });

      await logActivity(req.session.user.id, 'COMPLETE', 'Maintenance', `Completed ${record.transaction_code}`, req.ip, {
        entity_type: 'maintenance_record',
        entity_id: record.id,
        reference_code: record.transaction_code,
        field_name: 'status',
        old_value: record.status,
        new_value: 'Completed'
      });
      if (record.requested_by) {
        await notifyUser(record.requested_by, {
          title: 'Maintenance Completed',
          message: buildAssetNotificationMessage({
            action: 'Maintenance completed',
            itemName: record.item_name,
            propertyTag: record.property_tag,
            detail: record.transaction_code
          }),
          type: 'maintenance_completed',
          reference_id: record.id,
          link_url: maintenanceLink(record.id)
        }, actorExcludeOptions(req));
      }

      sendSuccess(res, null, 'Maintenance marked as completed');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = MaintenanceController;
