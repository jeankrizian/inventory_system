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

/**
 * Update inventory item status based on quantities
 */
function computeItemStatus(availableQty, totalQty, threshold) {
  if (availableQty <= 0) return 'Out of Stock';
  if (availableQty <= threshold) return 'Low Stock';
  if (availableQty < totalQty) return 'Borrowed';
  return 'Available';
}

module.exports = { generateCode, computeItemStatus };
