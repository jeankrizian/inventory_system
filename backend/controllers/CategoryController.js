const CategoryModel = require('../models/CategoryModel');
const UserModel = require('../models/UserModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity, logActivityWithChanges, collectChanges } = require('../utils/activityLogger');

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
      if (!category) return sendError(res, 'Department not found', 404);
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
      const category = await CategoryModel.findById(id);
      await logActivity(req.session.user.id, 'CREATE', 'Department', `Added department ${category.name}`, req.ip, {
        entity_type: 'department',
        entity_id: id,
        reference_code: category.code || category.name
      });
      sendSuccess(res, category, 'Department created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') {
        return sendError(
          res,
          err.message?.includes('code')
            ? 'Department code already exists'
            : 'Department name or code already exists',
          400
        );
      }
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const existing = await CategoryModel.findById(req.params.id);
      if (!existing) return sendError(res, 'Department not found', 404);

      const custodianId = req.body.custodian_id !== undefined ? req.body.custodian_id : existing.custodian_id;
      if (custodianId) {
        const user = await UserModel.findById(custodianId);
        if (!user || !user.is_active) return sendError(res, 'Assigned custodian not found or inactive', 400);
      }

      const updated = await CategoryModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Department not found', 404);
      const category = await CategoryModel.findById(req.params.id);
      await logActivityWithChanges(
        req.session.user.id,
        'UPDATE',
        'Department',
        `Updated department ${category.name}`,
        req.ip,
        'department',
        category.id,
        category.code || category.name,
        collectChanges(existing, category, [
          'name', 'code', 'status', 'custodian_id', 'department_head', 'description'
        ])
      );
      sendSuccess(res, category, 'Department updated successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Department name or code already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const category = await CategoryModel.findById(req.params.id);
      if (!category) return sendError(res, 'Department not found', 404);
      const archived = await CategoryModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Department could not be archived', 400);
      await logActivity(req.session.user.id, 'ARCHIVE', 'Department', `Archived department ${category.name}`, req.ip, {
        entity_type: 'department',
        entity_id: category.id,
        reference_code: category.code || category.name,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true'
      });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = CategoryController;
