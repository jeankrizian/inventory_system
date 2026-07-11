const {
  getBorrowedCount,
  clampAvailableQuantity,
  validateQuantityPair,
  availableForCreate,
  availableForUpdate,
  applyAvailableDelta,
  quantitiesAfterDisposal
} = require('./utils/inventoryQuantityService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(availableForCreate(50) === 50, 'create sets available = quantity');
assert(availableForCreate(0) === 0, 'create handles zero');

assert(getBorrowedCount(20, 18) === 2, 'borrowed count');
assert(availableForUpdate({ quantity: 20, available_quantity: 18 }, 25) === 23, 'edit preserves borrowed');
assert(availableForUpdate({ quantity: 100, available_quantity: 70 }, 120) === 90, 'edit example from spec');

assert(clampAvailableQuantity(25, 20) === 20, 'available cannot exceed quantity');
assert(clampAvailableQuantity(-3, 20) === 0, 'available cannot be negative');

const invalid = validateQuantityPair(10, 12);
assert(!invalid.valid, 'validation rejects available > quantity');

assert(applyAvailableDelta({ quantity: 20, available_quantity: 15 }, -5) === 10, 'borrow decreases available');
assert(applyAvailableDelta({ quantity: 20, available_quantity: 18 }, 5) === 20, 'return capped at quantity');

const disposed = quantitiesAfterDisposal({ quantity: 20, available_quantity: 18 }, 5);
assert(disposed.quantity === 15 && disposed.available_quantity === 13, 'disposal preserves borrowed');

console.log('All inventory quantity unit tests passed.');
