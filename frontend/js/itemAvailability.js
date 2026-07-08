const NON_BORROWABLE_STATUSES = new Set([
  'Unavailable',
  'Out of Stock',
  'Under Maintenance',
  'Disposed'
]);

function getItemUnavailableReason(item) {
  if (!item) return 'Unavailable';

  if ((item.available_quantity ?? 0) <= 0) {
    return 'Out of stock';
  }

  if (item.status === 'Unavailable' || item.status === 'Under Maintenance') {
    return 'Unavailable';
  }

  if (NON_BORROWABLE_STATUSES.has(item.status)) {
    return item.status;
  }

  if (!canBorrowAsset(item.asset_classification)) {
    return 'Not borrowable';
  }

  return 'Unavailable';
}

function isItemAvailableForBorrow(item) {
  if (!item) return false;
  if (!canBorrowAsset(item.asset_classification)) return false;
  if ((item.available_quantity ?? 0) <= 0) return false;
  if (NON_BORROWABLE_STATUSES.has(item.status)) return false;
  return true;
}
