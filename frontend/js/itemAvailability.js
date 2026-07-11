const NON_BORROWABLE_STATUSES = new Set([
  'Borrowed',
  'Under Maintenance',
  'Disposed'
]);

function getItemUnavailableReason(item) {
  if (!item) return 'Unavailable';

  if (item.status === 'Borrowed') return 'Borrowed';

  if (item.status === 'Available' && canBorrowAsset(item.asset_classification)) {
    return null;
  }

  if (item.status === 'Under Maintenance') {
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
  if (NON_BORROWABLE_STATUSES.has(item.status)) return false;
  return item.status === 'Available';
}
