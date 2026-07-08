const InventoryModel = require('../models/InventoryModel');
const { generateNextItemCode } = require('../utils/itemCodeGenerator');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyPropertyManagers, notifyCustodiansForItem } = require('../utils/notificationService');
const { inventoryLink } = require('../utils/notificationLinks');
const { getAccessScope, itemMatchesScope } = require('../utils/roleHelpers');
const {
  sanitizeInventoryByClassification,
  validateInventoryClassification,
  isFixedAsset,
  normalizeClassification,
  validateConsumableFilter,
  isConsumableEditBlocked,
  shouldExcludeConsumableFromLists,
  CONSUMABLE_DISABLED_MESSAGE
} = require('../utils/assetClassification');
const { normalizeMaterial, isValidMaterial } = require('../utils/materialOptions');

function isSemiDurableClassification(value) {
  return normalizeClassification(value) === 'Semi-Durable';
}
const DocumentService = require('../utils/documentService');
function normalizeItemBody(body) {
  const data = { ...body };
  if (data.category_id && !data.department_id) data.department_id = data.category_id;
  if (Object.prototype.hasOwnProperty.call(data, 'material')) {
    data.material = normalizeMaterial(data.material);
  }
  return data;
}

function normalizePurchaseFields(body) {
  const data = { ...body };
  const qty = parseInt(data.quantity, 10);
  const quantity = Number.isNaN(qty) ? 1 : qty;

  if (data.unit_cost === '' || data.unit_cost === undefined) {
    data.unit_cost = null;
  } else if (data.unit_cost != null) {
    const unitCost = parseFloat(data.unit_cost);
    data.unit_cost = Number.isNaN(unitCost) ? null : unitCost;
  }

  if (data.acquisition_cost === '' || data.acquisition_cost === undefined) {
    data.acquisition_cost = null;
  } else if (data.acquisition_cost != null) {
    const acquisitionCost = parseFloat(data.acquisition_cost);
    data.acquisition_cost = Number.isNaN(acquisitionCost) ? null : acquisitionCost;
  }

  if (data.unit_cost != null && data.acquisition_cost == null) {
    data.acquisition_cost = parseFloat((data.unit_cost * quantity).toFixed(2));
  }

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

async function notifyLowStockIfNeeded(item) {
  if (item && item.available_quantity <= item.low_stock_threshold) {
    const payload = {
      title: 'Low Stock Alert',
      message: `${item.item_name} (${item.item_code}) is now low in stock (${item.available_quantity} remaining).`,
      type: 'low_stock',
      reference_id: item.id,
      link_url: inventoryLink(item.id, 'low_stock=true'),
      skipDuplicate: true
    };
    await notifyPropertyManagers(payload);
    await notifyCustodiansForItem(item, payload);
  }
}

const InventoryController = {
  async getAll(req, res) {
    try {
      const classificationFilter = req.query.asset_classification;
      const filterError = validateConsumableFilter(classificationFilter);
      if (filterError) return sendError(res, filterError, 400);

      const scope = getAccessScope(req.session.user);
      const filters = {
        search: req.query.search,
        department_id: req.query.department_id || req.query.category_id,
        asset_classification: classificationFilter,
        status: req.query.status,
        location_id: req.query.location_id,
        parent_asset_id: req.query.parent_asset_id,
        low_stock: req.query.low_stock === 'true',
        exclude_consumable: shouldExcludeConsumableFromLists(),
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
      const normalized = normalizePurchaseFields(normalizeItemBody(req.body));
      const validation = validateInventoryClassification(normalized, { existingClassification: null });
      if (!validation.valid) return sendError(res, validation.message, 400);
      if (!isValidMaterial(normalized.material)) {
        return sendError(res, 'Invalid material value', 400);
      }

      const body = sanitizeInventoryByClassification(normalized);

      if (!body.department_id) {
        return sendError(res, 'Department is required', 400);
      }

      delete body.item_code;

      let itemCode = null;
      let id = null;
      const maxAttempts = 5;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        itemCode = await generateNextItemCode(body.department_id);
        body.item_code = itemCode;

        try {
          id = await InventoryModel.create(body);
          break;
        } catch (err) {
          if (isDuplicatePropertyTagError(err)) {
            return sendError(res, 'Property tag already exists', 400);
          }
          if (isDuplicateItemCodeError(err) && attempt < maxAttempts - 1) {
            continue;
          }
          throw err;
        }
      }

      if (!id) {
        return sendError(res, 'Unable to generate a unique item code', 500);
      }
      await logActivity(req.session.user.id, 'CREATE', 'Inventory', `Added item ${body.item_code}`, req.ip);
      const item = await InventoryModel.findById(id);

      await notifyPropertyManagers({
        title: 'New Inventory Item',
        message: `A new inventory item has been added: ${item.item_name} (${item.item_code}).`,
        type: 'inventory_added',
        reference_id: id,
        link_url: '/pages/inventory.html'
      });
      await notifyLowStockIfNeeded(item);

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

      sendSuccess(res, { ...item, generated_document: generatedDocument, custodian_par: custodianPar, semi_durable_sal: semiDurableSal }, 'Item created successfully', 201);
    } catch (err) {
      if (isDuplicatePropertyTagError(err)) {
        return sendError(res, 'Property tag already exists', 400);
      }
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
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

      const body = sanitizeInventoryByClassification(forValidation);
      delete body.item_code;

      await InventoryModel.update(req.params.id, body);
      await logActivity(req.session.user.id, 'UPDATE', 'Inventory', `Updated item ${item.item_code}`, req.ip);
      const updated = await InventoryModel.findById(req.params.id);

      await notifyPropertyManagers({
        title: 'Inventory Updated',
        message: `Inventory item ${updated.item_name} (${updated.item_code}) has been updated.`,
        type: 'inventory_updated',
        reference_id: updated.id,
        link_url: '/pages/inventory.html'
      });
      await notifyLowStockIfNeeded(updated);

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
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      const archived = await InventoryModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Item could not be archived', 400);

      await logActivity(req.session.user.id, 'ARCHIVE', 'Inventory', `Archived item ${item.item_code}`, req.ip);

      await notifyPropertyManagers({
        title: 'Inventory Archived',
        message: `Inventory item ${item.item_name} (${item.item_code}) has been archived.`,
        type: 'inventory_archived',
        reference_id: item.id,
        link_url: '/pages/archive.html'
      });

      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = InventoryController;
