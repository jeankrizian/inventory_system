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
const { getAccessScope } = require('../utils/roleHelpers');

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
  filters.scope = getAccessScope(user);
  return filters;
}

function getBorrowReportFilters(query, user) {
  const filters = getScopedReportFilters(query, user);
  const scope = filters.scope;
  if (scope?.type === 'department' && scope.departmentId) {
    if (filters.department_id && filters.department_id !== scope.departmentId) {
      delete filters.department_id;
    }
  }
  return filters;
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
  filters.scope = getAccessScope(user);

  const scope = filters.scope;
  if (
    scope?.type === 'department' &&
    scope.departmentId &&
    filters.department_id &&
    filters.department_id !== scope.departmentId
  ) {
    filters.department_scope_mismatch = true;
  }

  return filters;
}

const ReportController = {
  async getFilterOptions(req, res) {
    try {
      const dbMaterials = await InventoryModel.getDistinctMaterials();
      const defaultMaterials = [
        'Metal', 'Plastic', 'Wood', 'Paper', 'Glass',
        'Fabric', 'Rubber', 'Electronic', 'Composite', 'Other'
      ];
      const materials = [...new Set([...defaultMaterials, ...dbMaterials])].sort();
      sendSuccess(res, {
        materials,
        statuses: [
          'Available',
          'Low Stock',
          'Out of Stock',
          'Under Maintenance'
        ],
        conditions: ['New', 'Good', 'Fair', 'Poor', 'Damaged']
      });
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getInventoryReport(req, res) {
    try {
      const items = await InventoryModel.getAll(getInventoryReportFilters(req.query, req.session.user));
      sendSuccess(res, items);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getBorrowReport(req, res) {
    try {
      const data = await BorrowModel.getAll(getBorrowReportFilters(req.query, req.session.user));
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getReturnReport(req, res) {
    try {
      const data = await ReturnModel.getAll(getScopedReportFilters(req.query, req.session.user));
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getLowStockReport(req, res) {
    try {
      const filters = getInventoryReportFilters(req.query, req.session.user);
      filters.low_stock = true;
      const items = await InventoryModel.getAll(filters);
      sendSuccess(res, items);
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
      sendSuccess(res, suppliers);
    } catch (err) {
      sendError(res, err.message, err.statusCode || 500);
    }
  },

  async getTransferReport(req, res) {
    try {
      const data = await TransferModel.getAll(getScopedReportFilters(req.query, req.session.user));
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getMaintenanceReport(req, res) {
    try {
      const data = await MaintenanceModel.getAll(getScopedReportFilters(req.query, req.session.user));
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getDisposalReport(req, res) {
    try {
      const data = await DisposalModel.getAll(getScopedReportFilters(req.query, req.session.user));
      sendSuccess(res, data);
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
      sendSuccess(res, rows);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async getAssetStatusReport(req, res) {
    try {
      const items = await InventoryModel.getAll(getInventoryReportFilters(req.query, req.session.user));
      sendSuccess(res, items);
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
      if (filters.email) {
        sql += ' AND u.email LIKE ?';
        params.push(`%${filters.email}%`);
      }
      sql += ` GROUP BY u.id, u.full_name, u.email
        ORDER BY assigned_assets DESC`;
      const [rows] = await pool.query(sql, params);
      sendSuccess(res, rows);
    } catch (err) { sendError(res, err.message, err.statusCode || 500); }
  },

  async exportPDF(req, res) {
    try {
      const { type } = req.params;
      const filters = getFilters(req.query);
      let title, headers, rows;

      switch (type) {
        case 'inventory': {
          const items = await InventoryModel.getAll(getInventoryReportFilters(req.query, req.session.user));
          title = 'Inventory Report';
          headers = ['Code', 'Name', 'Category', 'Qty', 'Available', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.quantity, i.available_quantity, i.status]);
          break;
        }
        case 'borrow': {
          const data = await BorrowModel.getAll(getBorrowReportFilters(req.query, req.session.user));
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Date', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
          break;
        }
        case 'return': {
          const data = await ReturnModel.getAll(getScopedReportFilters(req.query, req.session.user));
          title = 'Process Return Report';
          headers = ['Code', 'Borrow Code', 'Processed By', 'Process Return Date', 'Condition'];
          rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition]);
          break;
        }
        case 'low-stock': {
          const lowStockFilters = { ...getInventoryReportFilters(req.query, req.session.user), low_stock: true };
          const items = await InventoryModel.getAll(lowStockFilters);
          title = 'Low Stock Report';
          headers = ['Code', 'Name', 'Available', 'Threshold', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.available_quantity, i.low_stock_threshold, i.status]);
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll(getFilters(req.query));
          title = 'Supplier Report';
          headers = ['Name', 'Contact', 'Phone', 'Email'];
          rows = suppliers.map(s => [s.name, s.contact_person, s.phone, s.email]);
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
          headers = ['Item Code', 'Item Name', 'Category', 'Brand', 'Quantity', 'Available', 'Unit', 'Status', 'Location'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.brand, i.quantity, i.available_quantity, i.unit, i.status, i.location_name]);
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
          const lowStockFilters = { ...getInventoryReportFilters(req.query, req.session.user), low_stock: true };
          const items = await InventoryModel.getAll(lowStockFilters);
          title = 'Low Stock Report';
          headers = ['Item Code', 'Item Name', 'Category', 'Available', 'Threshold', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.available_quantity, i.low_stock_threshold, i.status]);
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll(getFilters(req.query));
          title = 'Supplier Report';
          headers = ['Name', 'Contact Person', 'Phone', 'Email', 'Address'];
          rows = suppliers.map(s => [s.name, s.contact_person, s.phone, s.email, s.address]);
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
