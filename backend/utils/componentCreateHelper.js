/**
 * Shared component create helpers used by Add Component and import features.
 * INSERT-only path — does not update/replace/delete existing components.
 */
const ComponentModel = require('../models/ComponentModel');
const InventoryModel = require('../models/InventoryModel');
const { logActivity } = require('./activityLogger');
const { canManageComponents, normalizeClassification, isFixedAsset, isSemiDurable } = require('./assetClassification');
const { normalizeCondition } = require('./conditionOptions');
const { generateNextItemCode } = require('./itemCodeGenerator');

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

async function createComponentForParent(parent, fields, options = {}) {
  const userId = options.userId || null;
  const inventoryItemId = await createComponentInventoryItem(parent, fields);

  const id = await ComponentModel.createComponent({
    ...fields,
    parent_asset_id: parent.id,
    inventory_item_id: inventoryItemId,
    created_by: userId
  });

  if (options.log && userId) {
    await logActivity(
      userId,
      'CREATE',
      'Component',
      `Added component "${fields.component_name}" to ${parent.item_code}`,
      options.ip || null,
      {
        entity_type: 'inventory_item',
        entity_id: parent.id,
        reference_code: parent.property_tag || parent.item_code
      }
    );
  }

  const component = await ComponentModel.findComponentById(id);
  return { id, inventoryItemId, component };
}

module.exports = {
  trimOrNull,
  normalizeComponentBody,
  resolveComponentClassification,
  assertDurableParent,
  createComponentInventoryItem,
  createComponentForParent
};
