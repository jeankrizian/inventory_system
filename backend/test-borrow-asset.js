const {
  generatePropertyTagSequence
} = require('./utils/propertyTagGenerator');
const { allocateAssets } = require('./utils/borrowAssetService');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const tags = generatePropertyTagSequence('2025-0001', 3);
assert(tags[2] === '2025-0003', 'sequence generation');

console.log('Borrow asset unit checks passed (DB allocation tested via API).');
