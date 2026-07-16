const ComponentModel = require('../models/ComponentModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { canManageComponents, normalizeClassification, isFixedAsset, isSemiDurable } = require('../utils/assetClassification');
const { normalizeCondition, isValidCondition } = require('../utils/conditionOptions');
const { generateNextItemCode } = require('../utils/itemCodeGenerator');

function trimOrNull(value) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

function normalizeComponentBody(body = {}) {
  return {
    component_name: trimOrNull(body.component_name),
    asset_classification: normalizeClassification(body.asset_classification),
    brand: trimOrNull(body.brand),
    model: trimOrNull(body.model),
    serial_number: trimOrNull(body.serial_number),
    date_installed: trimOrNull(body.date_installed),
    condition: normalizeCondition(body.condition),
    remarks: trimOrNull(body.remarks)
  };
}

function resolveComponentClassification(value) {
  const classification = normalizeClassification(value);
  if (isFixedAsset(classification) || isSemiDurable(classification)) {
    return classification;
  }
  return null;
}

async function assertDurableParent(parentId) {
  const parent = await InventoryModel.findById(parentId);
  if (!parent || Number(parent.is_archived) === 1) {
    return { error: { status: 404, message: 'Parent asset not found' } };
  }
  if (!canManageComponents(parent.asset_classification)) {
    return {
      error: {
        status: 400,
        message: 'Components management is only available for Durable assets'
      }
    };
  }
  return { parent };
}

/**
 * Create an inventory record linked to the Durable parent.
 * Classification is chosen by the user (Durable or Semi-Durable).
 * Components get their own property tag but do NOT generate a PAR while linked to a parent.
 */
async function createComponentInventoryItem(parent, fields, conn = null) {
  const classification = resolveComponentClassification(fields.asset_classification);
  if (!classification) {
    throw new Error('Classification must be Durable or Semi-Durable');
  }

  const itemCode = await generateNextItemCode(parent.department_id, conn || undefined);
  const result = await InventoryModel.create({
    item_code: itemCode,
    item_name: fields.component_name,
    description: fields.remarks || `Component of ${parent.item_name || parent.item_code}`,
    department_id: parent.department_id,
    asset_classification: classification,
    material: parent.material || null,
    serial_number: fields.serial_number || null,
    custodian_id: parent.custodian_id || null,
    parent_asset_id: parent.id,
    brand: fields.brand || null,
    model: fields.model || null,
    supplier_id: parent.supplier_id || null,
    acquisition_date: fields.date_installed || null,
    condition: fields.condition || 'Good',
    location_id: parent.location_id || null,
    asset_count: 1
  });

  const inventoryId = result.first_id;
  if (!inventoryId) {
    throw new Error('Unable to create component inventory record');
  }

  return inventoryId;
}

const ComponentController = {
  async getByParent(req, res) {
    try {
      const parentId = parseInt(req.params.parentId, 10);
      const check = await assertDurableParent(parentId);
      if (check.error) return sendError(res, check.error.message, check.error.status);

      const [components, history] = await Promise.all([
        ComponentModel.getActiveByParent(parentId),
        ComponentModel.getHistoryByParent(parentId)
      ]);

      sendSuccess(res, {
        parent: {
          id: check.parent.id,
          item_name: check.parent.item_name,
          item_code: check.parent.item_code,
          property_tag: check.parent.property_tag,
          asset_classification: check.parent.asset_classification
        },
        components,
        history
      });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getAll(req, res) {
    try {
      const data = await ComponentModel.getAll();
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const parentId = parseInt(req.body.parent_asset_id, 10);
      if (!parentId) return sendError(res, 'Parent asset is required', 400);

      const check = await assertDurableParent(parentId);
      if (check.error) return sendError(res, check.error.message, check.error.status);

      const fields = normalizeComponentBody(req.body);
      if (!fields.component_name) {
        return sendError(res, 'Component name is required', 400);
      }
      if (!resolveComponentClassification(fields.asset_classification)) {
        return sendError(res, 'Classification must be Durable or Semi-Durable', 400);
      }
      if (!isValidCondition(fields.condition)) {
        return sendError(res, 'Invalid condition value', 400);
      }

      const inventoryItemId = await createComponentInventoryItem(check.parent, fields);

      const id = await ComponentModel.createComponent({
        ...fields,
        parent_asset_id: parentId,
        inventory_item_id: inventoryItemId,
        created_by: req.session.user.id
      });

      await logActivity(
        req.session.user.id,
        'CREATE',
        'Component',
        `Added component "${fields.component_name}" to ${check.parent.item_code}`,
        req.ip,
        {
          entity_type: 'inventory_item',
          entity_id: parentId,
          reference_code: check.parent.property_tag || check.parent.item_code
        }
      );

      const component = await ComponentModel.findComponentById(id);
      sendSuccess(res, component, 'Component added successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async replace(req, res) {
    try {
      const componentId = parseInt(req.params.id, 10);
      const existing = await ComponentModel.findComponentById(componentId);
      if (!existing) return sendError(res, 'Component not found', 404);
      if (existing.status !== 'Active') {
        return sendError(res, 'Only active components can be replaced', 400);
      }

      const check = await assertDurableParent(existing.parent_asset_id);
      if (check.error) return sendError(res, check.error.message, check.error.status);

      const fields = normalizeComponentBody(req.body);
      if (!fields.component_name) {
        return sendError(res, 'New component name is required', 400);
      }
      if (!resolveComponentClassification(fields.asset_classification)) {
        return sendError(res, 'Classification must be Durable or Semi-Durable', 400);
      }
      if (!isValidCondition(fields.condition)) {
        return sendError(res, 'Invalid condition value', 400);
      }

      const replacementDate = trimOrNull(req.body.replacement_date) || fields.date_installed
        || new Date().toISOString().slice(0, 10);
      const notes = trimOrNull(req.body.notes) || trimOrNull(req.body.remarks);

      const pool = require('../config/database');
      const connection = await pool.getConnection();
      let historyId = null;
      let newComponentId = null;
      let newInventoryItemId = null;

      try {
        await connection.beginTransaction();

        const marked = await ComponentModel.markReplaced(componentId, connection);
        if (!marked) {
          throw new Error('Component is no longer active');
        }

        // Detach old linked inventory so it is not orphaned under the parent
        if (existing.inventory_item_id) {
          await ComponentModel.detachInventoryItem(existing.inventory_item_id, connection);
        }

        await connection.commit();
      } catch (err) {
        await connection.rollback();
        throw err;
      } finally {
        connection.release();
      }

      // Create new inventory + component outside the replace txn
      // (InventoryModel.create manages its own connection/transaction)
      // No PAR is generated while the item remains a linked component.
      newInventoryItemId = await createComponentInventoryItem(check.parent, {
        ...fields,
        date_installed: fields.date_installed || replacementDate
      });

      const connection2 = await pool.getConnection();
      try {
        await connection2.beginTransaction();

        newComponentId = await ComponentModel.createComponent({
          ...fields,
          parent_asset_id: existing.parent_asset_id,
          inventory_item_id: newInventoryItemId,
          date_installed: fields.date_installed || replacementDate,
          created_by: req.session.user.id
        }, connection2);

        historyId = await ComponentModel.createReplacementHistory({
          parent_asset_id: existing.parent_asset_id,
          old_component_id: componentId,
          new_component_id: newComponentId,
          old_component_name: existing.component_name,
          new_inventory_item_id: newInventoryItemId,
          new_component_name: fields.component_name,
          replaced_by: req.session.user.id,
          replacement_date: replacementDate,
          notes
        }, connection2);

        await connection2.commit();
      } catch (err) {
        await connection2.rollback();
        throw err;
      } finally {
        connection2.release();
      }

      await logActivity(
        req.session.user.id,
        'REPLACE',
        'Component',
        `Replaced "${existing.component_name}" with "${fields.component_name}" on ${check.parent.item_code}`,
        req.ip,
        {
          entity_type: 'inventory_item',
          entity_id: existing.parent_asset_id,
          reference_code: check.parent.property_tag || check.parent.item_code,
          old_value: existing.component_name,
          new_value: fields.component_name
        }
      );

      const [history, components] = await Promise.all([
        ComponentModel.findReplacementById(historyId),
        ComponentModel.getActiveByParent(existing.parent_asset_id)
      ]);

      sendSuccess(res, {
        history,
        components,
        replaced_component_id: componentId,
        new_component_id: newComponentId,
        new_inventory_item_id: newInventoryItemId
      }, 'Component replaced successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = ComponentController;
