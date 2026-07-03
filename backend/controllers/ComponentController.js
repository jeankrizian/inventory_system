const ComponentModel = require('../models/ComponentModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { isFixedAsset } = require('../utils/assetClassification');

const ComponentController = {
  async getByParent(req, res) {
    try {
      const data = await ComponentModel.getByParent(req.params.parentId);
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getAll(req, res) {
    try {
      const data = await ComponentModel.getAll();
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async create(req, res) {
    try {
      const parent = await InventoryModel.findById(req.body.parent_asset_id);
      if (!parent) return sendError(res, 'Parent asset not found', 404);
      if (!isFixedAsset(parent.asset_classification)) {
        return sendError(res, 'Component replacement is only allowed on Non-Consumable (Fixed Asset) items', 400);
      }
      if (!req.body.old_component_name?.trim()) {
        return sendError(res, 'Old component name is required', 400);
      }
      if (!req.body.replacement_date) {
        return sendError(res, 'Replacement date is required', 400);
      }

      const newItemId = req.body.new_inventory_item_id || null;
      if (newItemId) {
        const newItem = await InventoryModel.findById(newItemId);
        if (!newItem) return sendError(res, 'Replacement part not found in inventory', 404);
        if (newItem.id === parent.id) {
          return sendError(res, 'Replacement part cannot be the parent asset', 400);
        }
        if (isFixedAsset(newItem.asset_classification)) {
          return sendError(res, 'Fixed assets cannot be installed as replacement components', 400);
        }
      }

      const id = await ComponentModel.create({
        ...req.body,
        old_component_name: req.body.old_component_name.trim(),
        replaced_by: req.session.user.id
      });

      if (newItemId) {
        await InventoryModel.update(newItemId, {
          parent_asset_id: parent.id
        });
      }

      await logActivity(
        req.session.user.id,
        'REPLACE',
        'Component',
        `Replaced ${req.body.old_component_name.trim()} on ${parent.item_code}`,
        req.ip
      );

      const record = await ComponentModel.findById(id);
      sendSuccess(res, record, 'Component replacement recorded', 201);
    } catch (err) { sendError(res, err.message, 500); }
  }
};

module.exports = ComponentController;
