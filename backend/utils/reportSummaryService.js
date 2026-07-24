const pool = require('../config/database');

const REPORT_META = {
  inventory: {
    title: 'Inventory Report',
    statusField: 'status',
    departmentFields: ['department_name', 'category_name'],
    locationFields: ['location_name'],
    custodianFields: ['custodian_name']
  },
  'asset-status': {
    title: 'Asset Status Report',
    statusField: 'status',
    departmentFields: ['department_name', 'category_name'],
    locationFields: ['location_name'],
    custodianFields: ['custodian_name']
  },
  borrow: {
    title: 'Borrow Report',
    statusField: 'status',
    departmentFields: ['borrower_department'],
    locationFields: [],
    custodianFields: []
  },
  return: {
    title: 'Process Return Report',
    statusField: 'condition',
    departmentFields: ['borrower_department'],
    locationFields: [],
    custodianFields: []
  },
  supplier: {
    title: 'Supplier Report',
    statusField: null,
    departmentFields: [],
    locationFields: [],
    custodianFields: []
  },
  transfers: {
    title: 'Transfer Report',
    statusField: 'status',
    departmentFields: ['to_department_name', 'from_department_name'],
    locationFields: ['to_location_name', 'from_location_name'],
    custodianFields: []
  },
  maintenance: {
    title: 'Maintenance Report',
    statusField: 'status',
    departmentFields: ['department_name'],
    locationFields: ['location_name'],
    custodianFields: ['custodian_name']
  },
  disposals: {
    title: 'Disposal Report',
    statusField: 'status',
    departmentFields: ['department_name'],
    locationFields: ['location_name'],
    custodianFields: ['custodian_name']
  },
  departments: {
    title: 'Department Report',
    statusField: 'status',
    departmentFields: ['name'],
    locationFields: [],
    custodianFields: ['custodian_name']
  },
  custodians: {
    title: 'Custodian Report',
    statusField: null,
    departmentFields: [],
    locationFields: [],
    custodianFields: ['custodian_name']
  },
  'low-stock': {
    title: 'Low Stock Report',
    statusField: null,
    departmentFields: [],
    locationFields: [],
    custodianFields: []
  }
};

function countByField(rows, field, fallbackFields = []) {
  const counts = {};
  for (const row of rows || []) {
    let value = field ? row[field] : null;
    if ((value == null || value === '') && fallbackFields.length) {
      for (const fallback of fallbackFields) {
        if (row[fallback] != null && row[fallback] !== '') {
          value = row[fallback];
          break;
        }
      }
    }
    const key = value != null && String(value).trim() !== '' ? String(value).trim() : 'Unspecified';
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}

function formatDateRange(filters = {}) {
  const from = filters.date_from || null;
  const to = filters.date_to || null;
  if (!from && !to) return null;
  return { from, to };
}

function formatDisplayDate(value = new Date()) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return String(value || '');
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

function getRowFieldValue(row, fields = []) {
  for (const field of fields) {
    if (row?.[field] != null && String(row[field]).trim() !== '') {
      return String(row[field]).trim();
    }
  }
  return null;
}

/** Returns the shared value when every row has the same non-empty value; otherwise null. */
function getUniformFieldValue(rows = [], fields = []) {
  if (!fields.length || !rows.length) return null;
  let common = getRowFieldValue(rows[0], fields);
  for (let i = 1; i < rows.length; i += 1) {
    const value = getRowFieldValue(rows[i], fields);
    if ((value || null) !== (common || null)) return null;
  }
  return common;
}

async function resolveDepartmentLabel(filters = {}) {
  if (filters.department_scope_mismatch) return 'No matching department';
  if (!filters.department_id) return 'All Departments';
  try {
    const [rows] = await pool.query('SELECT name FROM departments WHERE id = ?', [filters.department_id]);
    return rows[0]?.name || `Department #${filters.department_id}`;
  } catch (_err) {
    return `Department #${filters.department_id}`;
  }
}

async function resolveLocationLabel(filters = {}) {
  if (!filters.location_id) return null;
  try {
    const [rows] = await pool.query('SELECT name FROM locations WHERE id = ?', [filters.location_id]);
    return rows[0]?.name || `Location #${filters.location_id}`;
  } catch (_err) {
    return `Location #${filters.location_id}`;
  }
}

async function resolveCustodianLabel(filters = {}) {
  if (!filters.custodian_id) return null;
  try {
    const [rows] = await pool.query('SELECT full_name FROM users WHERE id = ?', [filters.custodian_id]);
    return rows[0]?.full_name || `Custodian #${filters.custodian_id}`;
  } catch (_err) {
    return `Custodian #${filters.custodian_id}`;
  }
}

function resolveGeneratedBy(user) {
  if (!user) return null;
  const name = user.full_name || user.name || user.username || null;
  return name ? String(name).trim() || null : null;
}

/**
 * Header metadata for PDF/Excel exports.
 * Prefer uniform values from result rows; fall back to filter labels.
 */
async function buildExportHeaderMeta(reportType, rows = [], filters = {}, user = null) {
  const meta = REPORT_META[reportType] || {
    title: 'Report',
    departmentFields: [],
    locationFields: [],
    custodianFields: []
  };

  let department = getUniformFieldValue(rows, meta.departmentFields || []);
  let location = getUniformFieldValue(rows, meta.locationFields || []);
  let custodian = getUniformFieldValue(rows, meta.custodianFields || []);

  if (!department && filters.department_id) {
    const label = await resolveDepartmentLabel(filters);
    if (label && label !== 'All Departments') department = label;
  }
  if (!location && filters.location_id) {
    location = await resolveLocationLabel(filters);
  }
  if (!custodian && filters.custodian_id) {
    custodian = await resolveCustodianLabel(filters);
  }

  return {
    title: meta.title || 'Report',
    department: department || null,
    location: location || null,
    custodian: custodian || null,
    generated_at: new Date(),
    generated_at_label: formatDisplayDate(new Date()),
    generated_by: resolveGeneratedBy(user),
    total_records: rows.length,
    date_range: formatDateRange(filters),
    status_filter: filters.status || null
  };
}

function buildReportSummary(reportType, rows = [], filters = {}, options = {}) {
  const meta = REPORT_META[reportType] || { title: 'Report', statusField: 'status', departmentFields: [] };
  const summary = {
    report_type: reportType,
    title: meta.title,
    generated_at: new Date().toISOString(),
    total_records: options.total_records != null ? Number(options.total_records) : rows.length,
    department: options.departmentLabel || 'All Departments',
    location: options.locationLabel || null,
    custodian: options.custodianLabel || null,
    generated_by: options.generatedBy || null,
    date_range: formatDateRange(filters),
    status_filter: filters.status || null,
    status_breakdown: {},
    department_breakdown: {}
  };

  if (options.status_breakdown) {
    summary.status_breakdown = options.status_breakdown;
  } else if (meta.statusField) {
    summary.status_breakdown = countByField(rows, meta.statusField);
  }

  if (options.department_breakdown) {
    summary.department_breakdown = options.department_breakdown;
  } else if (meta.departmentFields.length) {
    summary.department_breakdown = countByField(rows, meta.departmentFields[0], meta.departmentFields.slice(1));
  }

  if (reportType === 'custodians') {
    summary.total_assigned_assets = rows.reduce((sum, row) => sum + Number(row.assigned_assets || 0), 0);
  }

  if (reportType === 'departments') {
    summary.total_assets = rows.reduce((sum, row) => sum + Number(row.asset_count || 0), 0);
  }

  return summary;
}

async function buildReportPayload(reportType, rows, filters = {}) {
  const departmentLabel = await resolveDepartmentLabel(filters);
  const locationLabel = await resolveLocationLabel(filters);
  const custodianLabel = await resolveCustodianLabel(filters);
  return {
    rows,
    summary: buildReportSummary(reportType, rows, filters, {
      departmentLabel,
      locationLabel,
      custodianLabel
    })
  };
}

module.exports = {
  buildReportSummary,
  buildReportPayload,
  buildExportHeaderMeta,
  resolveDepartmentLabel,
  resolveLocationLabel,
  resolveCustodianLabel,
  formatDisplayDate,
  getUniformFieldValue
};
