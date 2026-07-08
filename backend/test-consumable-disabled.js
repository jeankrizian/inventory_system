const {
  validateInventoryClassification,
  getSelectableClassifications,
  isConsumableEnabled,
  CONSUMABLE_TEMPORARILY_DISABLED
} = require('./utils/assetClassification');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(CONSUMABLE_TEMPORARILY_DISABLED === true, 'Consumable should be temporarily disabled');
assert(!isConsumableEnabled(), 'Consumable not enabled for new items');

const blockedCreate = validateInventoryClassification({
  asset_classification: 'Consumable'
}, { existingClassification: null });
assert(!blockedCreate.valid, 'New consumable item blocked');
assert(blockedCreate.message.includes('temporarily disabled'), 'Blocked message');

const allowedExisting = validateInventoryClassification({
  asset_classification: 'Consumable'
}, { existingClassification: 'Consumable' });
assert(allowedExisting.valid, 'Existing consumable item can be updated');

const blockedChange = validateInventoryClassification({
  asset_classification: 'Consumable'
}, { existingClassification: 'Semi-Durable' });
assert(!blockedChange.valid, 'Cannot change classification to consumable');

const selectableNew = getSelectableClassifications(null);
assert(!selectableNew.includes('Consumable'), 'Consumable hidden for new items');
assert(selectableNew.includes('Semi-Durable'), 'Semi-Durable still selectable');

const selectableExisting = getSelectableClassifications('Consumable');
assert(selectableExisting.includes('Consumable'), 'Consumable shown for existing consumable item');

console.log('Consumable disabled unit tests OK');
