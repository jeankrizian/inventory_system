const ASSET_CUSTODIAN_TYPES = ['Property Custodian', 'Department', 'Laboratory'];

const LEGACY_ASSET_CUSTODIAN_TYPES = {
  'Department Custodian': 'Department',
  'Laboratory Custodian': 'Laboratory'
};

function normalizeAssetCustodianType(value) {
  if (value == null || String(value).trim() === '') return '';
  const trimmed = String(value).trim();
  return LEGACY_ASSET_CUSTODIAN_TYPES[trimmed] || trimmed;
}

function populateAssetCustodianTypeSelect(selectEl, selectedValue = '') {
  if (!selectEl) return;
  const normalized = normalizeAssetCustodianType(selectedValue);
  selectEl.innerHTML = '<option value="">None</option>' + ASSET_CUSTODIAN_TYPES
    .map((type) => `<option value="${type}"${normalized === type ? ' selected' : ''}>${type}</option>`)
    .join('');
}
