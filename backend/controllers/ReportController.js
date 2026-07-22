const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const InventoryModel = require('../models/InventoryModel');
const BorrowModel = require('../models/BorrowModel');
const ReturnModel = require('../models/ReturnModel');
const SupplierModel = require('../models/SupplierModel');
const TransferModel = require('../models/TransferModel');
const DisposalModel = require('../models/DisposalModel');
const MaintenanceModel = require('../models/MaintenanceModel');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { parseReportFilters, parseInventoryReportFilters } = require('../utils/reportFilters');
const {
  validateConsumableFilter,
  shouldExcludeConsumableFromLists
} = require('../utils/assetClassification');
const {
  getReportAccessScope,
  getInventoryAccessScope,
  applyReportDepartmentScope
} = require('../utils/roleHelpers');
const { buildReportPayload, buildReportSummary, resolveDepartmentLabel } = require('../utils/reportSummaryService');
const { CONDITION_OPTIONS } = require('../utils/conditionOptions');
const {
  emptyListResult,
  queryWithOptionalPagination,
  parseListPagination
} = require('../utils/listPagination');

const INVENTORY_REPORT_DATE_EXPR = 'COALESCE(i.acquisition_date, DATE(i.created_at))';

function getFilters(query) {
  const filters = parseReportFilters(query);
  const filterError = validateConsumableFilter(filters.asset_classification);
  if (filterError) {
    const err = new Error(filterError);
    err.statusCode = 400;
    throw err;
  }
  if (shouldExcludeConsumableFromLists()) {
    filters.exclude_consumable = true;
  }
  return filters;
}

function getScopedReportFilters(query, user) {
  const filters = getFilters(query);
  const scope = getReportAccessScope(user);
  filters.scope = scope;
  applyReportDepartmentScope(filters, scope);
  return filters;
}

function getBorrowReportFilters(query, user) {
  return getScopedReportFilters(query, user);
}

function getInventoryReportFilters(query, user) {
  const filters = parseInventoryReportFilters(query);
  const filterError = validateConsumableFilter(filters.asset_classification);
  if (filterError) {
    const err = new Error(filterError);
    err.statusCode = 400;
    throw err;
  }
  if (shouldExcludeConsumableFromLists()) {
    filters.exclude_consumable = true;
  }
  // Same visibility as Inventory page: custodians by assigned custodian_id (any department).
  const scope = getInventoryAccessScope(user);
  filters.scope = scope;
  applyReportDepartmentScope(filters, scope);
  filters.date_column = INVENTORY_REPORT_DATE_EXPR;
  return filters;
}

function normalizeListRows(result) {
  return Array.isArray(result) ? result : (result?.data || []);
}

async function sendReportSuccess(res, reportType, rows, filters = {}) {
  const payload = await buildReportPayload(reportType, rows, filters);
  sendSuccess(res, payload);
}

function wantsReportPagination(query = {}) {
  return query.page !== undefined && query.page !== null && query.page !== '';
}

async function sendPaginatedListReport(res, reportType, filters, query, {
  fetchRows,
  fetchAggregates = null
}) {
  if (filters?.department_scope_mismatch) {
    await sendReportSuccess(res, reportType, [], filters);
    return;
  }

  if (!wantsReportPagination(query)) {
    const result = await fetchRows(filters);
    await sendReportSuccess(res, reportType, normalizeListRows(result), filters);
    return;
  }

  filters.paginated = true;
  filters.page = query.page;
  filters.limit = query.limit || 25;

  const [pageResult, aggregates, departmentLabel] = await Promise.all([
    fetchRows(filters),
    fetchAggregates
      ? fetchAggregates(filters)
      : Promise.resolve(null),
    resolveDepartmentLabel(filters)
  ]);

  const rows = normalizeListRows(pageResult);
  const total = aggregates?.total != null
    ? Number(aggregates.total)
    : Number(pageResult?.total ?? rows.length);
  const page = Number(pageResult?.page || parseListPagination(filters)?.page || 1);
  const limit = Number(pageResult?.limit || parseListPagination(filters)?.limit || 25);
  const totalPages = Math.max(1, Math.ceil(total / limit) || 1);

  const summary = buildReportSummary(reportType, [], filters, {
    departmentLabel,
    total_records: total,
    status_breakdown: aggregates?.status_breakdown || {},
    department_breakdown: aggregates?.department_breakdown || {}
  });

  if (reportType === 'custodians' && aggregates?.total_assigned_assets != null) {
    summary.total_assigned_assets = aggregates.total_assigned_assets;
  }
  if (reportType === 'departments' && aggregates?.total_assets != null) {
    summary.total_assets = aggregates.total_assets;
  }

  return res.status(200).json({
    success: true,
    message: 'Success',
    data: { rows, summary },
    pagination: { total, page, limit, totalPages }
  });
}

/** Inventory / asset-status preview: page of rows + full-filter summary aggregates. Exports omit page. */
async function sendPaginatedInventoryReport(res, reportType, filters, query) {
  return sendPaginatedListReport(res, reportType, filters, query, {
    fetchRows: (f) => InventoryModel.getAll(f),
    fetchAggregates: (f) => InventoryModel.getFilterAggregates(f)
  });
}

/** Custodian selected a department outside their scope — match inventory empty behavior. */
function rowsForReportFilters(filters, rows) {
  if (filters?.department_scope_mismatch) {
    return [];
  }
  return rows;
}

const ReportController = {
  async getFilterOptions(req, res) {
    try {
      const scope = getReportAccessScope(req.session.user);
      const dbMaterials = await InventoryModel.getDistinctMaterials();
      const defaultMaterials = [
        'Metal', 'Plastic', 'Wood', 'Paper', 'Glass',
        'Fabric', 'Rubber', 'Electronic', 'Composite', 'Other'
      ];
      const materials = [...new Set([...defaultMaterials, ...dbMaterials])].sort();

      let custodianSql = `
        SELECT u.id, u.full_name
        FROM users u
        JOIN roles r ON u.role_id = r.id
        WHERE u.is_active = 1 AND r.name = 'Custodian'`;
      const custodianParams = [];
      if (scope?.type === 'department' && scope.departmentId) {
        custodianSql += ' AND u.assigned_department_id = ?';
        custodianParams.push(scope.departmentId);
      }
      custodianSql += ' ORDER BY u.full_name ASC';
      const [custodianRows] = await pool.query(custodianSql, custodianParams);

      let departmentSql = 'SELECT id, name FROM departments WHERE is_archived = 0';
      const departmentParams = [];
      if (scope?.type === 'department' && scope.departmentId) {
        departmentSql += ' AND id = ?';
        departmentParams.push(scope.departmentId);
      }
      departmentSql += ' ORDER BY name ASC';
      const [departmentRows] = await pool.query(departmentSql, departmentParams);

      sendSuccess(res, {
        materials,
        custodians: custodianRows,
        departments: departmentRows,
        statuses: [
          'Available',
          'Borrowed',
          'Under Maintenance',
          'Disposed'
        ],
        conditions: [...CONDITION_OPTIONS]
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getInventoryReport(req, res) {
    try {
      const filters = getInventoryReportFilters(req.query, req.session.user);
      await sendPaginatedInventoryReport(res, 'inventory', filters, req.query);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getBorrowReport(req, res) {
    try {
      const filters = getBorrowReportFilters(req.query, req.session.user);
      await sendPaginatedListReport(res, 'borrow', filters, req.query, {
        fetchRows: (f) => BorrowModel.getAll(f),
        fetchAggregates: (f) => BorrowModel.getReportAggregates(f)
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getReturnReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      await sendPaginatedListReport(res, 'return', filters, req.query, {
        fetchRows: (f) => ReturnModel.getAll(f),
        fetchAggregates: (f) => ReturnModel.getReportAggregates(f)
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getLowStockReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      await sendReportSuccess(res, 'low-stock', [], filters);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getSupplierReport(req, res) {
    try {
      const filters = getFilters(req.query);
      if (filters.supplier_name && !filters.name) {
        filters.name = filters.supplier_name;
      }
      await sendPaginatedListReport(res, 'supplier', filters, req.query, {
        fetchRows: (f) => SupplierModel.getAll(f),
        fetchAggregates: (f) => SupplierModel.getReportAggregates(f)
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getTransferReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      await sendPaginatedListReport(res, 'transfers', filters, req.query, {
        fetchRows: (f) => TransferModel.getAll(f),
        fetchAggregates: (f) => TransferModel.getReportAggregates(f)
      });
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getMaintenanceReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      await sendPaginatedListReport(res, 'maintenance', filters, req.query, {
        fetchRows: (f) => MaintenanceModel.getAll(f),
        fetchAggregates: (f) => MaintenanceModel.getReportAggregates(f)
      });
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getDisposalReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      await sendPaginatedListReport(res, 'disposals', filters, req.query, {
        fetchRows: (f) => DisposalModel.getAll(f),
        fetchAggregates: (f) => DisposalModel.getReportAggregates(f)
      });
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getDepartmentReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);

      const fetchDepartmentRows = async (f) => {
        if (f.department_scope_mismatch) return emptyListResult(f);
        const scope = f.scope;
        let whereSql = ' WHERE d.is_archived = 0';
        const params = [];
        if (scope?.type === 'department' && scope.departmentId) {
          whereSql += ' AND d.id = ?';
          params.push(scope.departmentId);
        }
        if (f.department_id) {
          whereSql += ' AND d.id = ?';
          params.push(f.department_id);
        }
        if (f.name) {
          whereSql += ' AND d.name LIKE ?';
          params.push(`%${f.name}%`);
        }
        if (f.code) {
          whereSql += ' AND d.code LIKE ?';
          params.push(`%${f.code}%`);
        }
        if (f.department_head) {
          whereSql += ' AND d.department_head LIKE ?';
          params.push(`%${f.department_head}%`);
        }
        const joins = `
          FROM departments d
          LEFT JOIN users u ON d.custodian_id = u.id`;
        const selectSql = `
          SELECT d.*, u.full_name AS custodian_name,
                 (SELECT COUNT(*) FROM inventory_items i WHERE i.department_id = d.id AND i.is_archived = 0 AND i.status != 'Disposed') AS asset_count
          ${joins}${whereSql}`;
        const countSql = `SELECT COUNT(*) AS total ${joins}${whereSql}`;
        return queryWithOptionalPagination(pool, {
          selectSql,
          countSql,
          params,
          orderBy: 'ORDER BY d.name',
          filters: f
        });
      };

      const fetchDepartmentAggregates = async (f) => {
        const rows = normalizeListRows(await fetchDepartmentRows({
          ...f,
          paginated: false,
          page: undefined,
          limit: undefined
        }));
        const status_breakdown = {};
        const department_breakdown = {};
        let total_assets = 0;
        rows.forEach((row) => {
          const status = row.status || 'Unspecified';
          status_breakdown[status] = (status_breakdown[status] || 0) + 1;
          const name = row.name || 'Unspecified';
          department_breakdown[name] = (department_breakdown[name] || 0) + 1;
          total_assets += Number(row.asset_count || 0);
        });
        return {
          total: rows.length,
          status_breakdown,
          department_breakdown,
          total_assets
        };
      };

      await sendPaginatedListReport(res, 'departments', filters, req.query, {
        fetchRows: fetchDepartmentRows,
        fetchAggregates: fetchDepartmentAggregates
      });
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getAssetStatusReport(req, res) {
    try {
      const filters = getInventoryReportFilters(req.query, req.session.user);
      await sendPaginatedInventoryReport(res, 'asset-status', filters, req.query);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getCustodianReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);

      const buildCustodianParts = (f) => {
        let whereSql = ' WHERE i.status != \'Disposed\'';
        const params = [];
        const scope = f.scope;
        if (scope?.type === 'department' && scope.departmentId) {
          whereSql += ' AND i.department_id = ?';
          params.push(scope.departmentId);
        }
        if (f.department_id) {
          whereSql += ' AND i.department_id = ?';
          params.push(f.department_id);
        }
        if (f.custodian_name) {
          whereSql += ' AND u.full_name LIKE ?';
          params.push(`%${f.custodian_name}%`);
        }
        if (f.custodian_id) {
          whereSql += ' AND u.id = ?';
          params.push(f.custodian_id);
        }
        if (f.email) {
          whereSql += ' AND u.email LIKE ?';
          params.push(`%${f.email}%`);
        }
        const joins = `
          FROM inventory_items i
          JOIN users u ON i.custodian_id = u.id`;
        return { joins, whereSql, params };
      };

      const fetchCustodianRows = async (f) => {
        if (f.department_scope_mismatch) return emptyListResult(f);
        const { joins, whereSql, params } = buildCustodianParts(f);
        const selectSql = `
          SELECT u.full_name AS custodian_name, u.email,
                 COUNT(i.id) AS assigned_assets
          ${joins}${whereSql}
          GROUP BY u.id, u.full_name, u.email`;
        // Count grouped custodians
        const countSql = `
          SELECT COUNT(*) AS total FROM (
            SELECT u.id ${joins}${whereSql} GROUP BY u.id
          ) scoped_custodians`;
        return queryWithOptionalPagination(pool, {
          selectSql,
          countSql,
          params,
          orderBy: 'ORDER BY assigned_assets DESC',
          filters: f
        });
      };

      const fetchCustodianAggregates = async (f) => {
        if (f.department_scope_mismatch) {
          return { total: 0, status_breakdown: {}, department_breakdown: {}, total_assigned_assets: 0 };
        }
        const { joins, whereSql, params } = buildCustodianParts(f);
        const [countRows] = await pool.query(
          `SELECT COUNT(*) AS total FROM (
             SELECT u.id ${joins}${whereSql} GROUP BY u.id
           ) scoped_custodians`,
          params
        );
        const [assetRows] = await pool.query(
          `SELECT COUNT(i.id) AS total_assets ${joins}${whereSql}`,
          params
        );
        return {
          total: Number(countRows[0]?.total || 0),
          status_breakdown: {},
          department_breakdown: {},
          total_assigned_assets: Number(assetRows[0]?.total_assets || 0)
        };
      };

      await sendPaginatedListReport(res, 'custodians', filters, req.query, {
        fetchRows: fetchCustodianRows,
        fetchAggregates: fetchCustodianAggregates
      });
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async exportPDF(req, res) {
    try {
      const { type } = req.params;
      let reportFilters = getFilters(req.query);
      let title, headers, rows, sourceRows = [];

      switch (type) {
        case 'inventory': {
          reportFilters = getInventoryReportFilters(req.query, req.session.user);
          const items = await InventoryModel.getAll(reportFilters);
          sourceRows = items;
          title = 'Inventory Report';
          headers = ['Code', 'Name', 'Property Tag', 'Category', 'Batch ID', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.property_tag, i.category_name, i.batch_id, i.status]);
          break;
        }
        case 'borrow': {
          reportFilters = getBorrowReportFilters(req.query, req.session.user);
          const data = reportFilters.department_scope_mismatch ? [] : await BorrowModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Date', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
          break;
        }
        case 'return': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = reportFilters.department_scope_mismatch ? [] : await ReturnModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Process Return Report';
          headers = ['Code', 'Borrow Code', 'Processed By', 'Process Return Date', 'Condition'];
          rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition]);
          break;
        }
        case 'low-stock': {
          title = 'Low Stock Report';
          headers = ['Note'];
          rows = [['Low stock reporting is not available for property-based inventory.']];
          sourceRows = [];
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll(reportFilters);
          sourceRows = suppliers;
          title = 'Supplier Report';
          headers = ['Name', 'Contact', 'Phone', 'Email'];
          rows = suppliers.map(s => [s.name, s.contact_person, s.phone, s.email]);
          break;
        }
        case 'transfers': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = reportFilters.department_scope_mismatch ? [] : await TransferModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Transfer Report';
          headers = ['Code', 'Item', 'Property Tag', 'From Dept', 'To Dept', 'Status', 'Requested By'];
          rows = data.map(t => [t.transaction_code, t.item_name, t.property_tag, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
          break;
        }
        case 'maintenance': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = reportFilters.department_scope_mismatch ? [] : await MaintenanceModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Maintenance Report';
          headers = ['Item', 'Property Tag', 'Type', 'Scheduled', 'Completed', 'Status', 'Provider'];
          rows = data.map(m => [m.item_name, m.property_tag, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
          break;
        }
        case 'disposals': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = reportFilters.department_scope_mismatch ? [] : await DisposalModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Disposal Report';
          headers = ['Code', 'Item', 'Property Tag', 'Qty', 'Method', 'Status', 'Requested By'];
          rows = data.map(d => [d.transaction_code, d.item_name, d.property_tag, d.quantity, d.disposal_method, d.status, d.requested_by_name]);
          break;
        }
        case 'asset-status': {
          reportFilters = getInventoryReportFilters(req.query, req.session.user);
          const items = await InventoryModel.getAll(reportFilters);
          sourceRows = items;
          title = 'Asset Status Report';
          headers = ['Code', 'Name', 'Classification', 'Department', 'Status', 'Property Tag'];
          rows = items.map(i => [i.item_code, i.item_name, i.asset_classification, i.department_name || i.category_name, i.status, i.property_tag]);
          break;
        }
        case 'departments': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          title = 'Department Report';
          headers = ['Name', 'Code', 'Head', 'Custodian', 'Assets', 'Status'];
          if (reportFilters.department_scope_mismatch) {
            sourceRows = [];
            rows = [];
            break;
          }
          const scope = reportFilters.scope;
          let sql = `
            SELECT d.*, u.full_name AS custodian_name,
                   (SELECT COUNT(*) FROM inventory_items i WHERE i.department_id = d.id AND i.is_archived = 0 AND i.status != 'Disposed') AS asset_count
            FROM departments d LEFT JOIN users u ON d.custodian_id = u.id
            WHERE d.is_archived = 0`;
          const params = [];
          if (scope?.type === 'department' && scope.departmentId) {
            sql += ' AND d.id = ?';
            params.push(scope.departmentId);
          }
          if (reportFilters.department_id) {
            sql += ' AND d.id = ?';
            params.push(reportFilters.department_id);
          }
          if (reportFilters.name) {
            sql += ' AND d.name LIKE ?';
            params.push(`%${reportFilters.name}%`);
          }
          sql += ' ORDER BY d.name';
          const [deptRows] = await pool.query(sql, params);
          sourceRows = deptRows;
          rows = deptRows.map(d => [d.name, d.code, d.department_head, d.custodian_name, d.asset_count, d.status]);
          break;
        }
        case 'custodians': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          title = 'Custodian Report';
          headers = ['Custodian', 'Email', 'Assigned Assets'];
          if (reportFilters.department_scope_mismatch) {
            sourceRows = [];
            rows = [];
            break;
          }
          const scope = reportFilters.scope;
          let sql = `
            SELECT u.full_name AS custodian_name, u.email,
                   COUNT(i.id) AS assigned_assets
            FROM inventory_items i
            JOIN users u ON i.custodian_id = u.id
            WHERE i.status != 'Disposed'`;
          const params = [];
          if (scope?.type === 'department' && scope.departmentId) {
            sql += ' AND i.department_id = ?';
            params.push(scope.departmentId);
          }
          if (reportFilters.department_id) {
            sql += ' AND i.department_id = ?';
            params.push(reportFilters.department_id);
          }
          sql += ` GROUP BY u.id, u.full_name, u.email ORDER BY assigned_assets DESC`;
          const [custRows] = await pool.query(sql, params);
          sourceRows = custRows;
          rows = custRows.map(c => [c.custodian_name, c.email, c.assigned_assets]);
          break;
        }
        default:
          return sendError(res, 'Invalid report type', 400);
      }

      const doc = new PDFDocument({ margin: 50 });
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.pdf"`);
      doc.pipe(res);

      doc.fontSize(13).text('CAVITE INSTITUTE', { align: 'center' });
      doc.fontSize(13).text('PROPERTY MANAGEMENT SYSTEM', { align: 'center' });
      doc.fontSize(14).text(title, { align: 'center' });
      doc.moveDown();
      doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'right' });
      const summary = buildReportSummary(type, sourceRows, reportFilters, {
        departmentLabel: await resolveDepartmentLabel(reportFilters)
      });
      doc.moveDown(0.5);
      doc.fontSize(9).text(`Total Records: ${summary.total_records}`, { align: 'left' });
      doc.text(`Department Scope: ${summary.department}`, { align: 'left' });
      if (summary.date_range?.from || summary.date_range?.to) {
        doc.text(`Date Range: ${summary.date_range.from || '—'} to ${summary.date_range.to || '—'}`, { align: 'left' });
      }
      const statusParts = Object.entries(summary.status_breakdown || {})
        .map(([label, count]) => `${label}: ${count}`);
      if (statusParts.length) {
        doc.text(`Status Breakdown: ${statusParts.join(', ')}`, { align: 'left' });
      }
      const deptParts = Object.entries(summary.department_breakdown || {})
        .slice(0, 8)
        .map(([label, count]) => `${label}: ${count}`);
      if (deptParts.length) {
        doc.text(`Department Breakdown: ${deptParts.join(', ')}`, { align: 'left' });
      }
      doc.moveDown();

      const colWidth = (doc.page.width - 100) / headers.length;
      const startX = 50;
      const cellPadding = 4;
      const pageBottom = doc.page.height - 60;
      doc.fontSize(9);

      let headerHeight = 18;
      doc.font('Helvetica-Bold');
      headers.forEach((header) => {
        const height = doc.heightOfString(header, { width: colWidth - cellPadding }) + 8;
        headerHeight = Math.max(headerHeight, height);
      });

      let y = doc.y;
      headers.forEach((header, i) => {
        doc.text(header, startX + i * colWidth, y, { width: colWidth - cellPadding });
      });
      y += headerHeight;
      doc.moveTo(startX, y).lineTo(doc.page.width - startX, y).stroke();
      y += 5;

      const drawHeaderRow = () => {
        doc.font('Helvetica-Bold');
        headers.forEach((header, i) => {
          doc.text(header, startX + i * colWidth, y, { width: colWidth - cellPadding });
        });
        y += headerHeight;
        doc.moveTo(startX, y).lineTo(doc.page.width - startX, y).stroke();
        y += 5;
        doc.font('Helvetica');
      };

      rows.forEach((row) => {
        doc.font('Helvetica');
        let rowHeight = 16;
        row.forEach((cell) => {
          const height = doc.heightOfString(String(cell || ''), { width: colWidth - cellPadding }) + 8;
          rowHeight = Math.max(rowHeight, height);
        });

        if (y + rowHeight > pageBottom) {
          doc.addPage();
          y = doc.page.margins.top;
          drawHeaderRow();
        }

        row.forEach((cell, i) => {
          doc.text(String(cell || ''), startX + i * colWidth, y, { width: colWidth - cellPadding });
        });
        y += rowHeight;
      });

      doc.end();
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async exportExcel(req, res) {
    try {
      const { type } = req.params;
      const filters = getFilters(req.query);
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cavite Institute Property Management System';
      const sheet = workbook.addWorksheet('Report');

      let title, headers, rows;

      switch (type) {
        case 'inventory': {
          const items = await InventoryModel.getAll(getInventoryReportFilters(req.query, req.session.user));
          title = 'Inventory Report';
          headers = ['Item Code', 'Item Name', 'Property Tag', 'Category', 'Brand', 'Batch ID', 'Status', 'Location', 'Unit Cost'];
          rows = items.map(i => [i.item_code, i.item_name, i.property_tag, i.category_name, i.brand, i.batch_id, i.status, i.location_name, i.unit_cost]);
          break;
        }
        case 'borrow': {
          const borrowFilters = getBorrowReportFilters(req.query, req.session.user);
          const data = borrowFilters.department_scope_mismatch ? [] : await BorrowModel.getAll(borrowFilters);
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Purpose', 'Borrow Date', 'Expected Return', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.purpose, b.borrow_date, b.expected_return_date, b.status]);
          break;
        }
        case 'return': {
          const returnFilters = getScopedReportFilters(req.query, req.session.user);
          const data = returnFilters.department_scope_mismatch ? [] : await ReturnModel.getAll(returnFilters);
          title = 'Process Return Report';
          headers = ['Code', 'Borrow Code', 'Processed By', 'Process Return Date', 'Condition', 'Notes'];
          rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition, r.notes]);
          break;
        }
        case 'low-stock': {
          title = 'Low Stock Report';
          headers = ['Note'];
          rows = [['Low stock reporting is not available for property-based inventory.']];
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll(getFilters(req.query));
          title = 'Supplier Report';
          headers = ['Name', 'Contact Person', 'Phone', 'Email', 'Address'];
          rows = suppliers.map(s => [s.name, s.contact_person, s.phone, s.email, s.address]);
          break;
        }
        case 'transfers': {
          const transferFilters = getScopedReportFilters(req.query, req.session.user);
          const data = transferFilters.department_scope_mismatch ? [] : await TransferModel.getAll(transferFilters);
          title = 'Transfer Report';
          headers = ['Code', 'Item', 'Property Tag', 'From Dept', 'To Dept', 'Status', 'Requested By'];
          rows = data.map(t => [t.transaction_code, t.item_name, t.property_tag, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
          break;
        }
        case 'maintenance': {
          const maintFilters = getScopedReportFilters(req.query, req.session.user);
          const data = maintFilters.department_scope_mismatch ? [] : await MaintenanceModel.getAll(maintFilters);
          title = 'Maintenance Report';
          headers = ['Item', 'Property Tag', 'Type', 'Scheduled', 'Completed', 'Status', 'Provider'];
          rows = data.map(m => [m.item_name, m.property_tag, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
          break;
        }
        case 'disposals': {
          const disposalFilters = getScopedReportFilters(req.query, req.session.user);
          const data = disposalFilters.department_scope_mismatch ? [] : await DisposalModel.getAll(disposalFilters);
          title = 'Disposal Report';
          headers = ['Code', 'Item', 'Property Tag', 'Qty', 'Method', 'Status', 'Requested By'];
          rows = data.map(d => [d.transaction_code, d.item_name, d.property_tag, d.quantity, d.disposal_method, d.status, d.requested_by_name]);
          break;
        }
        case 'asset-status': {
          const items = await InventoryModel.getAll(getInventoryReportFilters(req.query, req.session.user));
          title = 'Asset Status Report';
          headers = ['Code', 'Name', 'Classification', 'Department', 'Status', 'Property Tag'];
          rows = items.map(i => [i.item_code, i.item_name, i.asset_classification, i.department_name || i.category_name, i.status, i.property_tag]);
          break;
        }
        case 'departments': {
          const deptFilters = getScopedReportFilters(req.query, req.session.user);
          title = 'Department Report';
          headers = ['Name', 'Code', 'Head', 'Custodian', 'Assets', 'Status'];
          if (deptFilters.department_scope_mismatch) {
            rows = [];
            break;
          }
          const scope = deptFilters.scope;
          let sql = `
            SELECT d.*, u.full_name AS custodian_name,
                   (SELECT COUNT(*) FROM inventory_items i WHERE i.department_id = d.id AND i.is_archived = 0 AND i.status != 'Disposed') AS asset_count
            FROM departments d LEFT JOIN users u ON d.custodian_id = u.id
            WHERE d.is_archived = 0`;
          const params = [];
          if (scope?.type === 'department' && scope.departmentId) {
            sql += ' AND d.id = ?';
            params.push(scope.departmentId);
          }
          if (deptFilters.department_id) {
            sql += ' AND d.id = ?';
            params.push(deptFilters.department_id);
          }
          if (deptFilters.name) {
            sql += ' AND d.name LIKE ?';
            params.push(`%${deptFilters.name}%`);
          }
          sql += ' ORDER BY d.name';
          const [deptRows] = await pool.query(sql, params);
          rows = deptRows.map(d => [d.name, d.code, d.department_head, d.custodian_name, d.asset_count, d.status]);
          break;
        }
        case 'custodians': {
          const custFilters = getScopedReportFilters(req.query, req.session.user);
          title = 'Custodian Report';
          headers = ['Custodian', 'Email', 'Assigned Assets'];
          if (custFilters.department_scope_mismatch) {
            rows = [];
            break;
          }
          const scope = custFilters.scope;
          let sql = `
            SELECT u.full_name AS custodian_name, u.email,
                   COUNT(i.id) AS assigned_assets
            FROM inventory_items i
            JOIN users u ON i.custodian_id = u.id
            WHERE i.status != 'Disposed'`;
          const params = [];
          if (scope?.type === 'department' && scope.departmentId) {
            sql += ' AND i.department_id = ?';
            params.push(scope.departmentId);
          }
          if (custFilters.department_id) {
            sql += ' AND i.department_id = ?';
            params.push(custFilters.department_id);
          }
          sql += ` GROUP BY u.id, u.full_name, u.email ORDER BY assigned_assets DESC`;
          const [custRows] = await pool.query(sql, params);
          rows = custRows.map(c => [c.custodian_name, c.email, c.assigned_assets]);
          break;
        }
        default:
          return sendError(res, 'Invalid report type', 400);
      }

      sheet.addRow(['CAVITE INSTITUTE PROPERTY MANAGEMENT SYSTEM']);
      sheet.addRow([title]);
      sheet.addRow([`Generated: ${new Date().toLocaleString()}`]);
      sheet.addRow([]);
      sheet.addRow(headers);

      const headerRow = sheet.getRow(5);
      headerRow.font = { bold: true };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF800000' } };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };

      rows.forEach(row => sheet.addRow(row));
      sheet.columns.forEach(col => { col.width = 18; });

      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${type}-report.xlsx"`);
      await workbook.xlsx.write(res);
      res.end();
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  }
};

module.exports = ReportController;
