const ComponentModel = require('../models/ComponentModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { isValidCondition } = require('../utils/conditionOptions');
const {
  trimOrNull,
  normalizeComponentBody,
  resolveComponentClassification,
  assertDurableParent,
  createComponentInventoryItem,
  createComponentForParent
} = require('../utils/componentCreateHelper');

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

      const { component } = await createComponentForParent(check.parent, fields, {
        userId: req.session.user.id,
        ip: req.ip,
        log: true
      });

      sendSuccess(res, component, 'Component added successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  /**
   * Update editable details of an existing Active component.
   * Does not change parent, inventory link, status, Property Tags, or Item Codes.
   */
  async update(req, res) {
    try {
      const componentId = parseInt(req.params.id, 10);
      if (!componentId) return sendError(res, 'Component id is required', 400);

      const existing = await ComponentModel.findComponentById(componentId);
      if (!existing) return sendError(res, 'Component not found', 404);
      if (existing.status !== 'Active') {
        return sendError(res, 'Only active components can be edited', 400);
      }

      const check = await assertDurableParent(existing.parent_asset_id);
      if (check.error) return sendError(res, check.error.message, check.error.status);

      const componentName = trimOrNull(req.body.component_name);
      if (!componentName) {
        return sendError(res, 'Component name is required', 400);
      }

      const details = {
        component_name: componentName,
        brand: trimOrNull(req.body.brand),
        model: trimOrNull(req.body.model),
        serial_number: trimOrNull(req.body.serial_number),
        remarks: trimOrNull(req.body.remarks)
      };

      const updated = await ComponentModel.updateDetails(componentId, details);
      if (!updated) {
        return sendError(res, 'Unable to update component', 400);
      }

      await logActivity(
        req.session.user.id,
        'UPDATE',
        'Component',
        `Updated component "${details.component_name}" on ${check.parent.item_code}`,
        req.ip,
        {
          entity_type: 'inventory_item',
          entity_id: existing.parent_asset_id,
          reference_code: check.parent.property_tag || check.parent.item_code,
          old_value: existing.component_name,
          new_value: details.component_name
        }
      );

      const component = await ComponentModel.findComponentById(componentId);
      sendSuccess(res, component, 'Component updated successfully');
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
        if (!marked) throw new Error('Component is no longer active');
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
  },

  async downloadImportTemplate(req, res) {
    try {
      const { buildTemplateBuffer } = require('../utils/componentImportService');
      const buffer = await buildTemplateBuffer();
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', 'attachment; filename="asset-components-import-template.xlsx"');
      res.send(buffer);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async previewImport(req, res) {
    try {
      const {
        parseWorkbookBuffer,
        validateImportRows,
        storePreview
      } = require('../utils/componentImportService');

      if (!req.file?.buffer?.length) {
        return sendError(res, 'Excel file is required', 400);
      }

      const originalName = String(req.file.originalname || '').toLowerCase();
      const isXlsx = originalName.endsWith('.xlsx')
        || req.file.mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
      const isXls = originalName.endsWith('.xls');
      if (!isXlsx && !isXls) {
        return sendError(res, 'Only .xlsx or .xls files are allowed', 400);
      }
      if (isXls && !isXlsx) {
        return sendError(res, 'Legacy .xls format is not supported. Please save the file as .xlsx and try again.', 400);
      }

      const rawRows = await parseWorkbookBuffer(req.file.buffer);
      const validation = await validateImportRows(rawRows);
      const previewToken = storePreview(req.session.user.id, validation);

      sendSuccess(res, {
        preview_token: previewToken,
        summary: validation.summary,
        invalid_rows: validation.invalidRows.slice(0, 100),
        valid_preview: validation.validRows.slice(0, 20).map((row) => ({
          row_number: row.row_number,
          property_tag: row.property_tag,
          component_type: row.component_type,
          component_name: row.payload.component_name,
          brand: row.payload.brand
        }))
      }, 'Import preview ready');
    } catch (err) {
      sendError(res, err.message || 'Unable to preview import', 400);
    }
  },

  async confirmImport(req, res) {
    try {
      const {
        takePreview,
        commitValidRows
      } = require('../utils/componentImportService');

      const token = String(req.body?.preview_token || '').trim();
      if (!token) return sendError(res, 'Preview token is required', 400);

      const preview = takePreview(token, req.session.user.id);
      if (!preview) {
        return sendError(res, 'Import preview expired or not found. Please upload the file again.', 400);
      }
      if (!preview.validRows.length) {
        return sendError(res, 'No valid records to import', 400);
      }

      const { imported, failures } = await commitValidRows(preview.validRows, req.session.user.id);

      await logActivity(
        req.session.user.id,
        'IMPORT',
        'Component',
        `Imported ${imported} component(s) from Excel (${preview.summary.total_rows} rows, ${preview.summary.invalid_records} skipped)`,
        req.ip
      );

      sendSuccess(res, {
        total_rows: preview.summary.total_rows,
        successfully_imported: imported,
        skipped: preview.summary.invalid_records + failures.length,
        reason_summary: preview.summary.reason_summary,
        import_failures: failures
      }, 'Import completed');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = ComponentController;
