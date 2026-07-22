const crypto = require('crypto');
const ExcelJS = require('exceljs');
const pool = require('../config/database');
const InventoryModel = require('../models/InventoryModel');
const DepartmentModel = require('../models/DepartmentModel');
const LocationModel = require('../models/LocationModel');
const SupplierModel = require('../models/SupplierModel');
const { generateNextItemCode } = require('./itemCodeGenerator');
const {
  normalizeClassification,
  sanitizeInventoryByClassification,
  validateBulkAssetCreate,
  CONSUMABLE_DISABLED_MESSAGE,
  isConsumableClassification,
  isFixedAsset,
  isSemiDurable
} = require('./assetClassification');
const { normalizeCondition, isValidCondition } = require('./conditionOptions');
const { isWorkflowStatus } = require('./inventoryStatusService');
const DocumentService = require('./documentService');

const TEMPLATE_COLUMNS = [
  'Property Number',
  'Item Name',
  'Description',
  'Classification',
  'Category',
  'Department',
  'Location',
  'Supplier',
  'Custodian',
  'Quantity',
  'Unit Cost',
  'Acquisition Cost',
  'Acquisition Date',
  'Condition',
  'Status',
  'Serial Number',
  'Brand',
  'Model',
  'Remarks'
];

const HEADER_ALIASES = {
  'property number': 'Property Number',
  'property tag': 'Property Number',
  'property no': 'Property Number',
  'property no.': 'Property Number',
  'item name': 'Item Name',
  'name': 'Item Name',
  'description': 'Description',
  'classification': 'Classification',
  'asset classification': 'Classification',
  'category': 'Category',
  'department': 'Department',
  'location': 'Location',
  'supplier': 'Supplier',
  'custodian': 'Custodian',
  'assigned custodian': 'Custodian',
  'quantity': 'Quantity',
  'asset count': 'Quantity',
  'number of assets': 'Quantity',
  'unit cost': 'Unit Cost',
  'cost': 'Unit Cost',
  'acquisition cost': 'Acquisition Cost',
  'acquisition date': 'Acquisition Date',
  'date purchased': 'Acquisition Date',
  'purchase date': 'Acquisition Date',
  'condition': 'Condition',
  'status': 'Status',
  'serial number': 'Serial Number',
  'serial no': 'Serial Number',
  'serial no.': 'Serial Number',
  'brand': 'Brand',
  'model': 'Model',
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
    // Formula / shared-formula cells: result may be Date, number, or string.
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

function parseExcelDate(value) {
  if (value == null || value === '') return { ok: true, value: null };
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const iso = value.toISOString().slice(0, 10);
    return { ok: true, value: iso };
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    const epoch = new Date(Math.round((value - 25569) * 86400 * 1000));
    if (!Number.isNaN(epoch.getTime())) {
      return { ok: true, value: epoch.toISOString().slice(0, 10) };
    }
  }
  const text = cellToString(value);
  if (!text) return { ok: true, value: null };

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const d = new Date(`${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return { ok: true, value: `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}` };
  }

  const slashMatch = text.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (slashMatch) {
    let year = parseInt(slashMatch[3], 10);
    if (year < 100) year += 2000;
    const month = String(parseInt(slashMatch[1], 10)).padStart(2, '0');
    const day = String(parseInt(slashMatch[2], 10)).padStart(2, '0');
    const d = new Date(`${year}-${month}-${day}T00:00:00Z`);
    if (!Number.isNaN(d.getTime())) return { ok: true, value: `${year}-${month}-${day}` };
  }

  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) {
    return { ok: true, value: parsed.toISOString().slice(0, 10) };
  }
  return { ok: false, value: null };
}

function parseMoney(value) {
  if (value == null || value === '') return { ok: true, value: null };
  if (typeof value === 'number' && Number.isFinite(value)) {
    return { ok: true, value: value };
  }
  const cleaned = cellToString(value).replace(/[₱,\s]/g, '');
  if (!cleaned) return { ok: true, value: null };
  const num = Number(cleaned);
  if (!Number.isFinite(num) || num < 0) return { ok: false, value: null };
  return { ok: true, value: num };
}

function parseQuantity(value) {
  if (value == null || value === '') return { ok: true, value: 1 };
  if (typeof value === 'number' && Number.isFinite(value)) {
    const n = Math.trunc(value);
    if (n < 1 || n > 500) return { ok: false, value: null };
    return { ok: true, value: n };
  }
  const text = cellToString(value);
  if (!text) return { ok: true, value: 1 };
  if (!/^\d+$/.test(text)) return { ok: false, value: null };
  const n = parseInt(text, 10);
  if (n < 1 || n > 500) return { ok: false, value: null };
  return { ok: true, value: n };
}

function normalizeImportClassification(raw) {
  const text = cellToString(raw);
  if (!text) return '';
  const lower = text.toLowerCase().replace(/\s+/g, ' ').trim();
  if (lower === 'consumable') return 'Consumable';
  if (lower === 'semi-durable' || lower === 'semi durable' || lower === 'semidurable') {
    return 'Semi-Durable';
  }
  if (
    lower === 'non-consumable (fixed asset)'
    || lower === 'non-consumable'
    || lower === 'non consumable'
    || lower === 'fixed asset'
    || lower === 'ppe'
  ) {
    return 'Durable';
  }
  return normalizeClassification(text) || text;
}

function buildLookupMaps(departments, locations, suppliers, custodians = []) {
  const departmentsByKey = new Map();
  departments.forEach((d) => {
    departmentsByKey.set(String(d.name || '').trim().toLowerCase(), d);
    if (d.code) departmentsByKey.set(String(d.code).trim().toLowerCase(), d);
  });
  const locationsByKey = new Map();
  locations.forEach((l) => {
    locationsByKey.set(String(l.name || '').trim().toLowerCase(), l);
  });
  const suppliersByKey = new Map();
  suppliers.forEach((s) => {
    suppliersByKey.set(String(s.name || '').trim().toLowerCase(), s);
  });
  const custodiansByKey = new Map();
  const custodiansByDepartment = new Map();
  custodians.forEach((u) => {
    if (u.full_name) custodiansByKey.set(String(u.full_name).trim().toLowerCase(), u);
    if (u.username) custodiansByKey.set(String(u.username).trim().toLowerCase(), u);
    if (u.email) custodiansByKey.set(String(u.email).trim().toLowerCase(), u);
    if (u.assigned_department_id && !custodiansByDepartment.has(u.assigned_department_id)) {
      custodiansByDepartment.set(u.assigned_department_id, u);
    }
  });
  return {
    departmentsByKey,
    locationsByKey,
    suppliersByKey,
    custodiansByKey,
    custodiansByDepartment
  };
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

async function loadExistingUniques() {
  const [tagRows] = await pool.query(
    `SELECT property_tag FROM inventory_items
     WHERE property_tag IS NOT NULL AND property_tag != '' AND is_archived = 0`
  );
  const [serialRows] = await pool.query(
    `SELECT serial_number FROM inventory_items
     WHERE serial_number IS NOT NULL AND serial_number != '' AND is_archived = 0`
  );
  return {
    propertyTags: new Set(tagRows.map((r) => String(r.property_tag).trim().toLowerCase())),
    serialNumbers: new Set(serialRows.map((r) => String(r.serial_number).trim().toLowerCase()))
  };
}

async function loadActiveCustodians() {
  const [rows] = await pool.query(
    `SELECT u.id, u.username, u.email, u.full_name, u.assigned_department_id, r.name AS role_name
     FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.is_active = 1
       AND (u.is_archived = 0 OR u.is_archived IS NULL)
       AND LOWER(r.name) LIKE '%custodian%'`
  );
  return rows || [];
}

function resolveCustodianId(lookups, department, custodianName, classification) {
  if (custodianName) {
    const matched = lookups.custodiansByKey.get(custodianName.toLowerCase());
    if (!matched) return { id: null, error: 'Custodian not found' };
    return { id: matched.id, error: null };
  }

  if (!isFixedAsset(classification)) {
    return { id: department?.custodian_id || null, error: null };
  }

  if (department?.custodian_id) {
    return { id: department.custodian_id, error: null };
  }

  const assigned = lookups.custodiansByDepartment.get(department?.id);
  if (assigned) {
    return { id: assigned.id, error: null };
  }

  return {
    id: null,
    error: 'Custodian required for fixed asset (enter Custodian name/username or use Semi-Durable)'
  };
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
    const colCount = Math.max(row.cellCount, TEMPLATE_COLUMNS.length);
    for (let c = 1; c <= colCount; c += 1) {
      values.push(row.getCell(c).value);
    }
    rows.push({ rowNumber, values });
  });
  return rows;
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

async function buildTemplateBuffer() {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Cavite Institute Property Management System';
  const sheet = workbook.addWorksheet('Inventory Import');

  sheet.addRow(TEMPLATE_COLUMNS);
  sheet.getRow(1).font = { bold: true };
  sheet.columns = TEMPLATE_COLUMNS.map((header) => ({
    header,
    key: header,
    width: Math.max(16, header.length + 2)
  }));

  sheet.addRow([
    '',
    'Sample Office Chair',
    'Demo import row — replace with real data',
    'Semi-Durable',
    '',
    'Engineering',
    '',
    '',
    '',
    1,
    2500,
    '',
    '2026-07-01',
    'Good',
    'Available',
    '',
    '',
    '',
    ''
  ]);

  const guide = workbook.addWorksheet('Instructions');
  guide.addRow(['Inventory Import Template']);
  guide.addRow([]);
  guide.addRow(['Required: Item Name, Classification, Department']);
  guide.addRow(['Classification values: Semi-Durable | Durable']);
  guide.addRow(['Quantity = number of asset records to create (1–500). Default is 1.']);
  guide.addRow(['Property Number must be unique when provided.']);
  guide.addRow(['Serial Number must be unique when provided (only for Quantity = 1).']);
  guide.addRow(['Department / Location / Supplier must match existing names.']);
  guide.addRow(['Custodian: required for Durable. Use full name or username (e.g. ict_custodian).']);
  guide.addRow(['If Custodian is blank for a fixed asset, the assigned department custodian is used when available.']);
  guide.addRow(['Status is informational only; new items are always created as Available.']);
  guide.addRow(['Acquisition Cost is ignored; use Unit Cost.']);
  guide.addRow(['Save the file as .xlsx before importing.']);
  guide.getColumn(1).width = 90;

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

async function validateImportRows(rawRows) {
  if (!rawRows.length) {
    throw new Error('Excel file is empty');
  }

  const headerMap = mapHeaderRow(rawRows[0].values);
  if (headerMap['Item Name'] == null || (headerMap.Department == null && headerMap.Category == null)) {
    throw new Error('Invalid template. Required columns: Item Name and Department (or Category). Download the Excel template and try again.');
  }

  const dataRows = rawRows.slice(1).filter((row) =>
    row.values.some((cell) => cellToString(cell) !== '' || (cell instanceof Date))
  );

  if (!dataRows.length) {
    throw new Error('No data rows found in the Excel file');
  }
  if (dataRows.length > MAX_IMPORT_ROWS) {
    throw new Error(`Too many rows. Maximum allowed is ${MAX_IMPORT_ROWS}`);
  }

  const [departments, locations, suppliers, custodians, uniques] = await Promise.all([
    DepartmentModel.getAll(),
    LocationModel.getAll(),
    SupplierModel.getAll(),
    loadActiveCustodians(),
    loadExistingUniques()
  ]);
  const lookups = buildLookupMaps(departments, locations, suppliers, custodians);

  const filePropertyTags = new Set();
  const fileSerials = new Set();
  const validRows = [];
  const invalidRows = [];

  for (const row of dataRows) {
    const get = (col) => {
      const idx = headerMap[col];
      return idx == null ? null : row.values[idx];
    };

    const reasons = [];
    const itemName = cellToString(get('Item Name'));
    if (!itemName) reasons.push('Missing Item Name');

    const classification = normalizeImportClassification(get('Classification'));
    if (!classification) {
      reasons.push('Missing Classification');
    } else if (isConsumableClassification(classification)) {
      reasons.push(CONSUMABLE_DISABLED_MESSAGE);
    } else if (!['Semi-Durable', 'Durable'].includes(classification)) {
      reasons.push('Invalid Classification');
    }

    const departmentName = cellToString(get('Department')) || cellToString(get('Category'));
    let department = null;
    if (!departmentName) {
      reasons.push('Missing Department');
    } else {
      department = lookups.departmentsByKey.get(departmentName.toLowerCase()) || null;
      if (!department) reasons.push('Department not found');
    }

    const locationName = cellToString(get('Location'));
    let locationId = null;
    if (locationName) {
      const location = lookups.locationsByKey.get(locationName.toLowerCase());
      if (!location) reasons.push('Location not found');
      else locationId = location.id;
    }

    const supplierName = cellToString(get('Supplier'));
    let supplierId = null;
    if (supplierName) {
      const supplier = lookups.suppliersByKey.get(supplierName.toLowerCase());
      if (!supplier) reasons.push('Supplier not found');
      else supplierId = supplier.id;
    }

    const quantityParse = parseQuantity(get('Quantity'));
    if (!quantityParse.ok) reasons.push('Invalid Quantity');

    const unitCostParse = parseMoney(get('Unit Cost'));
    if (!unitCostParse.ok) reasons.push('Invalid Unit Cost');

    const acquisitionCostRaw = get('Acquisition Cost');
    if (acquisitionCostRaw != null && cellToString(acquisitionCostRaw) !== '') {
      const acquisitionCostParse = parseMoney(acquisitionCostRaw);
      if (!acquisitionCostParse.ok) reasons.push('Invalid Acquisition Cost');
    }

    const dateParse = parseExcelDate(get('Acquisition Date'));
    if (!dateParse.ok) reasons.push('Invalid Acquisition Date');

    const condition = normalizeCondition(cellToString(get('Condition'))) || 'Good';
    if (!isValidCondition(condition)) reasons.push('Invalid Condition');

    const statusText = cellToString(get('Status'));
    if (statusText && !isWorkflowStatus(statusText)) {
      reasons.push('Invalid Status');
    }

    const propertyTag = cellToString(get('Property Number')) || null;
    if (propertyTag) {
      const key = propertyTag.toLowerCase();
      if (uniques.propertyTags.has(key) || filePropertyTags.has(key)) {
        reasons.push('Duplicate Property Number');
      } else {
        filePropertyTags.add(key);
      }
      if (quantityParse.ok && quantityParse.value > 1) {
        reasons.push('Property Number can only be used when Quantity is 1');
      }
    }

    const serialNumber = cellToString(get('Serial Number')) || null;
    if (serialNumber) {
      const key = serialNumber.toLowerCase();
      if (uniques.serialNumbers.has(key) || fileSerials.has(key)) {
        reasons.push('Duplicate Serial Number');
      } else {
        fileSerials.add(key);
      }
      if (quantityParse.ok && quantityParse.value > 1) {
        reasons.push('Serial Number can only be used when Quantity is 1');
      }
    }

    const description = cellToString(get('Description'));
    const remarks = cellToString(get('Remarks'));
    const combinedDescription = [description, remarks].filter(Boolean).join(' — ') || null;

    const custodianName = cellToString(get('Custodian'));
    let custodianId = null;
    if (department && classification && !reasons.includes('Invalid Classification') && !reasons.includes(CONSUMABLE_DISABLED_MESSAGE)) {
      const custodianResult = resolveCustodianId(lookups, department, custodianName, classification);
      if (custodianResult.error) reasons.push(custodianResult.error);
      else custodianId = custodianResult.id;
    } else if (custodianName) {
      const matched = lookups.custodiansByKey.get(custodianName.toLowerCase());
      if (!matched) reasons.push('Custodian not found');
      else custodianId = matched.id;
    }

    if (reasons.length) {
      invalidRows.push({
        row_number: row.rowNumber,
        item_name: itemName || null,
        reasons
      });
      continue;
    }

    const payload = {
      item_name: itemName,
      description: combinedDescription,
      department_id: department.id,
      asset_classification: classification,
      location_id: locationId,
      supplier_id: supplierId,
      custodian_id: custodianId,
      asset_count: quantityParse.value,
      unit_cost: unitCostParse.value,
      acquisition_date: dateParse.value,
      condition,
      brand: cellToString(get('Brand')) || null,
      model: cellToString(get('Model')) || null,
      serial_number: serialNumber,
      property_tags: propertyTag ? [propertyTag] : undefined
    };

    const validation = validateBulkAssetCreate(payload, { existingClassification: null });
    if (!validation.valid) {
      invalidRows.push({
        row_number: row.rowNumber,
        item_name: itemName,
        reasons: [validation.message || 'Invalid record']
      });
      continue;
    }

    const sanitized = sanitizeInventoryByClassification({
      ...payload,
      asset_count: validation.asset_count
    });

    validRows.push({
      row_number: row.rowNumber,
      payload: sanitized
    });
  }

  const summary = {
    total_rows: dataRows.length,
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

async function commitValidRows(validRows, userId) {
  let imported = 0;
  let parsGenerated = 0;
  const failures = [];

  // Scan property-tag max at most once per import for consecutive auto-tag rows.
  // Advance only after a successful create so rollbacks do not skip sequences.
  // Invalidate after rows that did not auto-generate tags (manual tags / consumable)
  // so the next auto row re-reads max — same as the previous per-row scan behavior.
  let nextPropertyTagSequence = null;

  for (const row of validRows) {
    try {
      const body = { ...row.payload };
      delete body.item_code;
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

      const result = await InventoryModel.create(body, createOptions);
      if (result?.created_count) imported += result.created_count;

      if (allocatedNextSequence != null) {
        nextPropertyTagSequence = allocatedNextSequence;
      } else {
        nextPropertyTagSequence = null;
      }

      // Same rule as Add Item: 1 asset = 1 PAR for Durable / Semi-Durable.
      // Components (parent_asset_id set) are not created via import.
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
            `Import PAR generation failed for row ${row.row_number}:`,
            docErr.message
          );
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

  return { imported, parsGenerated, failures };
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
