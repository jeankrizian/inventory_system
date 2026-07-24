/**
 * Asset Components Import (existing assets by Property Tag) — INSERT only.
 */
const crypto = require('crypto');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const { canManageComponents } = require('./assetClassification');
const { normalizeCondition, isValidCondition } = require('./conditionOptions');
const {
  createComponentForParent,
  normalizeComponentBody,
  resolveComponentClassification
} = require('./componentCreateHelper');

const TEMPLATE_COLUMNS = [
  'Property Tag',
  'Component Type',
  'Component Name',
  'Brand',
  'Model',
  'Serial Number',
  'Condition',
  'Status',
  'Remarks'
];

const HEADER_ALIASES = {
  'property tag': 'Property Tag',
  'property number': 'Property Tag',
  'property no': 'Property Tag',
  'property no.': 'Property Tag',
  'property_tag': 'Property Tag',
  'component type': 'Component Type',
  'type': 'Component Type',
  'component name': 'Component Name',
  'name': 'Component Name',
  'brand': 'Brand',
  'model': 'Model',
  'serial number': 'Serial Number',
  'serial no': 'Serial Number',
  'serial no.': 'Serial Number',
  'serial_number': 'Serial Number',
  'condition': 'Condition',
  'status': 'Status',
  'remarks': 'Remarks',
  'notes': 'Remarks'
};

const PREVIEW_TTL_MS = 30 * 60 * 1000;
const MAX_IMPORT_ROWS = 5000;
const previewStore = new Map();

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

function mapHeaderRow(values) {
  const map = {};
  values.forEach((raw, index) => {
    const key = cellToString(raw).toLowerCase();
    if (!key) return;
    const canonical = HEADER_ALIASES[key];
    if (canonical) map[canonical] = index;
  });
  return map;
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

async function parseWorkbookBuffer(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const sheet = workbook.worksheets[0];
  if (!sheet) throw new Error('Excel file has no worksheets');

  const rows = [];
  sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    const values = [];
    const colCount = Math.max(row.cellCount, TEMPLATE_COLUMNS.length);
    for (let c = 1; c <= colCount; c += 1) {
      values.push(row.getCell(c).value);
    }
    rows.push({ rowNumber, values });
  });
  return rows;
}

async function buildTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cavite Institute Property Management System';
  const sheet = workbook.addWorksheet('Asset Components Import');
  sheet.addRow(TEMPLATE_COLUMNS);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = TEMPLATE_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 2)
  }));
  sheet.addRow(['CI-000001', 'Processor', 'Intel Core i5-6500', 'Intel', 'Core i5-6500', '', 'Good', 'Active', '']);
  sheet.addRow(['CI-000002', 'Blade', '16-inch Plastic Blade', '', '', '', 'Good', 'Active', 'Sample']);

  const guide = workbook.addWorksheet('Instructions');
  guide.addRow(['Asset Components Import Template (Existing Assets)']);
  guide.addRow([]);
  guide.addRow(['Required: Property Tag, and either Component Type or Component Name.']);
  guide.addRow(['Property Tag must match an existing Durable inventory item.']);
  guide.addRow(['This import only INSERTS new components. It never updates existing ones.']);
  guide.addRow(['Save the file as .xlsx before importing.']);
  guide.getColumn(1).width = 100;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function loadParentsByPropertyTag() {
  const [rows] = await pool.query(
    `SELECT id, item_code, item_name, property_tag, asset_classification, department_id,
            material, custodian_id, supplier_id, location_id, is_archived
     FROM inventory_items
     WHERE property_tag IS NOT NULL AND property_tag != ''
       AND (is_archived = 0 OR is_archived IS NULL)
       AND (parent_asset_id IS NULL)`
  );
  const byTag = new Map();
  rows.forEach((row) => {
    const key = String(row.property_tag || '').trim().toLowerCase();
    if (key && !byTag.has(key)) byTag.set(key, row);
  });
  return byTag;
}

function resolveComponentFields(componentType, componentName, brand, model, serialNumber, condition, remarks) {
  const type = componentType || '';
  const name = componentName || '';
  const resolvedName = type || name;
  let resolvedBrand = brand || null;
  if (type && name && !resolvedBrand) resolvedBrand = name;

  return normalizeComponentBody({
    component_name: resolvedName,
    asset_classification: 'Semi-Durable',
    brand: resolvedBrand,
    model: model || null,
    serial_number: serialNumber || null,
    date_installed: null,
    condition: condition || 'Good',
    remarks: remarks || null
  });
}

async function validateImportRows(rawRows) {
  if (!rawRows.length) throw new Error('Excel file is empty');

  const headerMap = mapHeaderRow(rawRows[0].values);
  if (headerMap['Property Tag'] == null) {
    throw new Error('Invalid template. Required column: Property Tag. Download the Components template and try again.');
  }
  if (headerMap['Component Type'] == null && headerMap['Component Name'] == null) {
    throw new Error('Invalid template. Required column: Component Type or Component Name.');
  }

  const dataRows = rawRows.slice(1).filter((row) =>
    row.values.some((cell) => cellToString(cell) !== '' || (cell instanceof Date))
  );
  if (!dataRows.length) throw new Error('No data rows found in the Excel file');
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Too many rows. Maximum allowed is ${MAX_IMPORT_ROWS}`);
  }

  const parentsByTag = await loadParentsByPropertyTag();
  const validRows = [];
  const invalidRows = [];

  for (const row of dataRows) {
    const get = (col) => {
      const idx = headerMap[col];
      return idx == null ? null : row.values[idx];
    };

    const reasons = [];
    const propertyTag = cellToString(get('Property Tag'));
    const componentType = cellToString(get('Component Type'));
    const componentName = cellToString(get('Component Name'));
    const brand = cellToString(get('Brand'));
    const model = cellToString(get('Model'));
    const serialNumber = cellToString(get('Serial Number'));
    const conditionRaw = cellToString(get('Condition'));
    const remarks = cellToString(get('Remarks'));

    if (!propertyTag) reasons.push('Missing Property Tag');
    if (!componentType && !componentName) reasons.push('Missing Component Type or Component Name');

    let parent = null;
    if (propertyTag) {
      parent = parentsByTag.get(propertyTag.toLowerCase()) || null;
      if (!parent) reasons.push('Property Tag not found');
      else if (!canManageComponents(parent.asset_classification)) {
        reasons.push('Components can only be added to Durable assets');
      }
    }

    if (conditionRaw && !isValidCondition(normalizeCondition(conditionRaw))) {
      reasons.push('Invalid Condition');
    }

    const fields = resolveComponentFields(
      componentType, componentName, brand, model, serialNumber, conditionRaw, remarks
    );

    if (fields.component_name && !resolveComponentClassification(fields.asset_classification)) {
      reasons.push('Invalid component classification');
    }

    if (reasons.length) {
      invalidRows.push({
        row_number: row.rowNumber,
        property_tag: propertyTag || null,
        component_name: fields.component_name || componentType || componentName || null,
        reasons
      });
      continue;
    }

    validRows.push({
      row_number: row.rowNumber,
      property_tag: propertyTag,
      component_type: componentType || null,
      parent_id: parent.id,
      parent,
      payload: fields
    });
  }

  return {
    summary: {
      total_rows: dataRows.length,
      valid_records: validRows.length,
      invalid_records: invalidRows.length,
      reason_summary: reasonCounts(invalidRows)
    },
    validRows,
    invalidRows
  };
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

async function commitValidRows(validRows, userId) {
  let imported = 0;
  const failures = [];

  for (const row of validRows) {
    try {
      const [freshRows] = await pool.query(
        `SELECT id, item_code, item_name, property_tag, asset_classification, department_id,
                material, custodian_id, supplier_id, location_id, is_archived
         FROM inventory_items
         WHERE id = ? AND (is_archived = 0 OR is_archived IS NULL)
         LIMIT 1`,
        [row.parent_id]
      );
      const parent = freshRows[0];
      if (!parent) {
        failures.push({
          row_number: row.row_number,
          property_tag: row.property_tag,
          reason: 'Property Tag not found'
        });
        continue;
      }
      if (!canManageComponents(parent.asset_classification)) {
        failures.push({
          row_number: row.row_number,
          property_tag: row.property_tag,
          reason: 'Components can only be added to Durable assets'
        });
        continue;
      }

      await createComponentForParent(parent, row.payload, { userId, log: false });
      imported += 1;
    } catch (err) {
      failures.push({
        row_number: row.row_number,
        property_tag: row.property_tag || null,
        reason: err.message || 'Import failed'
      });
    }
  }

  return { imported, failures };
}

module.exports = {
  TEMPLATE_COLUMNS,
  buildTemplateBuffer,
  parseWorkbookBuffer,
  validateImportRows,
  storePreview,
  takePreview,
  commitValidRows
};
