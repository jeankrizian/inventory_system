const INVENTORY_STATUSES = {
  AVAILABLE: 'Available',
  BORROWED: 'Borrowed',
  UNDER_MAINTENANCE: 'Under Maintenance',
  DISPOSED: 'Disposed'
};

const WORKFLOW_LOCKED_STATUSES = new Set([
  INVENTORY_STATUSES.BORROWED,
  INVENTORY_STATUSES.UNDER_MAINTENANCE,
  INVENTORY_STATUSES.DISPOSED
]);

/** Legacy quantity-derived statuses normalized to Available. */
const LEGACY_QUANTITY_STATUSES = new Set(['Low Stock', 'Out of Stock', 'Unavailable']);

function normalizeWorkflowStatus(status) {
  if (!status || LEGACY_QUANTITY_STATUSES.has(status)) {
    return INVENTORY_STATUSES.AVAILABLE;
  }
  if (status === 'Fixed Asset' || status === 'In Stock') {
    return INVENTORY_STATUSES.AVAILABLE;
  }
  if (Object.values(INVENTORY_STATUSES).includes(status)) {
    return status;
  }
  if (WORKFLOW_LOCKED_STATUSES.has(status)) {
    return status;
  }
  return INVENTORY_STATUSES.AVAILABLE;
}

/**
 * Property-based inventory: status is workflow-driven, not quantity-driven.
 */
function computeInventoryStatus(input = {}) {
  const currentStatus = input.status ?? null;

  if (currentStatus === INVENTORY_STATUSES.DISPOSED) {
    return INVENTORY_STATUSES.DISPOSED;
  }

  if (currentStatus === INVENTORY_STATUSES.UNDER_MAINTENANCE) {
    return INVENTORY_STATUSES.UNDER_MAINTENANCE;
  }

  if (currentStatus === INVENTORY_STATUSES.BORROWED) {
    return INVENTORY_STATUSES.BORROWED;
  }

  return normalizeWorkflowStatus(currentStatus);
}

function recalculateInventoryStatus(input = {}) {
  if (input.status === INVENTORY_STATUSES.DISPOSED) {
    return INVENTORY_STATUSES.DISPOSED;
  }
  if (input.status === INVENTORY_STATUSES.BORROWED) {
    return INVENTORY_STATUSES.BORROWED;
  }
  return INVENTORY_STATUSES.AVAILABLE;
}

function computeStatusAfterQuantityChange(item, _newAvailableQty) {
  return computeInventoryStatus(item);
}

function computeStatusAfterDisposal(item) {
  return INVENTORY_STATUSES.DISPOSED;
}

function preserveStatusOnEdit(existingStatus) {
  return computeInventoryStatus({ status: existingStatus });
}

const WORKFLOW_STATUS_LIST = Object.values(INVENTORY_STATUSES);

function isWorkflowStatus(status) {
  return WORKFLOW_STATUS_LIST.includes(status);
}

function hasManualStatusInput(body = {}) {
  if (!body || !Object.prototype.hasOwnProperty.call(body, 'status')) return false;
  const value = body.status;
  if (value == null) return false;
  return String(value).trim() !== '';
}

module.exports = {
  INVENTORY_STATUSES,
  WORKFLOW_LOCKED_STATUSES,
  LEGACY_QUANTITY_STATUSES,
  WORKFLOW_STATUS_LIST,
  normalizeWorkflowStatus,
  computeInventoryStatus,
  recalculateInventoryStatus,
  computeStatusAfterQuantityChange,
  computeStatusAfterDisposal,
  preserveStatusOnEdit,
  isWorkflowStatus,
  hasManualStatusInput
};
