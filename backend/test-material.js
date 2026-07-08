const { MATERIAL_OPTIONS, normalizeMaterial, isValidMaterial } = require('./utils/materialOptions');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(MATERIAL_OPTIONS.length === 5, 'Material options list');
assert(normalizeMaterial('  Metal ') === 'Metal', 'normalizeMaterial trims');
assert(normalizeMaterial('') === null, 'empty material becomes null');
assert(isValidMaterial('Wood'), 'Wood is valid');
assert(isValidMaterial(null), 'null material is valid');
assert(!isValidMaterial('Ceramic'), 'unknown material rejected');

console.log('Material options unit tests OK');
