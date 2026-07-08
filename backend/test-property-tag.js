const {
  normalizePropertyTag,
  isValidPropertyTagFormat,
  validateInventoryClassification,
  sanitizeInventoryByClassification
} = require('./utils/assetClassification');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const validTags = ['2025-0001', '2025/0001', 'CI-IT-2025-001', 'TAG_01'];
const invalidTags = [' tag', 'tag with spaces', 'tag#bad', ''];

for (const tag of validTags) {
  assert(isValidPropertyTagFormat(tag), `Expected valid: ${tag}`);
}

for (const tag of invalidTags) {
  if (tag === '') continue;
  assert(!isValidPropertyTagFormat(tag), `Expected invalid: ${tag}`);
}

assert(normalizePropertyTag('  2025-0001  ') === '2025-0001', 'Should trim property tag');
assert(normalizePropertyTag('   ') === null, 'Whitespace-only should be null');

const fixedAssetValidation = validateInventoryClassification({
  asset_classification: 'Non-Consumable (Fixed Asset)',
  property_tag: '2025/0001',
  custodian_type: 'Department',
  custodian_id: 5
});
assert(fixedAssetValidation.valid, 'Fixed asset with slash tag should validate');

const invalidFormat = validateInventoryClassification({
  asset_classification: 'Semi-Durable',
  property_tag: 'bad tag'
});
assert(!invalidFormat.valid, 'Spaces in property tag should fail validation');

const consumableSanitized = sanitizeInventoryByClassification({
  asset_classification: 'Consumable',
  property_tag: '2025-0001'
});
assert(consumableSanitized.property_tag === null, 'Consumable should clear property tag');

console.log('Property tag unit tests OK');
