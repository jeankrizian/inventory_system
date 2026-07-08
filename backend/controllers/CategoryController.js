const CategoryModel = require('../models/CategoryModel');
const UserModel = require('../models/UserModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');

const CategoryController = {
  async getAll(req, res) {
    try {
      const categories = await CategoryModel.getAll();
      sendSuccess(res, categories);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const category = await CategoryModel.findById(req.params.id);
      if (!category) return sendError(res, 'Category not found', 404);
      sendSuccess(res, category);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      if (req.body.custodian_id) {
        const user = await UserModel.findById(req.body.custodian_id);
        if (!user || !user.is_active) return sendError(res, 'Assigned custodian not found or inactive', 400);
      }

      const id = await CategoryModel.create(req.body);
      await logActivity(req.session.user.id, 'CREATE', 'Category', `Added category ${req.body.name}`, req.ip);
      const category = await CategoryModel.findById(id);
      sendSuccess(res, category, 'Category created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Category name already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await CategoryModel.findById(req.params.id);
      if (!existing) return sendError(res, 'Category not found', 404);

      const custodianId = req.body.custodian_id !== undefined ? req.body.custodian_id : existing.custodian_id;
      if (custodianId) {
        const user = await UserModel.findById(custodianId);
        if (!user || !user.is_active) return sendError(res, 'Assigned custodian not found or inactive', 400);
      }

      const updated = await CategoryModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Category not found', 404);
      await logActivity(req.session.user.id, 'UPDATE', 'Category', `Updated category ${req.body.name}`, req.ip);
      const category = await CategoryModel.findById(req.params.id);
      sendSuccess(res, category, 'Category updated successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Category name already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const category = await CategoryModel.findById(req.params.id);
      if (!category) return sendError(res, 'Category not found', 404);
      const archived = await CategoryModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Category could not be archived', 400);
      await logActivity(req.session.user.id, 'ARCHIVE', 'Category', `Archived category ${category.name}`, req.ip);
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = CategoryController;
