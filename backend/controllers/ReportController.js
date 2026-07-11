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
const { getReportAccessScope, applyReportDepartmentScope } = require('../utils/roleHelpers');
const { buildReportPayload, buildReportSummary, resolveDepartmentLabel } = require('../utils/reportSummaryService');

const INVENTORY_REPORT_DATE_EXPR = 'COALESCE(i.acquisition_date, i.purchase_date, DATE(i.created_at))';

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
  const scope = getReportAccessScope(user);
  filters.scope = scope;
  applyReportDepartmentScope(filters, scope);
  filters.date_column = INVENTORY_REPORT_DATE_EXPR;
  return filters;
}

async function sendReportSuccess(res, reportType, rows, filters = {}) {
  const payload = await buildReportPayload(reportType, rows, filters);
  sendSuccess(res, payload);
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
        conditions: ['New', 'Good', 'Fair', 'Poor', 'Damaged']
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getInventoryReport(req, res) {
    try {
      const filters = getInventoryReportFilters(req.query, req.session.user);
      const items = await InventoryModel.getAll(filters);
      await sendReportSuccess(res, 'inventory', items, filters);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getBorrowReport(req, res) {
    try {
      const filters = getBorrowReportFilters(req.query, req.session.user);
      const data = await BorrowModel.getAll(filters);
      await sendReportSuccess(res, 'borrow', data, filters);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getReturnReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const data = await ReturnModel.getAll(filters);
      await sendReportSuccess(res, 'return', data, filters);
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
      const suppliers = await SupplierModel.getAll(filters);
      await sendReportSuccess(res, 'supplier', suppliers, filters);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getTransferReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const data = await TransferModel.getAll(filters);
      await sendReportSuccess(res, 'transfers', data, filters);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getMaintenanceReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const data = await MaintenanceModel.getAll(filters);
      await sendReportSuccess(res, 'maintenance', data, filters);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getDisposalReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const data = await DisposalModel.getAll(filters);
      await sendReportSuccess(res, 'disposals', data, filters);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getDepartmentReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const scope = filters.scope;
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
      if (filters.department_id) {
        sql += ' AND d.id = ?';
        params.push(filters.department_id);
      }
      if (filters.name) {
        sql += ' AND d.name LIKE ?';
        params.push(`%${filters.name}%`);
      }
      if (filters.code) {
        sql += ' AND d.code LIKE ?';
        params.push(`%${filters.code}%`);
      }
      if (filters.department_head) {
        sql += ' AND d.department_head LIKE ?';
        params.push(`%${filters.department_head}%`);
      }
      sql += ' ORDER BY d.name';
      const [rows] = await pool.query(sql, params);
      await sendReportSuccess(res, 'departments', rows, filters);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getAssetStatusReport(req, res) {
    try {
      const filters = getInventoryReportFilters(req.query, req.session.user);
      const items = await InventoryModel.getAll(filters);
      await sendReportSuccess(res, 'asset-status', items, filters);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getCustodianReport(req, res) {
    try {
      const filters = getScopedReportFilters(req.query, req.session.user);
      const scope = filters.scope;
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
      if (filters.department_id) {
        sql += ' AND i.department_id = ?';
        params.push(filters.department_id);
      }
      if (filters.custodian_name) {
        sql += ' AND u.full_name LIKE ?';
        params.push(`%${filters.custodian_name}%`);
      }
      if (filters.custodian_id) {
        sql += ' AND u.id = ?';
        params.push(filters.custodian_id);
      }
      if (filters.email) {
        sql += ' AND u.email LIKE ?';
        params.push(`%${filters.email}%`);
      }
      sql += ` GROUP BY u.id, u.full_name, u.email
        ORDER BY assigned_assets DESC`;
      const [rows] = await pool.query(sql, params);
      await sendReportSuccess(res, 'custodians', rows, filters);
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
          const data = await BorrowModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Date', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
          break;
        }
        case 'return': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = await ReturnModel.getAll(reportFilters);
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
          const data = await TransferModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Transfer Report';
          headers = ['Code', 'Item', 'Property Tag', 'From Dept', 'To Dept', 'Status', 'Requested By'];
          rows = data.map(t => [t.transaction_code, t.item_name, t.property_tag, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
          break;
        }
        case 'maintenance': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = await MaintenanceModel.getAll(reportFilters);
          sourceRows = data;
          title = 'Maintenance Report';
          headers = ['Item', 'Property Tag', 'Type', 'Scheduled', 'Completed', 'Status', 'Provider'];
          rows = data.map(m => [m.item_name, m.property_tag, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
          break;
        }
        case 'disposals': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
          const data = await DisposalModel.getAll(reportFilters);
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
          title = 'Department Report';
          headers = ['Name', 'Code', 'Head', 'Custodian', 'Assets', 'Status'];
          rows = deptRows.map(d => [d.name, d.code, d.department_head, d.custodian_name, d.asset_count, d.status]);
          break;
        }
        case 'custodians': {
          reportFilters = getScopedReportFilters(req.query, req.session.user);
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
          title = 'Custodian Report';
          headers = ['Custodian', 'Email', 'Assigned Assets'];
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
          const data = await BorrowModel.getAll(getBorrowReportFilters(req.query, req.session.user));
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Purpose', 'Borrow Date', 'Expected Return', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.purpose, b.borrow_date, b.expected_return_date, b.status]);
          break;
        }
        case 'return': {
          const data = await ReturnModel.getAll(getScopedReportFilters(req.query, req.session.user));
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
          const data = await TransferModel.getAll(getScopedReportFilters(req.query, req.session.user));
          title = 'Transfer Report';
          headers = ['Code', 'Item', 'Property Tag', 'From Dept', 'To Dept', 'Status', 'Requested By'];
          rows = data.map(t => [t.transaction_code, t.item_name, t.property_tag, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
          break;
        }
        case 'maintenance': {
          const data = await MaintenanceModel.getAll(getScopedReportFilters(req.query, req.session.user));
          title = 'Maintenance Report';
          headers = ['Item', 'Property Tag', 'Type', 'Scheduled', 'Completed', 'Status', 'Provider'];
          rows = data.map(m => [m.item_name, m.property_tag, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
          break;
        }
        case 'disposals': {
          const data = await DisposalModel.getAll(getScopedReportFilters(req.query, req.session.user));
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
          const filters = getScopedReportFilters(req.query, req.session.user);
          const scope = filters.scope;
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
          if (filters.department_id) {
            sql += ' AND d.id = ?';
            params.push(filters.department_id);
          }
          if (filters.name) {
            sql += ' AND d.name LIKE ?';
            params.push(`%${filters.name}%`);
          }
          sql += ' ORDER BY d.name';
          const [deptRows] = await pool.query(sql, params);
          title = 'Department Report';
          headers = ['Name', 'Code', 'Head', 'Custodian', 'Assets', 'Status'];
          rows = deptRows.map(d => [d.name, d.code, d.department_head, d.custodian_name, d.asset_count, d.status]);
          break;
        }
        case 'custodians': {
          const filters = getScopedReportFilters(req.query, req.session.user);
          const scope = filters.scope;
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
          if (filters.department_id) {
            sql += ' AND i.department_id = ?';
            params.push(filters.department_id);
          }
          sql += ` GROUP BY u.id, u.full_name, u.email ORDER BY assigned_assets DESC`;
          const [custRows] = await pool.query(sql, params);
          title = 'Custodian Report';
          headers = ['Custodian', 'Email', 'Assigned Assets'];
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
