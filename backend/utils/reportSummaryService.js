const pool = require('../config/database');

const REPORT_META = {
  inventory: {
    title: 'Inventory Report',
    statusField: 'status',
    departmentFields: ['department_name', 'category_name']
  },
  'asset-status': {
    title: 'Asset Status Report',
    statusField: 'status',
    departmentFields: ['department_name', 'category_name']
  },
  borrow: {
    title: 'Borrow Report',
    statusField: 'status',
    departmentFields: ['borrower_department']
  },
  return: {
    title: 'Process Return Report',
    statusField: 'condition',
    departmentFields: ['borrower_department']
  },
  supplier: {
    title: 'Supplier Report',
    statusField: null,
    departmentFields: []
  },
  transfers: {
    title: 'Transfer Report',
    statusField: 'status',
    departmentFields: ['to_department_name', 'from_department_name']
  },
  maintenance: {
    title: 'Maintenance Report',
    statusField: 'status',
    departmentFields: ['department_name']
  },
  disposals: {
    title: 'Disposal Report',
    statusField: 'status',
    departmentFields: ['department_name']
  },
  departments: {
    title: 'Department Report',
    statusField: 'status',
    departmentFields: ['name']
  },
  custodians: {
    title: 'Custodian Report',
    statusField: null,
    departmentFields: []
  },
  'low-stock': {
    title: 'Low Stock Report',
    statusField: null,
    departmentFields: []
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

async function resolveDepartmentLabel(filters = {}) {
  if (filters.department_scope_mismatch) return 'No matching department';
  if (!filters.department_id) return 'All Departments';
  const [rows] = await pool.query('SELECT name FROM departments WHERE id = ?', [filters.department_id]);
  return rows[0]?.name || `Department #${filters.department_id}`;
}

function buildReportSummary(reportType, rows = [], filters = {}, options = {}) {
  const meta = REPORT_META[reportType] || { title: 'Report', statusField: 'status', departmentFields: [] };
  const summary = {
    report_type: reportType,
    title: meta.title,
    generated_at: new Date().toISOString(),
    total_records: options.total_records != null ? Number(options.total_records) : rows.length,
    department: options.departmentLabel || 'All Departments',
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
  return {
    rows,
    summary: buildReportSummary(reportType, rows, filters, { departmentLabel })
  };
}

module.exports = {
  buildReportSummary,
  buildReportPayload,
  resolveDepartmentLabel
};
