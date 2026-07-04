const SupplierModel = require('../models/SupplierModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers } = require('../utils/notificationService');

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
      const id = await SupplierModel.create(req.body);
      await logActivity(req.session.user.id, 'CREATE', 'Supplier', `Added supplier ${req.body.name}`, req.ip);
      const supplier = await SupplierModel.findById(id);

      await notifyPropertyManagers({
        title: 'Supplier Added',
        message: `A new supplier has been added: ${supplier.name}.`,
        type: 'supplier_added',
        reference_id: id,
        link_url: '/pages/suppliers.html'
      });

      sendSuccess(res, supplier, 'Supplier created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const updated = await SupplierModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Supplier not found', 404);
      await logActivity(req.session.user.id, 'UPDATE', 'Supplier', `Updated supplier ${req.body.name}`, req.ip);
      const supplier = await SupplierModel.findById(req.params.id);

      await notifyPropertyManagers({
        title: 'Supplier Updated',
        message: `Supplier ${supplier.name} has been updated.`,
        type: 'supplier_updated',
        reference_id: supplier.id,
        link_url: '/pages/suppliers.html'
      });

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
      await logActivity(req.session.user.id, 'ARCHIVE', 'Supplier', `Archived supplier ${supplier.name}`, req.ip);
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = SupplierController;
