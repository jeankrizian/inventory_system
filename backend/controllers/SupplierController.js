const SupplierModel = require('../models/SupplierModel');
const { sendSuccess, sendError } = require('../utils/response');
const { ArchiveBlockedError } = require('../utils/archiveIntegrityService');
const { logActivity, logActivityWithChanges, collectChanges } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');
const { buildGovernanceNotificationMessage } = require('../utils/assetNotificationHelper');

const SupplierController = {
  async getAll(req, res) {
    try {
      const suppliers = await SupplierModel.getAll();
      sendSuccess(res, suppliers);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const supplier = await SupplierModel.findById(req.params.id);
      if (!supplier) return sendError(res, 'Supplier not found', 404);
      sendSuccess(res, supplier);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const name = (req.body.name || '').trim();
      if (!name) return sendError(res, 'Supplier name is required', 400);

      const id = await SupplierModel.create({
        ...req.body,
        name
      });
      const supplier = await SupplierModel.findById(id);
      await logActivity(req.session.user.id, 'CREATE', 'Supplier', `Added supplier ${supplier.name}`, req.ip, {
        entity_type: 'supplier',
        entity_id: id,
        reference_code: supplier.name
      });

      await notifyAdministrators({
        title: 'Supplier Added',
        message: buildGovernanceNotificationMessage({
          action: 'Supplier created',
          subject: supplier.name
        }),
        type: 'supplier_added',
        reference_id: id,
        link_url: '/pages/suppliers.html'
      }, { excludeUserIds: [req.session.user.id] });

      sendSuccess(res, supplier, 'Supplier created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const before = await SupplierModel.findById(req.params.id);
      if (!before) return sendError(res, 'Supplier not found', 404);

      const name = (req.body.name || '').trim();
      if (!name) return sendError(res, 'Supplier name is required', 400);

      const updated = await SupplierModel.update(req.params.id, {
        ...req.body,
        name
      });
      if (!updated) return sendError(res, 'Supplier not found', 404);
      const supplier = await SupplierModel.findById(req.params.id);
      await logActivityWithChanges(
        req.session.user.id,
        'UPDATE',
        'Supplier',
        `Updated supplier ${supplier.name}`,
        req.ip,
        'supplier',
        supplier.id,
        supplier.name,
        collectChanges(before, supplier, ['name', 'contact_person', 'email', 'phone', 'address'])
      );

      await notifyAdministrators({
        title: 'Supplier Updated',
        message: buildGovernanceNotificationMessage({
          action: 'Supplier updated',
          subject: supplier.name
        }),
        type: 'supplier_updated',
        reference_id: supplier.id,
        link_url: '/pages/suppliers.html'
      }, { excludeUserIds: [req.session.user.id] });

      sendSuccess(res, supplier, 'Supplier updated successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const supplier = await SupplierModel.findById(req.params.id);
      if (!supplier) return sendError(res, 'Supplier not found', 404);
      const archived = await SupplierModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Supplier could not be archived', 400);
      await logActivity(req.session.user.id, 'ARCHIVE', 'Supplier', `Archived supplier ${supplier.name}`, req.ip, {
        entity_type: 'supplier',
        entity_id: supplier.id,
        reference_code: supplier.name,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true'
      });
      await notifyAdministrators({
        title: 'Supplier Archived',
        message: buildGovernanceNotificationMessage({
          action: 'Supplier archived',
          subject: supplier.name
        }),
        type: 'supplier_archived',
        reference_id: supplier.id,
        link_url: '/pages/archive.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      if (err instanceof ArchiveBlockedError) return sendError(res, err.message, 400);
      sendError(res, err.message, 500);
    }
  }
};

module.exports = SupplierController;
