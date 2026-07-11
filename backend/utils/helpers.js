/**
 * Generate unique transaction codes
 */
function generateCode(prefix) {
  const date = new Date();
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `${prefix}-${y}${m}${d}-${rand}`;
}

const { computeInventoryStatus } = require('./inventoryStatusService');

/**
 * @deprecated Use computeInventoryStatus from inventoryStatusService
 */
function computeItemStatus(availableQty, totalQty, threshold) {
  return computeInventoryStatus({
    available_quantity: availableQty,
    low_stock_threshold: threshold
  });
}

module.exports = { generateCode, computeItemStatus, computeInventoryStatus };
