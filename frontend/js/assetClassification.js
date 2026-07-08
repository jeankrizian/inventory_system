const ASSET_CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

/** Temporarily disable new Consumable items while keeping existing records compatible */
const CONSUMABLE_TEMPORARILY_DISABLED = true;

const FIXED_ASSET_CLASS = 'Non-Consumable (Fixed Asset)';
const PROPERTY_TAG_MAX_LENGTH = 50;
const PROPERTY_TAG_PATTERN = /^[\w][\w\-/.]*$/;

function normalizePropertyTag(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isValidPropertyTagFormat(value) {
  if (!value) return true;
  if (value.length > PROPERTY_TAG_MAX_LENGTH) return false;
  return PROPERTY_TAG_PATTERN.test(value);
}

function normalizeAssetClassification(value) {
  if (!value) return 'Consumable';
  if (value === 'Fixed Asset') return FIXED_ASSET_CLASS;
  return value;
}

function isConsumableClassification(value) {
  if (value == null || String(value).trim() === '') return false;
  return normalizeAssetClassification(value) === 'Consumable';
}

function isConsumableEnabled() {
  return !CONSUMABLE_TEMPORARILY_DISABLED;
}

function getSelectableClassifications(currentValue) {
  if (isConsumableEnabled()) return [...ASSET_CLASSIFICATIONS];
  if (isConsumableClassification(currentValue)) return [...ASSET_CLASSIFICATIONS];
  return ASSET_CLASSIFICATIONS.filter((c) => c !== 'Consumable');
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
