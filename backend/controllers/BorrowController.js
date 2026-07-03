const BorrowModel = require('../models/BorrowModel');
const ReturnModel = require('../models/ReturnModel');
const InventoryModel = require('../models/InventoryModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { generateCode } = require('../utils/helpers');
const { notifyAdmins, notifyUser } = require('../utils/notificationService');
const { canBorrow } = require('../utils/assetClassification');
const DocumentService = require('../utils/documentService');

const BorrowController = {
  async getAll(req, res) {
    try {
      const transactions = await BorrowModel.getAll({
        status: req.query.status,
        search: req.query.search
      });
      sendSuccess(res, transactions);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      sendSuccess(res, transaction);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const { borrower_name, borrower_department, purpose, borrow_date, expected_return_date, notes, items } = req.body;

      if (!items || items.length === 0) {
        return sendError(res, 'At least one item is required', 400);
      }

      // Validate availability
      for (const item of items) {
        const inv = await InventoryModel.findById(item.inventory_item_id);
        if (!inv) return sendError(res, `Item ID ${item.inventory_item_id} not found`, 400);
        if (!canBorrow(inv.asset_classification)) {
          return sendError(res, `Borrowing is not available for ${inv.item_name}`, 400);
        }
        if (inv.available_quantity < item.quantity) {
          return sendError(res, `Insufficient stock for ${inv.item_name}`, 400);
        }
      }

      const transactionCode = generateCode('BRW');
      const id = await BorrowModel.create({
        transaction_code: transactionCode,
        borrower_id: req.session.user.id,
        borrower_name,
        borrower_department,
        purpose,
        borrow_date,
        expected_return_date,
        notes,
        status: 'Pending'
      }, items);

      await logActivity(req.session.user.id, 'BORROW', 'Borrow', `Created borrow request ${transactionCode}`, req.ip);
      const transaction = await BorrowModel.findById(id);

      const itemNames = transaction.items.map(i => i.item_name).join(', ');
      await notifyAdmins({
        title: 'New Borrow Request',
        message: `${borrower_name} submitted a borrow request (${transactionCode}) for ${itemNames}.`,
        type: 'borrow_request',
        reference_id: id,
        link_url: '/pages/orders.html'
      });

      sendSuccess(res, transaction, 'Borrow request created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async approve(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      if (transaction.status !== 'Pending') {
        return sendError(res, 'Only pending transactions can be approved', 400);
      }

      // Deduct inventory
      for (const item of transaction.items) {
        const success = await InventoryModel.adjustQuantity(item.inventory_item_id, -item.quantity);
        if (!success) {
          return sendError(res, `Insufficient stock for item ${item.item_name}`, 400);
        }
      }

      await BorrowModel.updateStatus(req.params.id, 'Borrowed', req.session.user.id);
      await logActivity(req.session.user.id, 'APPROVE', 'Borrow', `Approved ${transaction.transaction_code}`, req.ip);

      await notifyUser(transaction.borrower_id, {
        title: 'Borrow Request Approved',
        message: `Your request to borrow (${transaction.transaction_code}) has been approved.`,
        type: 'borrow_approved',
        reference_id: transaction.id,
        link_url: '/pages/orders.html'
      });

      const updated = await BorrowModel.findById(req.params.id);

      let generatedDocument = null;
      try {
        const doc = await DocumentService.generateABLForBorrow(req.params.id, req.session.user.id);
        generatedDocument = { id: doc.id, document_number: doc.document_number, document_type: 'ABL' };
      } catch (docErr) {
        console.error('ABL generation failed:', docErr.message);
      }

      sendSuccess(res, { ...updated, generated_document: generatedDocument }, 'Borrow request approved');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async reject(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      if (transaction.status !== 'Pending') {
        return sendError(res, 'Only pending transactions can be rejected', 400);
      }

      await BorrowModel.updateStatus(req.params.id, 'Rejected', req.session.user.id);
      await logActivity(req.session.user.id, 'REJECT', 'Borrow', `Rejected ${transaction.transaction_code}`, req.ip);

      await notifyUser(transaction.borrower_id, {
        title: 'Borrow Request Rejected',
        message: `Your request to borrow (${transaction.transaction_code}) has been rejected.`,
        type: 'borrow_rejected',
        reference_id: transaction.id,
        link_url: '/pages/orders.html'
      });

      const updated = await BorrowModel.findById(req.params.id);
      sendSuccess(res, updated, 'Borrow request rejected');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async processReturn(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      if (!['Borrowed', 'Approved', 'Overdue'].includes(transaction.status)) {
        return sendError(res, 'Transaction cannot be returned in current status', 400);
      }

      const returnCode = generateCode('RTN');
      const returnId = await ReturnModel.create({
        transaction_code: returnCode,
        borrow_transaction_id: transaction.id,
        returned_by: req.session.user.id,
        return_date: req.body.return_date || new Date().toISOString().split('T')[0],
        condition: req.body.condition || 'Good',
        notes: req.body.notes
      });

      await logActivity(req.session.user.id, 'RETURN', 'Return', `Processed return ${returnCode}`, req.ip);

      const itemNames = (transaction.items || []).map(i => i.item_name).join(', ');
      await notifyAdmins({
        title: 'Item Returned',
        message: `${transaction.borrower_name} returned items (${returnCode}): ${itemNames}.`,
        type: 'borrow_returned',
        reference_id: transaction.id,
        link_url: '/pages/orders.html'
      });

      await notifyUser(transaction.borrower_id, {
        title: 'Return Recorded',
        message: `Your returned item (${returnCode}) has been successfully processed.`,
        type: 'return_recorded',
        reference_id: transaction.id,
        link_url: '/pages/orders.html'
      });

      sendSuccess(res, { id: returnId, transaction_code: returnCode }, 'Item returned successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getReturns(req, res) {
    try {
      const returns = await ReturnModel.getAll();
      sendSuccess(res, returns);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = BorrowController;
