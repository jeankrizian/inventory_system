function getBorrowedCount(quantity, availableQuantity) {
  return Math.max(0, Number(quantity ?? 0) - Number(availableQuantity ?? 0));
}

function clampAvailableQuantity(availableQuantity, quantity) {
  const qty = Math.max(0, Number(quantity ?? 0));
  const avail = Math.max(0, Number(availableQuantity ?? 0));
  return Math.min(avail, qty);
}

function validateQuantityPair(quantity, availableQuantity) {
  const qty = Number(quantity);
  const avail = Number(availableQuantity);

  if (!Number.isFinite(qty) || qty < 0) {
    return { valid: false, message: 'Quantity cannot be negative' };
  }

  if (!Number.isFinite(avail) || avail < 0) {
    return { valid: false, message: 'Available quantity cannot be negative' };
  }

  if (avail > qty) {
    return { valid: false, message: 'Available quantity cannot exceed quantity' };
  }

  return { valid: true };
}

/** New items: all units are available. */
function availableForCreate(quantity) {
  return Math.max(0, Number(quantity ?? 0));
}

/** Preserve borrowed units when total quantity changes. */
function availableForUpdate(existing, newQuantity) {
  const borrowed = getBorrowedCount(existing?.quantity, existing?.available_quantity);
  const qty = Math.max(0, Number(newQuantity ?? existing?.quantity ?? 0));
  return clampAvailableQuantity(qty - borrowed, qty);
}

/** Apply a signed delta to available quantity (borrow = negative, return = positive). */
function applyAvailableDelta(item, delta) {
  const qty = Number(item?.quantity ?? 0);
  const current = Number(item?.available_quantity ?? 0);
  return clampAvailableQuantity(current + Number(delta ?? 0), qty);
}

/** Update totals after disposal while preserving borrowed count. */
function quantitiesAfterDisposal(item, quantityDisposed) {
  const disposed = Math.max(0, Number(quantityDisposed ?? 0));
  const borrowed = getBorrowedCount(item?.quantity, item?.available_quantity);
  const quantity = Math.max(0, Number(item?.quantity ?? 0) - disposed);
  const available_quantity = clampAvailableQuantity(quantity - borrowed, quantity);
  return { quantity, available_quantity };
}

module.exports = {
  getBorrowedCount,
  clampAvailableQuantity,
  validateQuantityPair,
  availableForCreate,
  availableForUpdate,
  applyAvailableDelta,
  quantitiesAfterDisposal
};
