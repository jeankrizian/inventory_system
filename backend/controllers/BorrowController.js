const BorrowModel = require('../models/BorrowModel');
const ReturnModel = require('../models/ReturnModel');
const InventoryModel = require('../models/InventoryModel');
const DepartmentModel = require('../models/DepartmentModel');
const pool = require('../config/database');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { generateCode } = require('../utils/helpers');
const { notifyPropertyManagers, notifyUser, notifyCustodiansForBorrowTransaction, actorExcludeOptions } = require('../utils/notificationService');
const { borrowLink } = require('../utils/notificationLinks');
const { getBorrowListScope, borrowTransactionMatchesScope, getAccessScope, itemMatchesScope, getBorrowCatalogScope } = require('../utils/roleHelpers');
const {
  expandBorrowRequestItems,
  previewBorrowAllocation
} = require('../utils/borrowAssetService');
const DocumentService = require('../utils/documentService');
const { buildAssetNotificationMessage } = require('../utils/assetNotificationHelper');

function formatPropertyTags(items = []) {
  const tags = [...new Set(items.map((item) => item.property_tag).filter(Boolean))];
  return tags.length ? tags.join(', ') : null;
}

function formatItemNames(items = []) {
  const names = [...new Set(items.map((item) => item.item_name).filter(Boolean))];
  return names.length ? names.join(', ') : null;
}

async function resolveBorrowerContext(user) {
  const borrower_id = user.id;
  const requested_by = user.id;
  let borrower_department_id = user.assigned_department_id ?? null;
  let borrower_department = user.assigned_department_name || null;

  if (borrower_department_id && !borrower_department) {
    const department = await DepartmentModel.findById(borrower_department_id);
    borrower_department = department?.name || null;
  }

  return {
    borrower_id,
    requested_by,
    borrower_department_id,
    borrower_department
  };
}

function sanitizeBorrowForClient(transaction) {
  if (!transaction) return transaction;

  const showAssignedAssets = ['Pending', 'Borrowed', 'Approved', 'Returned', 'Overdue'].includes(transaction.status);
  const items = (transaction.items || []).map((item) => {
    const sanitized = { ...item };
    if (!showAssignedAssets) {
      delete sanitized.property_tag;
    }
    return sanitized;
  });

  return {
    ...transaction,
    items,
    show_assigned_assets: showAssignedAssets
  };
}

const BorrowController = {
  async getAll(req, res) {
    try {
      const scope = getBorrowListScope(req.session.user);
      const filters = {
        status: req.query.status,
        search: req.query.search
      };

      if (scope.type === 'own') {
        filters.borrower_id = scope.userId;
      } else if (scope.type === 'none') {
        return sendSuccess(res, []);
      } else if (scope.type !== 'all') {
        filters.scope = scope;
      }

      const transactions = await BorrowModel.getAll(filters);
      sendSuccess(res, transactions);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getBorrowableItems(req, res) {
    try {
      // Cross-department catalog — intentionally ignores custodian department scope
      const catalogScope = getBorrowCatalogScope();
      if (catalogScope.type !== 'all') {
        return sendError(res, 'Borrow catalog is unavailable', 403);
      }

      const search = req.query.search || '';
      const items = await InventoryModel.getBorrowableItems(search);
      sendSuccess(res, items);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getModelAssets(req, res) {
    try {
      const itemCode = req.params.itemCode;
      const limit = Math.min(parseInt(req.query.limit, 10) || 10, 50);
      const assets = await InventoryModel.getAvailableAssetsForModel(itemCode, limit);
      sendSuccess(res, assets);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async previewAllocation(req, res) {
    try {
      const { items } = req.body;
      if (!items || !items.length) {
        return sendError(res, 'At least one item is required', 400);
      }
      const preview = await previewBorrowAllocation(items);
      sendSuccess(res, preview);
    } catch (err) {
      sendError(res, err.message, 400);
    }
  },

  async getById(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);

      const scope = getBorrowListScope(req.session.user);
      if (scope.type === 'none') {
        return sendError(res, 'Access denied', 403);
      }
      if (!borrowTransactionMatchesScope(transaction, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      sendSuccess(res, sanitizeBorrowForClient(transaction));
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const borrower_name = req.session.user.full_name;
      if (!borrower_name) {
        return sendError(res, 'Authenticated user name is required', 400);
      }

      // Borrow is cross-department: do not restrict requested assets by borrower department
      const borrowerContext = await resolveBorrowerContext(req.session.user);
      const { purpose, borrow_date, expected_return_date, notes, items } = req.body;

      const normalizedPurpose = purpose != null ? String(purpose).trim() : '';
      if (!normalizedPurpose) {
        return sendError(res, 'Purpose is required', 400);
      }

      if (!items || items.length === 0) {
        return sendError(res, 'At least one item is required', 400);
      }

      const allocatedItems = await expandBorrowRequestItems(items);

      const transactionCode = generateCode('BRW');
      const id = await BorrowModel.create({
        transaction_code: transactionCode,
        borrower_id: borrowerContext.borrower_id,
        borrower_name,
        requested_by: borrowerContext.requested_by,
        borrower_department: borrowerContext.borrower_department,
        borrower_department_id: borrowerContext.borrower_department_id,
        purpose: normalizedPurpose,
        borrow_date,
        expected_return_date,
        notes,
        status: 'Pending'
      }, allocatedItems);

      await logActivity(req.session.user.id, 'BORROW', 'Borrow', `Created borrow request ${transactionCode}`, req.ip, {
        entity_type: 'borrow_transaction',
        entity_id: id,
        reference_code: transactionCode,
        field_name: 'status',
        old_value: null,
        new_value: 'Pending'
      });
      const transaction = await BorrowModel.findById(id);
      const itemSummary = formatItemNames(transaction.items);

      await notifyPropertyManagers({
        title: 'New Borrow Request',
        message: buildAssetNotificationMessage({
          action: 'Borrow request submitted',
          itemName: itemSummary,
          detail: `Borrower: ${borrower_name}`
        }),
        type: 'borrow_request',
        reference_id: id,
        link_url: borrowLink(id)
      }, actorExcludeOptions(req));

      sendSuccess(res, sanitizeBorrowForClient(transaction), 'Borrow request created successfully', 201);
    } catch (err) {
      const msg = err.message || 'Failed to create borrow request';
      const isClientError =
        /required|insufficient|unavailable|must match|only available|at least one item|invalid/i.test(msg);
      sendError(res, msg, isClientError ? 400 : 500);
    }
  },

  async approve(req, res) {
    const connection = await pool.getConnection();
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      if (transaction.status !== 'Pending') {
        return sendError(res, 'Only pending transactions can be approved', 400);
      }

      await connection.beginTransaction();

      for (const item of transaction.items) {
        const success = await InventoryModel.markAssetBorrowed(item.inventory_item_id, connection);
        if (!success) {
          await connection.rollback();
          return sendError(
            res,
            `Asset ${item.property_tag || item.item_name} is no longer available for borrowing`,
            400
          );
        }
      }

      await connection.query(
        'UPDATE borrow_transactions SET status = ?, approved_by = ?, approved_at = NOW() WHERE id = ?',
        ['Borrowed', req.session.user.id, req.params.id]
      );

      await connection.commit();
      await logActivity(req.session.user.id, 'APPROVE', 'Borrow', `Approved ${transaction.transaction_code}`, req.ip, {
        entity_type: 'borrow_transaction',
        entity_id: transaction.id,
        reference_code: transaction.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Borrowed'
      });

      const updated = await BorrowModel.findById(req.params.id);
      const tagSummary = formatPropertyTags(updated.items);

      await notifyUser(transaction.borrower_id, {
        title: 'Borrow Request Approved',
        message: buildAssetNotificationMessage({
          action: 'Borrow request approved',
          itemName: updated.items.map((line) => line.item_name).filter(Boolean).join(', ') || null,
          propertyTag: tagSummary,
          detail: transaction.transaction_code
        }),
        type: 'borrow_approved',
        reference_id: transaction.id,
        link_url: borrowLink(transaction.id)
      }, actorExcludeOptions(req));
      await notifyCustodiansForBorrowTransaction(updated, (item) => ({
        title: 'Assigned Asset Borrowed',
        message: buildAssetNotificationMessage({
          action: 'Borrow request approved',
          itemName: item.item_name,
          propertyTag: item.property_tag,
          detail: transaction.transaction_code
        }),
        type: 'assigned_asset_borrowed',
        reference_id: transaction.id,
        link_url: borrowLink(transaction.id),
        skipDuplicate: true
      }), actorExcludeOptions(req));

      let generatedDocument = null;
      try {
        const doc = await DocumentService.generateABLForBorrow(req.params.id, req.session.user.id);
        generatedDocument = { id: doc.id, document_number: doc.document_number, document_type: 'ABL' };
      } catch (docErr) {
        console.error('ABL generation failed:', docErr.message);
      }

      sendSuccess(res, sanitizeBorrowForClient({ ...updated, generated_document: generatedDocument }), 'Borrow request approved');
    } catch (err) {
      try { await connection.rollback(); } catch (_) { /* ignore */ }
      sendError(res, err.message, 500);
    } finally {
      connection.release();
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
      await logActivity(req.session.user.id, 'REJECT', 'Borrow', `Rejected ${transaction.transaction_code}`, req.ip, {
        entity_type: 'borrow_transaction',
        entity_id: transaction.id,
        reference_code: transaction.transaction_code,
        field_name: 'status',
        old_value: 'Pending',
        new_value: 'Rejected'
      });

      await notifyUser(transaction.borrower_id, {
        title: 'Borrow Request Rejected',
        message: 'Your borrow request has been rejected.',
        type: 'borrow_rejected',
        reference_id: transaction.id,
        link_url: borrowLink(transaction.id)
      }, actorExcludeOptions(req));

      const updated = await BorrowModel.findById(req.params.id);
      sendSuccess(res, sanitizeBorrowForClient(updated), 'Borrow request rejected');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async processReturn(req, res) {
    try {
      const transaction = await BorrowModel.findById(req.params.id);
      if (!transaction) return sendError(res, 'Transaction not found', 404);
      if (!['Borrowed', 'Approved', 'Overdue'].includes(transaction.status)) {
        return sendError(res, 'Transaction cannot be processed for return in current status', 400);
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

      await logActivity(req.session.user.id, 'PROCESS_RETURN', 'Return', `Processed return ${returnCode}`, req.ip, {
        entity_type: 'return_transaction',
        entity_id: returnId,
        reference_code: returnCode,
        field_name: 'borrow_status',
        old_value: transaction.status,
        new_value: 'Returned'
      });

      const refreshed = await BorrowModel.findById(transaction.id);
      const tagSummary = formatPropertyTags(refreshed.items);

      await notifyPropertyManagers({
        title: 'Item Returned',
        message: buildAssetNotificationMessage({
          action: 'Borrow item returned',
          itemName: refreshed.items.map((line) => line.item_name).filter(Boolean).join(', ') || null,
          propertyTag: tagSummary,
          detail: `${transaction.borrower_name} — ${transaction.transaction_code}`
        }),
        type: 'borrow_returned',
        reference_id: transaction.id,
        link_url: borrowLink(transaction.id)
      }, actorExcludeOptions(req));

      await notifyUser(transaction.borrower_id, {
        title: 'Return Processed',
        message: buildAssetNotificationMessage({
          action: 'Borrow item returned',
          itemName: refreshed.items.map((line) => line.item_name).filter(Boolean).join(', ') || null,
          propertyTag: tagSummary,
          detail: transaction.transaction_code
        }),
        type: 'return_processed',
        reference_id: transaction.id,
        link_url: borrowLink(transaction.id)
      }, actorExcludeOptions(req));

      sendSuccess(res, { id: returnId, transaction_code: returnCode }, 'Process Return completed successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getReturns(req, res) {
    try {
      const scope = getBorrowListScope(req.session.user);
      if (scope.type === 'none') {
        return sendSuccess(res, []);
      }

      const filters = {};
      if (scope.type !== 'all') {
        filters.scope = scope;
      }

      const returns = await ReturnModel.getAll(filters);
      sendSuccess(res, returns);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getHistoryByAsset(req, res) {
    try {
      const item = await InventoryModel.findById(req.params.inventoryItemId);
      if (!item) return sendError(res, 'Item not found', 404);

      const scope = getAccessScope(req.session.user);
      if (!itemMatchesScope(item, scope)) {
        return sendError(res, 'Access denied', 403);
      }

      const history = await BorrowModel.getByAsset(req.params.inventoryItemId);
      sendSuccess(res, history);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = BorrowController;
