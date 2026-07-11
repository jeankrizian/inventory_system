const {
  NON_BORROWABLE_ASSET_STATUSES,
  BORROWABLE_ASSET_STATUS,
  isAssetBorrowable
} = require('./borrowAssetService');
const { canBorrow } = require('./assetClassification');

function getItemUnavailableReason(item) {
  if (!item) return 'Unavailable';

  if (item.status === 'Borrowed') return 'Borrowed';

  if (item.status === BORROWABLE_ASSET_STATUS && isAssetBorrowable(item)) {
    return null;
  }

  if (item.status === 'Unavailable' || item.status === 'Under Maintenance') {
    return 'Unavailable';
  }

  if (NON_BORROWABLE_ASSET_STATUSES.has(item.status)) {
    return item.status;
  }

  if (!canBorrow(item.asset_classification)) {
    return 'Not borrowable';
  }

  return 'Unavailable';
}

function isItemAvailableForBorrow(item) {
  if (!item) return false;
  if (!canBorrow(item.asset_classification)) return false;
  return item.status === BORROWABLE_ASSET_STATUS && isAssetBorrowable(item);
}

module.exports = {
  NON_BORROWABLE_STATUSES: NON_BORROWABLE_ASSET_STATUSES,
  getItemUnavailableReason,
  isItemAvailableForBorrow
};
