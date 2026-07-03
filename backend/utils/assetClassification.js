const CLASSIFICATIONS = [
  'Consumable',
  'Semi-Durable',
  'Non-Consumable (Fixed Asset)'
];

const FIXED_ASSET = 'Non-Consumable (Fixed Asset)';
const LEGACY_FIXED_ASSET = 'Fixed Asset';

function normalizeClassification(value) {
  if (!value) return 'Consumable';
  if (value === LEGACY_FIXED_ASSET) return FIXED_ASSET;
  return value;
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
    if (!sanitized.property_tag) sanitized.property_tag = null;
  }

  return sanitized;
}

function validateInventoryClassification(body) {
  if (!body.asset_classification || String(body.asset_classification).trim() === '') {
    return { valid: false, message: 'Classification is required' };
  }
  if (!isValidClassification(body.asset_classification)) {
    return { valid: false, message: 'Invalid asset classification' };
  }

  const classification = normalizeClassification(body.asset_classification);

  if (requiresPropertyTag(classification) && !body.property_tag) {
    return { valid: false, message: 'Property tag is required for Non-Consumable (Fixed Asset) items' };
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
  FIXED_ASSET,
  LEGACY_FIXED_ASSET,
  normalizeClassification,
  isValidClassification,
  isFixedAsset,
  canTransfer,
  canMaintain,
  canBorrow,
  isSemiDurable,
  requiresPropertyTag,
  requiresCustodian,
  sanitizeInventoryByClassification,
  validateInventoryClassification
};
