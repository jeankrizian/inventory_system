const ASSET_CUSTODIAN_TYPES = ['Property Custodian', 'Department', 'Laboratory'];

const LEGACY_ASSET_CUSTODIAN_TYPES = {
  'Department Custodian': 'Department',
  'Laboratory Custodian': 'Laboratory'
};

function normalizeAssetCustodianType(value) {
  if (value == null || String(value).trim() === '') return null;
  const trimmed = String(value).trim();
  return LEGACY_ASSET_CUSTODIAN_TYPES[trimmed] || trimmed;
}

function isValidAssetCustodianType(value) {
  if (value == null || String(value).trim() === '') return true;
  return ASSET_CUSTODIAN_TYPES.includes(normalizeAssetCustodianType(value));
}

function formatAssetCustodianTypeLabel(value) {
  const normalized = normalizeAssetCustodianType(value);
  if (!normalized) return '-';
  return normalized;
}

module.exports = {
  ASSET_CUSTODIAN_TYPES,
  normalizeAssetCustodianType,
  isValidAssetCustodianType,
  formatAssetCustodianTypeLabel
};
