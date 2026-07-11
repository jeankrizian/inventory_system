const InventoryModel = require('../models/InventoryModel');
const { generateNextItemCode } = require('../utils/itemCodeGenerator');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity, logActivityWithChanges, collectChanges } = require('../utils/activityLogger');
const { notifyPropertyManagers, actorExcludeOptions } = require('../utils/notificationService');
const { buildAssetNotificationMessage } = require('../utils/assetNotificationHelper');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');
const {
  sanitizeInventoryByClassification,
  validateInventoryClassification,
  validateBulkAssetCreate,
  getAssetCreateCount,
  isFixedAsset,
  normalizeClassification,
  validateConsumableFilter,
  isConsumableEditBlocked,
  shouldExcludeConsumableFromLists,
  CONSUMABLE_DISABLED_MESSAGE
} = require('../utils/assetClassification');
const { normalizeMaterial, isValidMaterial } = require('../utils/materialOptions');
const { normalizeCondition, isValidCondition } = require('../utils/conditionOptions');
const { hasManualStatusInput } = require('../utils/inventoryStatusService');
const DocumentService = require('../utils/documentService');

function isSemiDurableClassification(value) {
  return normalizeClassification(value) === 'Semi-Durable';
}
const { getInventoryTimeline } = require('../utils/inventoryTimelineService');
function normalizeItemBody(body) {
  const data = { ...body };
  if (data.category_id && !data.department_id) data.department_id = data.category_id;
  if (Object.prototype.hasOwnProperty.call(data, 'material')) {
    data.material = normalizeMaterial(data.material);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'condition')) {
    data.condition = normalizeCondition(data.condition);
  }
  if (Object.prototype.hasOwnProperty.call(data, 'serial_number')) {
    const serial = data.serial_number != null ? String(data.serial_number).trim() : '';
    data.serial_number = serial || null;
  }
  delete data.status;
  delete data.available_quantity;
  delete data.unit;
  delete data.acquisition_cost;
  delete data.low_stock_threshold;
  delete data.property_tag;
  delete data.starting_property_tag;
  delete data.batch_id;
  delete data.purchase_date;
  return data;
}

function normalizePurchaseFields(body) {
  const data = { ...body };

  if (data.unit_cost === '' || data.unit_cost === undefined) {
    data.unit_cost = null;
  } else if (data.unit_cost != null) {
    const unitCost = parseFloat(data.unit_cost);
    data.unit_cost = Number.isNaN(unitCost) ? null : unitCost;
  }

  delete data.acquisition_cost;
  delete data.unit;
  delete data.low_stock_threshold;

  return data;
}

function toDocumentMeta(doc, documentType) {
  if (!doc) return null;
  return {
    id: doc.id,
    document_number: doc.document_number,
    document_type: documentType || doc.document_type
  };
}

function hasCustodianAssignmentChanged(before, after) {
  return (before.custodian_id ?? null) != (after.custodian_id ?? null);
}

function hasDepartmentAssignmentChanged(before, after) {
  return (before.department_id ?? null) != (after.department_id ?? null);
}

function isDuplicateItemCodeError(err) {
  const message = `${err.message || ''} ${err.sqlMessage || ''}`;
  return err.code === 'ER_DUP_ENTRY' && message.includes('item_code');
}

function isDuplicatePropertyTagError(err) {
  const message = `${err.message || ''} ${err.sqlMessage || ''}`;
  return err.code === 'ER_DUP_ENTRY' && message.includes('property_tag');
}

function isDuplicateSerialNumberError(err) {
  const message = `${err.message || ''} ${err.sqlMessage || ''}`;
  return err.code === 'ER_DUP_ENTRY' && message.includes('serial_number');
}

function rejectManualStatusInput(req, res) {
  if (hasManualStatusInput(req.body)) {
    sendError(res, 'Inventory status is workflow-managed and cannot be set manually', 400);
    return true;
  }
  return false;
}

const InventoryController = {
  async getAll(req, res) {
    try {
      const classificationFilter = req.query.asset_classification;
      const filterError = validateConsumableFilter(classificationFilter);
      if (filterError) return sendError(res, filterError, 400);

      const scope = getAccessScope(req.session.user);
      const requestedDepartmentId = parseInt(req.query.department_id || req.query.category_id, 10) || null;
      let department_scope_mismatch = false;
      if (
        scope.type === 'department'
        && scope.departmentId
        && requestedDepartmentId
        && requestedDepartmentId !== scope.departmentId
      ) {
        department_scope_mismatch = true;
      }

      const filters = {
        search: req.query.search,
        department_id: department_scope_mismatch ? undefined : (req.query.department_id || req.query.category_id),
        asset_classification: classificationFilter,
        status: req.query.status,
        location_id: req.query.location_id,
        parent_asset_id: req.query.parent_asset_id,
        exclude_consumable: shouldExcludeConsumableFromLists(),
        department_scope_mismatch,
        scope
      };

      const items = await InventoryModel.getAll(filters);
      sendSuccess(res, items);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      sendSuccess(res, item);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getNextCode(req, res) {
    try {
      const departmentId = parseInt(req.query.department_id || req.query.category_id, 10);
      if (!departmentId) {
        return sendError(res, 'Department is required', 400);
      }

      const itemCode = await InventoryModel.getNextItemCode(departmentId);
      sendSuccess(res, { item_code: itemCode });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      if (rejectManualStatusInput(req, res)) return;

      const normalized = normalizePurchaseFields(normalizeItemBody(req.body));
      const validation = validateBulkAssetCreate(normalized, { existingClassification: null });
      if (!validation.valid) return sendError(res, validation.message, 400);
      if (!isValidMaterial(normalized.material)) {
        return sendError(res, 'Invalid material value', 400);
      }
      if (!isValidCondition(normalized.condition)) {
        return sendError(res, 'Invalid condition value', 400);
      }

      const body = sanitizeInventoryByClassification(normalized);
      body.asset_count = validation.asset_count;

      if (!body.department_id) {
        return sendError(res, 'Department is required', 400);
      }

      delete body.item_code;

      let result = null;
      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        body.item_code = await generateNextItemCode(body.department_id);

        try {
          result = await InventoryModel.create(body);
          break;
        } catch (err) {
          if (isDuplicatePropertyTagError(err) && attempt < maxAttempts - 1) {
            continue;
          }
          if (isDuplicatePropertyTagError(err)) {
            return sendError(res, err.message || 'Property tag already exists', 400);
          }
          if (isDuplicateSerialNumberError(err)) {
            return sendError(res, 'Serial number already exists', 400);
          }
          if (isDuplicateItemCodeError(err) && attempt < maxAttempts - 1) {
            continue;
          }
          throw err;
        }
      }

      if (!result?.first_id) {
        return sendError(res, 'Unable to create inventory assets', 500);
      }

      const id = result.first_id;
      await logActivity(
        req.session.user.id,
        'CREATE',
        'Inventory',
        `Added ${result.created_count} asset(s) with model code ${result.item_code}`,
        req.ip,
        {
          entity_type: 'inventory_item',
          entity_id: id,
          reference_code: result.item_code
        }
      );
      const item = await InventoryModel.findById(id);

      await notifyPropertyManagers({
        title: 'New Inventory Item',
        message: buildAssetNotificationMessage({
          action: 'Inventory item added',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: result.created_count > 1 ? `${result.created_count} assets created (${result.item_code})` : `Model ${result.item_code}`
        }),
        type: 'inventory_added',
        reference_id: id,
        link_url: '/pages/inventory.html'
      }, actorExcludeOptions(req));

      let generatedDocument = null;
      let custodianPar = null;
      try {
        const doc = await DocumentService.generateGRN(id, req.session.user.id);
        generatedDocument = toDocumentMeta(doc, 'GRN');
      } catch (docErr) {
        console.error('GRN generation failed:', docErr.message);
      }

      try {
        const par = await DocumentService.generatePARForCustodianAssignment(id, req.session.user.id);
        custodianPar = toDocumentMeta(par, 'PAR');
      } catch (docErr) {
        console.error('PAR generation failed:', docErr.message);
      }

      let semiDurableSal = null;
      if (isSemiDurableClassification(item.asset_classification) && item.department_id) {
        try {
          const sal = await DocumentService.generateSALForSemiDurableIssuance(id, req.session.user.id);
          semiDurableSal = toDocumentMeta(sal, 'SAL');
        } catch (docErr) {
          console.error('SAL generation failed:', docErr.message);
        }
      }

      const message = result.created_count > 1
        ? `${result.created_count} assets created successfully`
        : 'Item created successfully';

      sendSuccess(res, {
        ...item,
        created_count: result.created_count,
        created_ids: result.ids,
        item_code: result.item_code,
        batch_id: result.batch_id,
        generated_document: generatedDocument,
        custodian_par: custodianPar,
        semi_durable_sal: semiDurableSal
      }, message, 201);
    } catch (err) {
      if (isDuplicatePropertyTagError(err)) {
        return sendError(res, 'Property tag already exists', 400);
      }
      if (isDuplicateSerialNumberError(err)) {
        return sendError(res, 'Serial number already exists', 400);
      }
      if (/serial number already exists/i.test(err.message || '')) {
        return sendError(res, err.message, 400);
      }
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      if (rejectManualStatusInput(req, res)) return;

      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      if (isConsumableEditBlocked(item.asset_classification)) {
        return sendError(res, CONSUMABLE_DISABLED_MESSAGE, 400);
      }

      const normalized = normalizePurchaseFields(normalizeItemBody(req.body));
      const forValidation = {
        ...normalized,
        asset_classification: normalized.asset_classification ?? item.asset_classification,
        material: normalized.material !== undefined ? normalized.material : item.material,
        property_tag: normalized.property_tag ?? item.property_tag,
        custodian_id: normalized.custodian_id ?? item.custodian_id
      };
      const validation = validateInventoryClassification(forValidation, {
        existingClassification: item.asset_classification
      });
      if (!validation.valid) return sendError(res, validation.message, 400);
      if (!isValidMaterial(forValidation.material)) {
        return sendError(res, 'Invalid material value', 400);
      }
      if (!isValidCondition(forValidation.condition)) {
        return sendError(res, 'Invalid condition value', 400);
      }

      const body = sanitizeInventoryByClassification(forValidation);
      delete body.item_code;
      delete body.quantity;
      delete body.asset_count;
      delete body.unit;
      delete body.acquisition_cost;
      delete body.low_stock_threshold;
      delete body.property_tag;
      delete body.batch_id;

      await InventoryModel.update(req.params.id, body);
      const updated = await InventoryModel.findById(req.params.id);
      const inventoryFields = [
        'item_name', 'department_id', 'location_id', 'custodian_id', 'asset_classification',
        'serial_number', 'material', 'supplier_id', 'acquisition_date', 'unit_cost',
        'description', 'condition', 'next_maintenance_date', 'status'
      ];
      await logActivityWithChanges(
        req.session.user.id,
        'UPDATE',
        'Inventory',
        `Updated item ${item.item_code}`,
        req.ip,
        'inventory_item',
        updated.id,
        updated.item_code,
        collectChanges(item, updated, inventoryFields)
      );

      await notifyPropertyManagers({
        title: 'Inventory Updated',
        message: buildAssetNotificationMessage({
          action: 'Inventory item updated',
          itemName: updated.item_name,
          propertyTag: updated.property_tag,
          detail: `Model ${updated.item_code}`
        }),
        type: 'inventory_updated',
        reference_id: updated.id,
        link_url: '/pages/inventory.html'
      }, actorExcludeOptions(req));

      try {
        await DocumentService.refreshGRN(updated.id, req.session.user.id);
      } catch (docErr) {
        console.error('GRN refresh failed:', docErr.message);
      }

      let custodianPar = null;
      if (
        isFixedAsset(updated.asset_classification) &&
        updated.custodian_id &&
        hasCustodianAssignmentChanged(item, updated)
      ) {
        try {
          const par = await DocumentService.refreshPARForCustodianAssignment(updated.id, req.session.user.id);
          custodianPar = toDocumentMeta(par, 'PAR');
        } catch (docErr) {
          console.error('PAR refresh failed:', docErr.message);
        }
      }

      let semiDurableSal = null;
      if (
        isSemiDurableClassification(updated.asset_classification) &&
        updated.department_id &&
        hasDepartmentAssignmentChanged(item, updated)
      ) {
        try {
          const sal = await DocumentService.refreshSALForSemiDurableIssuance(updated.id, req.session.user.id);
          semiDurableSal = toDocumentMeta(sal, 'SAL');
        } catch (docErr) {
          console.error('SAL refresh failed:', docErr.message);
        }
      }

      sendSuccess(res, { ...updated, custodian_par: custodianPar, semi_durable_sal: semiDurableSal }, 'Item updated successfully');
    } catch (err) {
      if (isDuplicatePropertyTagError(err)) {
        return sendError(res, 'Property tag already exists', 400);
      }
      if (isDuplicateSerialNumberError(err)) {
        return sendError(res, 'Serial number already exists', 400);
      }
      if (/serial number already exists/i.test(err.message || '')) {
        return sendError(res, err.message, 400);
      }
      sendError(res, err.message, 500);
    }
  },

  async getTimeline(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      const timeline = await getInventoryTimeline(item);
      sendSuccess(res, timeline);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      const archived = await InventoryModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Item could not be archived', 400);

      await logActivity(req.session.user.id, 'ARCHIVE', 'Inventory', `Archived item ${item.item_code}`, req.ip, {
        entity_type: 'inventory_item',
        entity_id: item.id,
        reference_code: item.item_code,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true'
      });

      await notifyPropertyManagers({
        title: 'Inventory Archived',
        message: buildAssetNotificationMessage({
          action: 'Inventory item archived',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: `Model ${item.item_code}`
        }),
        type: 'inventory_archived',
        reference_id: item.id,
        link_url: '/pages/archive.html'
      }, actorExcludeOptions(req));

      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = InventoryController;
