const CategoryModel = require('../models/CategoryModel');
const UserModel = require('../models/UserModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const {
  ASSET_CUSTODIAN_TYPES,
  normalizeAssetCustodianType,
  isValidAssetCustodianType
} = require('../utils/custodianTypeLabels');

function validateDepartmentCustodian(data) {
  const hasCustodian = Boolean(data.custodian_id);
  const normalizedType = normalizeAssetCustodianType(data.custodian_type);
  const hasType = Boolean(normalizedType);
  if (hasCustodian !== hasType) {
    return 'Both assigned custodian and custodian type are required when assigning a custodian';
  }
  if (normalizedType && !isValidAssetCustodianType(normalizedType)) {
    return 'Invalid custodian type';
  }
  return null;
}

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
      const custodianError = validateDepartmentCustodian(req.body);
      if (custodianError) return sendError(res, custodianError, 400);
      if (req.body.custodian_id) {
        const user = await UserModel.findById(req.body.custodian_id);
        if (!user || !user.is_active) return sendError(res, 'Assigned custodian not found or inactive', 400);
      }

      const payload = {
        ...req.body,
        custodian_type: normalizeAssetCustodianType(req.body.custodian_type)
      };
      const id = await CategoryModel.create(payload);
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

      const merged = {
        custodian_id: req.body.custodian_id !== undefined ? req.body.custodian_id : existing.custodian_id,
        custodian_type: normalizeAssetCustodianType(
          req.body.custodian_type !== undefined ? req.body.custodian_type : existing.custodian_type
        )
      };
      const custodianError = validateDepartmentCustodian(merged);
      if (custodianError) return sendError(res, custodianError, 400);
      if (merged.custodian_id) {
        const user = await UserModel.findById(merged.custodian_id);
        if (!user || !user.is_active) return sendError(res, 'Assigned custodian not found or inactive', 400);
      }

      const updated = await CategoryModel.update(req.params.id, {
        ...req.body,
        custodian_type: merged.custodian_type
      });
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
