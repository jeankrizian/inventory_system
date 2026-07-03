const PDFDocument = require('pdfkit');
const ExcelJS = require('exceljs');
const InventoryModel = require('../models/InventoryModel');
const BorrowModel = require('../models/BorrowModel');
const ReturnModel = require('../models/ReturnModel');
const SupplierModel = require('../models/SupplierModel');
const TransferModel = require('../models/TransferModel');
const DisposalModel = require('../models/DisposalModel');
const MaintenanceModel = require('../models/MaintenanceModel');
const DepartmentModel = require('../models/DepartmentModel');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');

const ReportController = {
  async getInventoryReport(req, res) {
    try {
      const items = await InventoryModel.getAll(req.query);
      sendSuccess(res, items);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getBorrowReport(req, res) {
    try {
      const data = await BorrowModel.getAll(req.query);
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getReturnReport(req, res) {
    try {
      const data = await ReturnModel.getAll();
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getLowStockReport(req, res) {
    try {
      const items = await InventoryModel.getAll({ low_stock: true });
      sendSuccess(res, items);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getSupplierReport(req, res) {
    try {
      const suppliers = await SupplierModel.getAll();
      sendSuccess(res, suppliers);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getTransferReport(req, res) {
    try {
      const data = await TransferModel.getAll(req.query);
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getMaintenanceReport(req, res) {
    try {
      const data = await MaintenanceModel.getAll(req.query);
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getDisposalReport(req, res) {
    try {
      const data = await DisposalModel.getAll(req.query);
      sendSuccess(res, data);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getDepartmentReport(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT d.*, u.full_name AS custodian_name,
                (SELECT COUNT(*) FROM inventory_items i WHERE i.department_id = d.id AND i.is_archived = 0 AND i.status != 'Disposed') AS asset_count
         FROM departments d LEFT JOIN users u ON d.custodian_id = u.id
         WHERE d.is_archived = 0
         ORDER BY d.name`
      );
      sendSuccess(res, rows);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getAssetStatusReport(req, res) {
    try {
      const items = await InventoryModel.getAll(req.query);
      sendSuccess(res, items);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async getCustodianReport(req, res) {
    try {
      const [rows] = await pool.query(
        `SELECT u.full_name AS custodian_name, u.email,
                i.custodian_type, COUNT(i.id) AS assigned_assets
         FROM inventory_items i
         JOIN users u ON i.custodian_id = u.id
         WHERE i.status != 'Disposed'
         GROUP BY u.id, u.full_name, u.email, i.custodian_type
         ORDER BY assigned_assets DESC`
      );
      sendSuccess(res, rows);
    } catch (err) { sendError(res, err.message, 500); }
  },

  async exportPDF(req, res) {
    try {
      const { type } = req.params;
      let title, headers, rows;

      switch (type) {
        case 'inventory': {
          const items = await InventoryModel.getAll();
          title = 'Inventory Report';
          headers = ['Code', 'Name', 'Category', 'Qty', 'Available', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.quantity, i.available_quantity, i.status]);
          break;
        }
        case 'borrow': {
          const data = await BorrowModel.getAll();
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Date', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
          break;
        }
        case 'return': {
          const data = await ReturnModel.getAll();
          title = 'Return Report';
          headers = ['Code', 'Borrow Code', 'Returned By', 'Date', 'Condition'];
          rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition]);
          break;
        }
        case 'low-stock': {
          const items = await InventoryModel.getAll({ low_stock: true });
          title = 'Low Stock Report';
          headers = ['Code', 'Name', 'Available', 'Threshold', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.available_quantity, i.low_stock_threshold, i.status]);
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll();
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

      // Table header
      const colWidth = (doc.page.width - 100) / headers.length;
      let y = doc.y;
      headers.forEach((h, i) => {
        doc.font('Helvetica-Bold').text(h, 50 + i * colWidth, y, { width: colWidth });
      });
      y += 20;
      doc.moveTo(50, y).lineTo(doc.page.width - 50, y).stroke();
      y += 5;

      rows.forEach(row => {
        if (y > doc.page.height - 80) {
          doc.addPage();
          y = 50;
        }
        row.forEach((cell, i) => {
          doc.font('Helvetica').text(String(cell || ''), 50 + i * colWidth, y, { width: colWidth });
        });
        y += 18;
      });

      doc.end();
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async exportExcel(req, res) {
    try {
      const { type } = req.params;
      const workbook = new ExcelJS.Workbook();
      workbook.creator = 'Cavite Institute Property Management System';
      const sheet = workbook.addWorksheet('Report');

      let title, headers, rows;

      switch (type) {
        case 'inventory': {
          const items = await InventoryModel.getAll();
          title = 'Inventory Report';
          headers = ['Item Code', 'Item Name', 'Category', 'Brand', 'Quantity', 'Available', 'Unit', 'Status', 'Location'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.brand, i.quantity, i.available_quantity, i.unit, i.status, i.location_name]);
          break;
        }
        case 'borrow': {
          const data = await BorrowModel.getAll();
          title = 'Borrow Report';
          headers = ['Code', 'Borrower', 'Department', 'Purpose', 'Borrow Date', 'Expected Return', 'Status'];
          rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.purpose, b.borrow_date, b.expected_return_date, b.status]);
          break;
        }
        case 'return': {
          const data = await ReturnModel.getAll();
          title = 'Return Report';
          headers = ['Code', 'Borrow Code', 'Returned By', 'Return Date', 'Condition', 'Notes'];
          rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition, r.notes]);
          break;
        }
        case 'low-stock': {
          const items = await InventoryModel.getAll({ low_stock: true });
          title = 'Low Stock Report';
          headers = ['Item Code', 'Item Name', 'Category', 'Available', 'Threshold', 'Status'];
          rows = items.map(i => [i.item_code, i.item_name, i.category_name, i.available_quantity, i.low_stock_threshold, i.status]);
          break;
        }
        case 'supplier': {
          const suppliers = await SupplierModel.getAll();
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
      sendError(res, err.message, 500);
    }
  }
};

module.exports = ReportController;
