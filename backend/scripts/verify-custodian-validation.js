/**
 * Smoke test for custodian assignment validation and role name resolution.
 * Run: node scripts/verify-custodian-validation.js
 */
const { resolveRoleDbName, normalizeRoleName, isCustodian } = require('../utils/roleHelpers');

let passed = 0;
let failed = 0;

function assert(condition, label) {
  if (condition) {
    passed += 1;
    console.log(`  PASS: ${label}`);
  } else {
    failed += 1;
    console.error(`  FAIL: ${label}`);
  }
}

console.log('Role name resolution:');
assert(resolveRoleDbName('Staff') === 'staff', 'Staff -> staff');
assert(resolveRoleDbName('staff') === 'staff', 'staff -> staff');
assert(resolveRoleDbName('Administrator') === 'admin', 'Administrator -> admin');
assert(resolveRoleDbName('admin') === 'admin', 'admin -> admin');
assert(resolveRoleDbName('Property Manager') === 'Property Manager', 'Property Manager unchanged');
assert(resolveRoleDbName('Department Custodian') === 'Custodian', 'Legacy Department Custodian -> Custodian');
assert(resolveRoleDbName('Laboratory Custodian') === 'Custodian', 'Legacy Laboratory Custodian -> Custodian');
assert(resolveRoleDbName('Custodian') === 'Custodian', 'Custodian unchanged');

console.log('\nRole helper checks:');
assert(isCustodian('Custodian'), 'isCustodian for unified role');
assert(isCustodian('Department Custodian'), 'Legacy department role still treated as custodian');
assert(isCustodian('Laboratory Custodian'), 'Legacy laboratory role still treated as custodian');
assert(normalizeRoleName('Staff') === 'staff', 'normalizeRoleName Staff');

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
