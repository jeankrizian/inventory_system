const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyAdmins } = require('../utils/notificationService');
const {
  sanitizeInventoryByClassification,
  validateInventoryClassification,
  isFixedAsset,
  normalizeClassification
} = require('../utils/assetClassification');

function isSemiDurableClassification(value) {
  return normalizeClassification(value) === 'Semi-Durable';
}
const DocumentService = require('../utils/documentService');
function normalizeItemBody(body) {
  const data = { ...body };
  if (data.category_id && !data.department_id) data.department_id = data.category_id;
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

async function notifyLowStockIfNeeded(item) {
  if (item && item.available_quantity <= item.low_stock_threshold) {
    await notifyAdmins({
      title: 'Low Stock Alert',
      message: `${item.item_name} (${item.item_code}) is now low in stock (${item.available_quantity} remaining).`,
      type: 'low_stock',
      reference_id: item.id,
      link_url: '/pages/inventory.html?low_stock=true',
      skipDuplicate: true
    });
  }
}

const InventoryController = {
  async getAll(req, res) {
    try {
      const filters = {
        search: req.query.search,
        department_id: req.query.department_id || req.query.category_id,
        asset_classification: req.query.asset_classification,
        status: req.query.status,
        location_id: req.query.location_id,
        parent_asset_id: req.query.parent_asset_id,
        low_stock: req.query.low_stock === 'true'
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
      sendSuccess(res, item);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const normalized = normalizePurchaseFields(normalizeItemBody(req.body));
      const validation = validateInventoryClassification(normalized);
      if (!validation.valid) return sendError(res, validation.message, 400);

      const body = sanitizeInventoryByClassification(normalized);

      const existing = await InventoryModel.findByCode(body.item_code);
      if (existing) return sendError(res, 'Item code already exists', 400);

      const id = await InventoryModel.create(body);
      await logActivity(req.session.user.id, 'CREATE', 'Inventory', `Added item ${body.item_code}`, req.ip);
      const item = await InventoryModel.findById(id);

      await notifyAdmins({
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
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.id);
      if (!item) return sendError(res, 'Item not found', 404);

      const normalized = normalizePurchaseFields(normalizeItemBody(req.body));
      const forValidation = {
        ...normalized,
        asset_classification: normalized.asset_classification ?? item.asset_classification,
        property_tag: normalized.property_tag ?? item.property_tag,
        custodian_type: normalized.custodian_type ?? item.custodian_type,
        custodian_id: normalized.custodian_id ?? item.custodian_id
      };
      const validation = validateInventoryClassification(forValidation);
      if (!validation.valid) return sendError(res, validation.message, 400);

      const body = sanitizeInventoryByClassification(forValidation);

      if (body.item_code && body.item_code !== item.item_code) {
        const existing = await InventoryModel.findByCode(body.item_code);
        if (existing) return sendError(res, 'Item code already exists', 400);
      }

      await InventoryModel.update(req.params.id, body);
      await logActivity(req.session.user.id, 'UPDATE', 'Inventory', `Updated item ${item.item_code}`, req.ip);
      const updated = await InventoryModel.findById(req.params.id);

      await notifyAdmins({
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

      await notifyAdmins({
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
