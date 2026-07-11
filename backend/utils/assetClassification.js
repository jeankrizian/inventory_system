const CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

/** Temporarily disable new Consumable items while keeping existing records compatible */
const CONSUMABLE_TEMPORARILY_DISABLED = true;
const CONSUMABLE_DISABLED_MESSAGE = 'Consumable items are currently disabled.';
const DEFAULT_CLASSIFICATION_WHEN_CONSUMABLE_DISABLED = 'Semi-Durable';

const FIXED_ASSET = 'Non-Consumable (Fixed Asset)';
const LEGACY_FIXED_ASSET = 'Fixed Asset';
const PROPERTY_TAG_MAX_LENGTH = 50;
const PROPERTY_TAG_PATTERN = /^[\w][\w\-/.]*$/;

function getAssetCreateCount(body) {
  return Math.max(1, parseInt(body?.asset_count ?? body?.quantity, 10) || 1);
}

function normalizePropertyTag(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

function isValidPropertyTagFormat(value) {
  if (!value) return true;
  if (value.length > PROPERTY_TAG_MAX_LENGTH) return false;
  if (/^\d{8}-\d{6}$/.test(value)) return true;
  return PROPERTY_TAG_PATTERN.test(value);
}

function normalizeClassification(value) {
  if (!value || String(value).trim() === '') {
    return CONSUMABLE_TEMPORARILY_DISABLED ? '' : 'Consumable';
  }
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
  if (!isConsumableEnabled()) return false;
  return true;
}

function shouldExcludeConsumableFromLists() {
  return CONSUMABLE_TEMPORARILY_DISABLED;
}

function validateConsumableFilter(classification) {
  if (!classification) return null;
  if (isConsumableClassification(classification) && !isConsumableEnabled()) {
    return CONSUMABLE_DISABLED_MESSAGE;
  }
  return null;
}

function isConsumableEditBlocked(classification) {
  return !isConsumableEnabled() && isConsumableClassification(classification);
}

function getFilterClassifications() {
  return getSelectableClassifications(null);
}

function formatClassificationDisplay(value) {
  if (!isConsumableEnabled() && isConsumableClassification(value)) {
    return '—';
  }
  const normalized = normalizeClassification(value);
  return normalized || '—';
}

function getSelectableClassifications(existingClassification) {
  if (isConsumableEnabled()) return [...CLASSIFICATIONS];
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

  if (isConsumableClassification(classification) && !isConsumableEnabled()) {
    return { valid: false, message: CONSUMABLE_DISABLED_MESSAGE };
  }

  const propertyTag = normalizePropertyTag(body.property_tag);
  const skipPropertyTag = Boolean(options.skipPropertyTag);

  if (!skipPropertyTag && requiresPropertyTag(classification) && !propertyTag) {
    return { valid: false, message: 'Property tag is required for Non-Consumable (Fixed Asset) items' };
  }

  if (propertyTag && !isValidPropertyTagFormat(propertyTag)) {
    return {
      valid: false,
      message: 'Property tag format is invalid. Use YYYYMMDD-000001.'
    };
  }

  if (requiresCustodian(classification) && !body.custodian_id) {
    return { valid: false, message: 'Assigned custodian is required for Non-Consumable (Fixed Asset) items' };
  }

  return { valid: true, classification };
}

function validateBulkAssetCreate(body, options = {}) {
  const count = getAssetCreateCount(body);
  if (count < 1) {
    return { valid: false, message: 'At least one asset is required' };
  }
  if (count > 500) {
    return { valid: false, message: 'Cannot create more than 500 assets at once' };
  }

  const validationBody = {
    ...body,
    property_tag: body.property_tag || null
  };
  const base = validateInventoryClassification(validationBody, { ...options, skipPropertyTag: true });
  if (!base.valid) return base;

  return { valid: true, classification: base.classification, asset_count: count };
}

module.exports = {
  CLASSIFICATIONS,
  CONSUMABLE_TEMPORARILY_DISABLED,
  CONSUMABLE_DISABLED_MESSAGE,
  DEFAULT_CLASSIFICATION_WHEN_CONSUMABLE_DISABLED,
  FIXED_ASSET,
  LEGACY_FIXED_ASSET,
  normalizeClassification,
  isValidClassification,
  isConsumableClassification,
  isConsumableEnabled,
  canUseConsumableClassification,
  shouldExcludeConsumableFromLists,
  validateConsumableFilter,
  isConsumableEditBlocked,
  getFilterClassifications,
  formatClassificationDisplay,
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
  validateInventoryClassification,
  validateBulkAssetCreate,
  getAssetCreateCount
};
