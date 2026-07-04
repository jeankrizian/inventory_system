const MaintenanceModel = require('../models/MaintenanceModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyUser } = require('../utils/notificationService');
const { canMaintain } = require('../utils/assetClassification');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');

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
        return sendError(res, 'Maintenance is only available for Non-Consumable (Fixed Asset) items', 400);
      }
      if (!req.body.scheduled_date) return sendError(res, 'Scheduled maintenance date is required', 400);
      if (!req.body.reported_problem && !req.body.description) {
        return sendError(res, 'Reported problem is required', 400);
      }

      const result = await MaintenanceModel.create({
        ...req.body,
        requested_by: req.session.user.id
      });

      await logActivity(req.session.user.id, 'CREATE', 'Maintenance', `Maintenance request ${result.transaction_code}`, req.ip);
      await notifyPropertyManagers({
        title: 'New Maintenance Request',
        message: `New maintenance request ${result.transaction_code} for ${item.item_name}.`,
        type: 'maintenance_request',
        reference_id: result.id,
        link_url: '/pages/maintenance-requests.html'
      });

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
      if (schedDate) {
        await MaintenanceModel.reschedule(req.params.id, {
          scheduled_date: schedDate,
          technician: req.body.technician,
          admin_remarks: req.body.admin_remarks
        });
      }

      await logActivity(req.session.user.id, 'APPROVE', 'Maintenance', `Approved ${record.transaction_code}`, req.ip);
      await notifyUser(record.requested_by, {
        title: 'Maintenance Approved',
        message: `Your maintenance request ${record.transaction_code} has been approved.`,
        type: 'maintenance_approved',
        reference_id: record.id,
        link_url: '/pages/maintenance-requests.html'
      });

      sendSuccess(res, null, 'Maintenance request approved');
    } catch (err) { sendError(res, err.message, 500); }
  },

  async reject(req, res) {
    try {
      const record = await getScopedRecord(req, res);
      if (!record) return;
      if (record.status !== 'Pending') return sendError(res, 'Only pending requests can be rejected', 400);

      await MaintenanceModel.reject(req.params.id, req.session.user.id, req.body.rejection_reason || req.body.reason);
      await logActivity(req.session.user.id, 'REJECT', 'Maintenance', `Rejected ${record.transaction_code}`, req.ip);
      await notifyUser(record.requested_by, {
        title: 'Maintenance Rejected',
        message: `Your maintenance request ${record.transaction_code} has been rejected.${req.body.rejection_reason ? ` Reason: ${req.body.rejection_reason}` : ''}`,
        type: 'maintenance_rejected',
        reference_id: record.id,
        link_url: '/pages/maintenance-requests.html'
      });

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
      await logActivity(req.session.user.id, 'UPDATE', 'Maintenance', `Rescheduled ${record.transaction_code}`, req.ip);
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
      await logActivity(req.session.user.id, 'UPDATE', 'Maintenance', `Started ${record.transaction_code}`, req.ip);
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

      if (req.body.next_maintenance_date) {
        await InventoryModel.update(record.inventory_item_id, {
          next_maintenance_date: req.body.next_maintenance_date,
          maintenance_status: 'Completed'
        });
      }

      await logActivity(req.session.user.id, 'COMPLETE', 'Maintenance', `Completed ${record.transaction_code}`, req.ip);
      if (record.requested_by) {
        await notifyUser(record.requested_by, {
          title: 'Maintenance Completed',
          message: `Maintenance ${record.transaction_code} for ${record.item_name} has been completed.`,
          type: 'maintenance_completed',
          reference_id: record.id,
          link_url: '/pages/maintenance-requests.html'
        });
      }

      sendSuccess(res, null, 'Maintenance marked as completed');
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = MaintenanceController;
