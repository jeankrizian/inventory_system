const CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

/** Temporarily disable new Consumable items while keeping existing records compatible */
const CONSUMABLE_TEMPORARILY_DISABLED = true;

const FIXED_ASSET = 'Non-Consumable (Fixed Asset)';
const LEGACY_FIXED_ASSET = 'Fixed Asset';
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

function normalizeClassification(value) {
  if (!value) return 'Consumable';
  if (value === LEGACY_FIXED_ASSET) return FIXED_ASSET;
  return value;
}

function isConsumableClassification(classification) {
  if (classification == null || String(classification).trim() === '') return false;
  return normalizeClassification(classification) === 'Consumable';
}

function isConsumableEnabled() {
  return !CONSUMABLE_TEMPORARILY_DISABLED;
}

function canUseConsumableClassification(existingClassification) {
  if (isConsumableEnabled()) return true;
  return isConsumableClassification(existingClassification);
}

function getSelectableClassifications(existingClassification) {
  if (isConsumableEnabled()) return [...CLASSIFICATIONS];
  if (canUseConsumableClassification(existingClassification)) return [...CLASSIFICATIONS];
  return CLASSIFICATIONS.filter((c) => c !== 'Consumable');
}

function isValidClassification(value) {
  const normalized = normalizeClassification(value);
  return CLASSIFICATIONS.includes(normalized);
}

function isFixedAsset(classification) {
  return normalizeClassification(classification) === FIXED_ASSET;
}

function canTransfer(classification) {
  return normalizeClassification(classification) !== 'Consumable';
}

function canMaintain(classification) {
  return isFixedAsset(classification);
}

function canBorrow(classification) {
  return isFixedAsset(classification);
}

function isSemiDurable(classification) {
  return normalizeClassification(classification) === 'Semi-Durable';
}

function requiresPropertyTag(classification) {
  return isFixedAsset(classification);
}

function requiresCustodian(classification) {
  return isFixedAsset(classification);
}

function sanitizeInventoryByClassification(data) {
  const classification = normalizeClassification(data.asset_classification);
  const sanitized = { ...data, asset_classification: classification };

  if (Object.prototype.hasOwnProperty.call(data, 'property_tag')) {
    sanitized.property_tag = normalizePropertyTag(data.property_tag);
  }

  if (classification === 'Consumable') {
    sanitized.property_tag = null;
    sanitized.custodian_id = null;
    sanitized.custodian_type = null;
    sanitized.maintenance_schedule = null;
    sanitized.next_maintenance_date = null;
    sanitized.maintenance_status = null;
    sanitized.service_provider = null;
  } else if (classification === 'Semi-Durable') {
    sanitized.maintenance_schedule = null;
    sanitized.next_maintenance_date = null;
    sanitized.maintenance_status = null;
    sanitized.service_provider = null;
  }

  return sanitized;
}

function validateInventoryClassification(body, options = {}) {
  if (!body.asset_classification || String(body.asset_classification).trim() === '') {
    return { valid: false, message: 'Classification is required' };
  }
  if (!isValidClassification(body.asset_classification)) {
    return { valid: false, message: 'Invalid asset classification' };
  }

  const classification = normalizeClassification(body.asset_classification);
  const existingClassification = options.existingClassification ?? null;

  if (
    isConsumableClassification(classification)
    && !canUseConsumableClassification(existingClassification)
  ) {
    return { valid: false, message: 'Consumable classification is temporarily disabled' };
  }

  const propertyTag = normalizePropertyTag(body.property_tag);

  if (requiresPropertyTag(classification) && !propertyTag) {
    return { valid: false, message: 'Property tag is required for Non-Consumable (Fixed Asset) items' };
  }

  if (propertyTag && !isValidPropertyTagFormat(propertyTag)) {
    return {
      valid: false,
      message: 'Property tag format is invalid. Use values like 2025-0001 or 2025/0001.'
    };
  }

  if (requiresCustodian(classification) && !body.custodian_type) {
    return { valid: false, message: 'Custodian type is required for Non-Consumable (Fixed Asset) items' };
  }

  if (requiresCustodian(classification) && !body.custodian_id) {
    return { valid: false, message: 'Assigned custodian is required for Non-Consumable (Fixed Asset) items' };
  }

  return { valid: true, classification };
}

module.exports = {
  CLASSIFICATIONS,
  CONSUMABLE_TEMPORARILY_DISABLED,
  FIXED_ASSET,
  LEGACY_FIXED_ASSET,
  normalizeClassification,
  isValidClassification,
  isConsumableClassification,
  isConsumableEnabled,
  canUseConsumableClassification,
  getSelectableClassifications,
  isFixedAsset,
  canTransfer,
  canMaintain,
  canBorrow,
  isSemiDurable,
  requiresPropertyTag,
  requiresCustodian,
  normalizePropertyTag,
  isValidPropertyTagFormat,
  sanitizeInventoryByClassification,
  validateInventoryClassification
};
