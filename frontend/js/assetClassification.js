const ASSET_CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

/** Temporarily disable new Consumable items while keeping existing records compatible */
const CONSUMABLE_TEMPORARILY_DISABLED = true;
const CONSUMABLE_DISABLED_MESSAGE = 'Consumable items are currently disabled.';

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
  if (!value || String(value).trim() === '') {
    return CONSUMABLE_TEMPORARILY_DISABLED ? '' : 'Consumable';
  }
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

function isConsumableEditBlocked(value) {
  return !isConsumableEnabled() && isConsumableClassification(value);
}

function getSelectableClassifications(currentValue) {
  if (isConsumableEnabled()) return [...ASSET_CLASSIFICATIONS];
  return ASSET_CLASSIFICATIONS.filter((c) => c !== 'Consumable');
}

function getFilterClassifications() {
  return getSelectableClassifications(null);
}

function formatClassificationDisplay(value) {
  if (!isConsumableEnabled() && isConsumableClassification(value)) {
    return '—';
  }
  const normalized = normalizeAssetClassification(value);
  return normalized || '—';
}

function isFixedAssetClassification(value) {
  return normalizeAssetClassification(value) === FIXED_ASSET_CLASS;
}

function canTransferAsset(value) {
  return !isConsumableClassification(value);
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
