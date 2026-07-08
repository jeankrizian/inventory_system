const {
  isItemAvailableForBorrow,
  getItemUnavailableReason
} = require('./utils/itemAvailability');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const borrowable = {
  asset_classification: 'Non-Consumable (Fixed Asset)',
  available_quantity: 2,
  status: 'Available'
};

const outOfStock = {
  ...borrowable,
  available_quantity: 0,
  status: 'Out of Stock'
};

const underMaintenance = {
  ...borrowable,
  available_quantity: 3,
  status: 'Under Maintenance'
};

const unavailableStatus = {
  ...borrowable,
  available_quantity: 1,
  status: 'Unavailable'
};

assert(isItemAvailableForBorrow(borrowable), 'Available fixed asset should be borrowable');
assert(!isItemAvailableForBorrow(outOfStock), 'Out of stock item should not be borrowable');
assert(!isItemAvailableForBorrow(underMaintenance), 'Under maintenance item should not be borrowable');
assert(!isItemAvailableForBorrow(unavailableStatus), 'Unavailable status should not be borrowable');
assert(getItemUnavailableReason(outOfStock) === 'Out of stock', 'Out of stock reason');
assert(getItemUnavailableReason(underMaintenance) === 'Unavailable', 'Maintenance reason');

console.log('Item availability unit tests OK');
