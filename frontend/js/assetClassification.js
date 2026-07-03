const ASSET_CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

const FIXED_ASSET_CLASS = 'Non-Consumable (Fixed Asset)';

function normalizeAssetClassification(value) {
  if (!value) return 'Consumable';
  if (value === 'Fixed Asset') return FIXED_ASSET_CLASS;
  return value;
}

function isFixedAssetClassification(value) {
  return normalizeAssetClassification(value) === FIXED_ASSET_CLASS;
}

function canTransferAsset(value) {
  return normalizeAssetClassification(value) !== 'Consumable';
}

function canMaintainAsset(value) {
  return isFixedAssetClassification(value);
}

function canBorrowAsset(value) {
  return isFixedAssetClassification(value);
}

function canReplaceComponent(value) {
  return isFixedAssetClassification(value);
}
