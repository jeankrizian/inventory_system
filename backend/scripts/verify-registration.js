/**
 * Smoke test for public registration role restrictions and staff auto-assign.
 * Run: node scripts/verify-registration.js
 */
const fs = require('fs');
const path = require('path');
const { resolveRoleDbName } = require('../utils/roleHelpers');

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

const authControllerPath = path.join(__dirname, '../controllers/AuthController.js');
const authControllerSrc = fs.readFileSync(authControllerPath, 'utf8');

console.log('REGISTRATION_ROLES restriction:');
assert(
  /REGISTRATION_ROLES\s*=\s*\[\s*['"]staff['"]\s*\]/.test(authControllerSrc),
  'REGISTRATION_ROLES is ["staff"] only'
);
assert(
  !authControllerSrc.includes('deriveFullName'),
  'deriveFullName removed from AuthController'
);
assert(
  authControllerSrc.includes("const { username, email, password, confirm_password, full_name } = req.body"),
  'register reads full_name from body'
);
assert(
  authControllerSrc.includes('findRoleByName(REGISTRATION_ROLE)'),
  'register auto-assigns via REGISTRATION_ROLE constant'
);
assert(
  !/REGISTRATION_ROLES\.includes\(role\)/.test(authControllerSrc),
  'register does not accept client-supplied role'
);

console.log('\nRole resolution for staff:');
assert(resolveRoleDbName('staff') === 'staff', 'staff -> staff');
assert(resolveRoleDbName('Staff') === 'staff', 'Staff -> staff');
assert(resolveRoleDbName('employee') === 'staff', 'employee -> staff');

console.log('\nPrivileged roles excluded from public registration:');
const privilegedRoles = ['admin', 'Property Manager', 'Department Custodian', 'Laboratory Custodian'];
privilegedRoles.forEach((role) => {
  assert(
    !authControllerSrc.includes(`'${role}'`) || authControllerSrc.indexOf('REGISTRATION_ROLES') === -1
      || !new RegExp(`REGISTRATION_ROLES\\s*=\\s*\\[[^\\]]*'${role.replace(/ /g, '\\ ')}'`).test(authControllerSrc),
    `${role} not in REGISTRATION_ROLES`
  );
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
