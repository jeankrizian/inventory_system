/**
 * Asset with Components Import — creates inventory parents (same as Inventory Import),
 * then INSERTS component rows into asset_components only (no inventory twins / Property Tags).
 *
 * Does NOT modify inventoryImportService.js.
 */
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const InventoryModel = require('../models/InventoryModel');
const ComponentModel = require('../models/ComponentModel');
const DocumentService = require('./documentService');
const { generateNextItemCode } = require('./itemCodeGenerator');
const { isFixedAsset, isSemiDurable, canManageComponents } = require('./assetClassification');
const { normalizeCondition, isValidCondition } = require('./conditionOptions');
const {
  TEMPLATE_COLUMNS,
  validateImportRows
} = require('./inventoryImportService');
const {
  normalizeComponentBody,
  resolveComponentClassification
} = require('./componentCreateHelper');

const MAX_COMPONENT_SLOTS = 10;
const PREVIEW_TTL_MS = 30 * 60 * 1000;
const previewStore = new Map();

const COMPONENT_FIELD_SUFFIXES = [
  'Type',
  'Name',
  'Brand',
  'Model',
  'Serial Number',
  'Condition'
];

function buildComponentColumnNames() {
  const columns = [];
  for (let i = 1; i <= MAX_COMPONENT_SLOTS; i += 1) {
    COMPONENT_FIELD_SUFFIXES.forEach((suffix) => {
      columns.push(`Component ${i} ${suffix}`);
    });
  }
  return columns;
}

const COMPONENT_COLUMNS = buildComponentColumnNames();
const COMBINED_TEMPLATE_COLUMNS = [...TEMPLATE_COLUMNS, ...COMPONENT_COLUMNS];

function cleanupExpiredPreviews() {
  const now = Date.now();
  for (const [token, entry] of previewStore.entries()) {
    if (entry.expiresAt <= now) previewStore.delete(token);
  }
}

setInterval(cleanupExpiredPreviews, 10 * 60 * 1000).unref?.();

function cellToString(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '';
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'object') {
    if (value.text != null) return String(value.text).trim();
    if (Object.prototype.hasOwnProperty.call(value, 'result')) {
      return cellToString(value.result);
    }
    if (value.richText && Array.isArray(value.richText)) {
      return value.richText.map((part) => String(part.text || '')).join('').trim();
    }
    if (value.error != null) return String(value.error).trim();
  }
  return String(value).trim();
}

async function parseWorkbookBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) {
    throw new Error('Excel file has no worksheets');
  }

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    const colCount = Math.max(row.cellCount, COMBINED_TEMPLATE_COLUMNS.length);
    for (let c = 1; c <= colCount; c += 1) {
      values.push(row.getCell(c).value);
    }
    rows.push({ rowNumber, values });
  });
  return rows;
}

function mapCombinedHeaderRow(values) {
  const map = {};
  values.forEach((raw, index) => {
    const key = cellToString(raw);
    if (!key) return;
    map[key.toLowerCase()] = index;
  });
  return map;
}

function getHeaderIndex(headerMap, label) {
  const idx = headerMap[String(label).toLowerCase()];
  return idx == null ? null : idx;
}

function extractComponentsFromRow(headerMap, values) {
  const components = [];
  const errors = [];

  for (let i = 1; i <= MAX_COMPONENT_SLOTS; i += 1) {
    const type = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Type`)] || '');
    const name = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Name`)] || '');
    const brand = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Brand`)] || '');
    const model = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Model`)] || '');
    const serial = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Serial Number`)] || '');
    const conditionRaw = cellToString(values[getHeaderIndex(headerMap, `Component ${i} Condition`)] || '');

    const anyFilled = Boolean(type || name || brand || model || serial || conditionRaw);
    if (!anyFilled) continue;

    if (!type && !name) {
      errors.push(`Component ${i}: Type or Name is required when other fields are filled`);
      continue;
    }

    if (conditionRaw && !isValidCondition(normalizeCondition(conditionRaw))) {
      errors.push(`Component ${i}: Invalid Condition`);
      continue;
    }

    const resolvedName = type || name;
    let resolvedBrand = brand || null;
    if (type && name && !resolvedBrand) {
      resolvedBrand = name;
    }

    const fields = normalizeComponentBody({
      component_name: resolvedName,
      asset_classification: 'Semi-Durable',
      brand: resolvedBrand,
      model: model || null,
      serial_number: serial || null,
      date_installed: null,
      condition: conditionRaw || 'Good',
      remarks: null
    });

    if (!resolveComponentClassification(fields.asset_classification)) {
      errors.push(`Component ${i}: Invalid classification`);
      continue;
    }

    components.push({
      slot: i,
      component_type: type || null,
      payload: fields
    });
  }

  return { components, errors };
}

async function buildTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cavite Institute Property Management System';
  const sheet = workbook.addWorksheet('Asset with Components');

  sheet.addRow(COMBINED_TEMPLATE_COLUMNS);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = COMBINED_TEMPLATE_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(14, Math.min(28, header.length + 2))
  }));

  // Sample System Unit row with a few components (demo only — not imported automatically)
  const sample = Array(COMBINED_TEMPLATE_COLUMNS.length).fill('');
  const setCol = (name, value) => {
    const idx = COMBINED_TEMPLATE_COLUMNS.indexOf(name);
    if (idx >= 0) sample[idx] = value;
  };
  setCol('Item Name', 'System Unit');
  setCol('Description', 'Sample row — replace with real data');
  setCol('Classification', 'Durable');
  setCol('Department', 'Engineering');
  setCol('Custodian', '');
  setCol('Quantity', 1);
  setCol('Condition', 'Good');
  setCol('Acquisition Date', '2026-07-01');
  setCol('Component 1 Type', 'Processor');
  setCol('Component 1 Name', 'Intel Core i5-6500');
  setCol('Component 1 Brand', 'Intel');
  setCol('Component 1 Condition', 'Good');
  setCol('Component 2 Type', 'RAM');
  setCol('Component 2 Name', 'Kingston 8GB DDR4');
  setCol('Component 2 Brand', 'Kingston');
  setCol('Component 2 Condition', 'Good');
  sheet.addRow(sample);

  const guide = workbook.addWorksheet('Instructions');
  guide.addRow(['Asset with Components Import Template']);
  guide.addRow([]);
  guide.addRow(['Inventory columns match the Inventory Import Template exactly.']);
  guide.addRow(['Required inventory fields: Item Name, Classification, Department.']);
  guide.addRow(['Optional Component 1–10 columns create replaceable components after the asset is created.']);
  guide.addRow(['Leave unused component slots blank — they are ignored.']);
  guide.addRow(['Components require Durable classification (same rule as Add Component).']);
  guide.addRow(['Component Type is free text (Processor, Blade, Motor, Ink Cartridge, etc.).']);
  guide.addRow(['Property Tag / Item Code / PAR are generated automatically — do not pre-fill unless needed.']);
  guide.addRow(['Save the file as .xlsx before importing.']);
  guide.getColumn(1).width = 100;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

function reasonCounts(invalidRows) {
  const counts = {};
  invalidRows.forEach((row) => {
    (row.reasons || []).forEach((reason) => {
      counts[reason] = (counts[reason] || 0) + 1;
    });
  });
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([reason, count]) => ({ reason, count }));
}

/**
 * Validate using existing Inventory Import rules, then attach/check component slots.
 */
async function validateImportRowsWithComponents(rawRows) {
  if (!rawRows.length) {
    throw new Error('Excel file is empty');
  }

  const headerMap = mapCombinedHeaderRow(rawRows[0].values);
  const inventoryValidation = await validateImportRows(rawRows);

  const componentsByRow = new Map();
  const componentErrorsByRow = new Map();

  rawRows.slice(1).forEach((row) => {
    const hasData = row.values.some((cell) => cellToString(cell) !== '' || (cell instanceof Date));
    if (!hasData) return;
    const extracted = extractComponentsFromRow(headerMap, row.values);
    if (extracted.components.length) {
      componentsByRow.set(row.rowNumber, extracted.components);
    }
    if (extracted.errors.length) {
      componentErrorsByRow.set(row.rowNumber, extracted.errors);
    }
  });

  const validRows = [];
  const invalidRows = [...inventoryValidation.invalidRows];

  for (const row of inventoryValidation.validRows) {
    const reasons = [];
    const componentFieldErrors = componentErrorsByRow.get(row.row_number) || [];
    reasons.push(...componentFieldErrors);

    const components = componentsByRow.get(row.row_number) || [];
    if (components.length) {
      const classification = row.payload?.asset_classification;
      if (!canManageComponents(classification)) {
        reasons.push('Components require Durable classification');
      }
    }

    if (reasons.length) {
      invalidRows.push({
        row_number: row.row_number,
        item_name: row.payload?.item_name || null,
        reasons
      });
      continue;
    }

    validRows.push({
      ...row,
      components
    });
  }

  // Rows that failed inventory validation may still have component notes — keep inventory reasons primary.
  const summary = {
    total_rows: inventoryValidation.summary.total_rows,
    valid_records: validRows.length,
    invalid_records: invalidRows.length,
    reason_summary: reasonCounts(invalidRows)
  };

  return { summary, validRows, invalidRows };
}

function storePreview(userId, validationResult) {
  cleanupExpiredPreviews();
  const token = crypto.randomBytes(24).toString('hex');
  previewStore.set(token, {
    userId,
    expiresAt: Date.now() + PREVIEW_TTL_MS,
    validRows: validationResult.validRows,
    summary: validationResult.summary,
    invalidRows: validationResult.invalidRows
  });
  return token;
}

function takePreview(token, userId) {
  cleanupExpiredPreviews();
  const entry = previewStore.get(token);
  if (!entry) return null;
  if (entry.userId !== userId) return null;
  if (entry.expiresAt <= Date.now()) {
    previewStore.delete(token);
    return null;
  }
  previewStore.delete(token);
  return entry;
}

/**
 * Create inventory parents (Quantity expansion + Property Tag + Item Code + PAR),
 * then INSERT components into asset_components ONLY.
 *
 * Components must NOT become inventory_items and must NOT receive Property Tags.
 * Linking is via asset_components.parent_asset_id → inventory_items.id.
 */
async function commitValidRowsWithComponents(validRows, userId) {
  let imported = 0;
  let parsGenerated = 0;
  let componentsImported = 0;
  const failures = [];
  let nextPropertyTagSequence = null;

  for (const row of validRows) {
    try {
      const body = { ...row.payload };
      delete body.item_code;
      // Parent assets only — never create component rows as inventory.
      body.parent_asset_id = null;
      body.item_code = await generateNextItemCode(body.department_id);

      let allocatedNextSequence = null;
      const createOptions = {
        onPropertyTagsAllocated: (nextSequence) => {
          allocatedNextSequence = nextSequence;
        }
      };
      if (nextPropertyTagSequence != null) {
        createOptions.propertyTagStartSequence = nextPropertyTagSequence;
      }

      // Expands Quantity into N inventory assets (each with own Property Tag / ID).
      const result = await InventoryModel.create(body, createOptions);
      if (result?.created_count) imported += result.created_count;

      if (allocatedNextSequence != null) {
        nextPropertyTagSequence = allocatedNextSequence;
      } else {
        nextPropertyTagSequence = null;
      }

      const classification = body.asset_classification;
      const ids = result?.ids || [];
      if (
        ids.length
        && (isFixedAsset(classification) || isSemiDurable(classification))
      ) {
        try {
          const parResult = await DocumentService.generatePARsForInventoryAssets(ids, userId);
          parsGenerated += parResult.created_count || 0;
        } catch (docErr) {
          console.error(
            `Asset+Components import PAR generation failed for row ${row.row_number}:`,
            docErr.message
          );
        }
      }

      const components = Array.isArray(row.components) ? row.components : [];
      if (components.length && ids.length && canManageComponents(classification)) {
        for (const parentId of ids) {
          const parent = await InventoryModel.findById(parentId);
          if (!parent) {
            failures.push({
              row_number: row.row_number,
              item_name: row.payload?.item_name || null,
              reason: `Parent asset ${parentId} not found after create`
            });
            continue;
          }

          for (const component of components) {
            try {
              // asset_components only — no inventory twin, no Property Tag, no Item Code.
              await ComponentModel.createComponent({
                parent_asset_id: parent.id,
                inventory_item_id: null,
                component_name: component.payload.component_name,
                brand: component.payload.brand || null,
                model: component.payload.model || null,
                serial_number: component.payload.serial_number || null,
                date_installed: body.acquisition_date || component.payload.date_installed || null,
                condition: component.payload.condition || 'Good',
                remarks: component.payload.remarks || null,
                created_by: userId
              });
              componentsImported += 1;
            } catch (compErr) {
              failures.push({
                row_number: row.row_number,
                item_name: row.payload?.item_name || null,
                reason: `Component ${component.slot} (${component.payload.component_name}): ${compErr.message || 'failed'}`
              });
            }
          }
        }
      }
    } catch (err) {
      failures.push({
        row_number: row.row_number,
        item_name: row.payload?.item_name || null,
        reason: err.message || 'Import failed'
      });
    }
  }

  return { imported, parsGenerated, componentsImported, failures };
}

module.exports = {
  MAX_COMPONENT_SLOTS,
  COMBINED_TEMPLATE_COLUMNS,
  buildTemplateBuffer,
  parseWorkbookBuffer,
  validateImportRowsWithComponents,
  storePreview,
  takePreview,
  commitValidRowsWithComponents
};
