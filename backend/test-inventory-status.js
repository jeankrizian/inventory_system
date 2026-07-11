const {
  INVENTORY_STATUSES,
  computeInventoryStatus,
  recalculateInventoryStatus,
  computeStatusAfterQuantityChange,
  computeStatusAfterDisposal,
  preserveStatusOnEdit,
  normalizeWorkflowStatus,
  hasManualStatusInput,
  isWorkflowStatus
} = require('./utils/inventoryStatusService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(
  computeInventoryStatus({ status: 'Available' }) === INVENTORY_STATUSES.AVAILABLE,
  'Available stays Available'
);
assert(
  computeInventoryStatus({ status: 'Borrowed' }) === INVENTORY_STATUSES.BORROWED,
  'Borrowed preserved'
);
assert(
  computeInventoryStatus({ status: 'Under Maintenance' }) === INVENTORY_STATUSES.UNDER_MAINTENANCE,
  'Under Maintenance preserved'
);
assert(
  computeInventoryStatus({ status: 'Disposed' }) === INVENTORY_STATUSES.DISPOSED,
  'Disposed preserved'
);

assert(
  normalizeWorkflowStatus('Low Stock') === INVENTORY_STATUSES.AVAILABLE,
  'legacy Low Stock normalizes to Available'
);
assert(
  normalizeWorkflowStatus('Out of Stock') === INVENTORY_STATUSES.AVAILABLE,
  'legacy Out of Stock normalizes to Available'
);

assert(
  recalculateInventoryStatus({ status: 'Under Maintenance' }) === INVENTORY_STATUSES.AVAILABLE,
  'after maintenance recalculates to Available'
);
assert(
  recalculateInventoryStatus({ status: 'Borrowed' }) === INVENTORY_STATUSES.BORROWED,
  'after maintenance Borrowed stays Borrowed'
);
assert(
  recalculateInventoryStatus({ status: 'Disposed' }) === INVENTORY_STATUSES.DISPOSED,
  'after maintenance Disposed stays Disposed'
);

assert(
  computeStatusAfterQuantityChange({ status: 'Available' }, 0) === INVENTORY_STATUSES.AVAILABLE,
  'quantity change does not derive Low Stock'
);
assert(
  computeStatusAfterDisposal({ status: 'Available' }) === INVENTORY_STATUSES.DISPOSED,
  'disposal sets Disposed'
);
assert(
  preserveStatusOnEdit('Borrowed') === INVENTORY_STATUSES.BORROWED,
  'edit preserves Borrowed'
);

assert(hasManualStatusInput({ status: 'Available' }) === true, 'non-empty status is manual input');
assert(hasManualStatusInput({ status: '' }) === false, 'empty status is not manual input');
assert(hasManualStatusInput({}) === false, 'missing status is not manual input');

assert(isWorkflowStatus('Available') === true, 'Available is workflow status');
assert(isWorkflowStatus('Low Stock') === false, 'Low Stock is not workflow status');

console.log('All inventory status unit tests passed.');
