const { sendError } = require('../utils/response');
const {
  isAdministrator,
  isPropertyManager,
  canManageInventory,
  canViewInventory,
  canApproveBorrow,
  canProcessReturn,
  canOperateTransfers,
  canOperateMaintenance,
  canOperateDisposal,
  canAccessReports,
  canAccessArchive,
  canManageSystem,
  canManageSuppliers,
  canSubmitBorrow,
  canSubmitTransfer,
  canSubmitMaintenance,
  canViewReturnHistory,
  canViewTransfers,
  canViewMaintenance,
  canViewDisposal,
  canSubmitDisposal
} = require('../utils/roleHelpers');

function getSessionRole(req) {
  const user = req.session?.user;
  return user?.role || user?.role_name;
}

/** Require authenticated session */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return sendError(res, 'Authentication required', 401);
  }
  next();
};

function requireRole(checkFn, message) {
  return (req, res, next) => {
    if (!req.session || !req.session.user) {
      return sendError(res, 'Authentication required', 401);
    }
    if (!checkFn(getSessionRole(req))) {
      return sendError(res, message, 403);
    }
    next();
  };
}

/** System administrator only (users, departments, locations) */
const requireAdministrator = requireRole(
  isAdministrator,
  'Administrator access required'
);

/** Property Manager only — full operational lifecycle */
const requirePropertyManager = requireRole(
  isPropertyManager,
  'Property Manager access required'
);

/** @deprecated Use requirePropertyManager or requireAdministrator */
const requireAdmin = requirePropertyManager;

const requireViewInventory = requireRole(
  canViewInventory,
  'Inventory access requires Administrator, Property Manager, or Custodian role'
);

const requireManageInventory = requireRole(
  canManageInventory,
  'Inventory management requires Administrator or Property Manager access'
);

const requireApproveBorrow = requireRole(
  canApproveBorrow,
  'Only Property Managers can approve or reject borrow requests'
);

const requireProcessReturn = requireRole(
  canProcessReturn,
  'Only Property Managers can process returns'
);

const requireViewReturnHistory = requireRole(
  canViewReturnHistory,
  'Process return history requires Administrator, Property Manager, or Custodian role'
);

const requireOperateTransfers = requireRole(
  canOperateTransfers,
  'Only Property Managers can approve or reject transfers'
);

const requireOperateMaintenance = requireRole(
  canOperateMaintenance,
  'Only Property Managers can manage maintenance operations'
);

const requireOperateDisposal = requireRole(
  canOperateDisposal,
  'Only Property Managers can manage disposal operations'
);

const requireReportsAccess = requireRole(
  canAccessReports,
  'Reports access requires Administrator, Property Manager, or Custodian role'
);

const requireArchiveAccess = requireRole(
  canAccessArchive,
  'Archive access requires Administrator or Property Manager role'
);

const requireSystemManage = requireRole(
  canManageSystem,
  'System management requires Administrator access'
);

const requireSuppliersManage = requireRole(
  canManageSuppliers,
  'Supplier management requires Administrator or Property Manager access'
);

const requireSubmitBorrow = requireRole(
  canSubmitBorrow,
  'You do not have permission to submit borrow requests'
);

const requireSubmitTransfer = requireRole(
  canSubmitTransfer,
  'You do not have permission to submit transfer requests'
);

const requireSubmitMaintenance = requireRole(
  canSubmitMaintenance,
  'You do not have permission to submit maintenance requests'
);

const requireViewTransfers = requireRole(
  canViewTransfers,
  'Transfer access requires Property Manager or Custodian role'
);

const requireViewMaintenance = requireRole(
  canViewMaintenance,
  'Maintenance access requires Administrator, Property Manager, or Custodian role'
);

const requireViewDisposal = requireRole(
  canViewDisposal,
  'Disposal access requires Administrator, Property Manager, or Custodian role'
);

const requireSubmitDisposal = requireRole(
  canSubmitDisposal,
  'You do not have permission to submit disposal requests'
);

/** Handle express-validator errors */
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  next();
};

module.exports = {
  requireAuth,
  requireAdmin,
  requireAdministrator,
  requirePropertyManager,
  requireViewInventory,
  requireManageInventory,
  requireApproveBorrow,
  requireProcessReturn,
  requireViewReturnHistory,
  requireOperateTransfers,
  requireOperateMaintenance,
  requireOperateDisposal,
  requireReportsAccess,
  requireArchiveAccess,
  requireSystemManage,
  requireSuppliersManage,
  requireSubmitBorrow,
  requireSubmitTransfer,
  requireSubmitMaintenance,
  requireViewTransfers,
  requireViewMaintenance,
  requireViewDisposal,
  requireSubmitDisposal,
  validate
};
