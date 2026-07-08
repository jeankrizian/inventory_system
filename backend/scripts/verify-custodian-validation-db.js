/**
 * Integration smoke test for custodian validation against the database.
 * Run: node scripts/verify-custodian-validation-db.js
 */
require('dotenv').config();
const CategoryModel = require('../models/CategoryModel');
const LocationModel = require('../models/LocationModel');
const UserModel = require('../models/UserModel');

async function runValidation(roleName, assignments) {
  const { normalizeRoleName, isCustodian } = require('../utils/roleHelpers');
  const normalized = normalizeRoleName(roleName);

  if (!isCustodian(normalized)) {
    return null;
  }

  const hasDepartment = assignments.assigned_department_id != null;
  const hasLocation = assignments.assigned_location_id != null;

  if (hasDepartment === hasLocation) {
    return 'Custodian requires either an assigned department or an assigned laboratory, but not both.';
  }

  if (hasDepartment) {
    const dept = await CategoryModel.findById(assignments.assigned_department_id);
    if (!dept) return 'Selected department does not exist.';
    return null;
  }

  const loc = await LocationModel.findById(assignments.assigned_location_id);
  if (!loc) return 'Selected laboratory does not exist.';
  return null;
}

async function main() {
  let failed = 0;

  async function check(label, actual, expected) {
    if (actual === expected) {
      console.log(`  PASS: ${label}`);
    } else {
      failed += 1;
      console.error(`  FAIL: ${label} (got "${actual}", expected "${expected}")`);
    }
  }

  console.log('DB role lookup:');
  const staffRole = await UserModel.findRoleByName('Staff');
  check('findRoleByName(Staff) resolves to staff', staffRole?.name, 'staff');

  const depts = await CategoryModel.getAll();
  const locs = await LocationModel.getAll();
  const validDeptId = depts[0]?.id ?? null;
  const validLocId = locs[0]?.id ?? null;

  console.log('\nCustodian assignment validation:');
  await check(
    'custodian missing assignment',
    await runValidation('Custodian', { assigned_department_id: null, assigned_location_id: null }),
    'Custodian requires either an assigned department or an assigned laboratory, but not both.'
  );
  await check(
    'custodian both assignments',
    await runValidation('Custodian', { assigned_department_id: 1, assigned_location_id: 1 }),
    'Custodian requires either an assigned department or an assigned laboratory, but not both.'
  );
  await check(
    'custodian invalid department',
    await runValidation('Custodian', { assigned_department_id: 999999, assigned_location_id: null }),
    'Selected department does not exist.'
  );
  if (validDeptId) {
    await check(
      'custodian valid department',
      await runValidation('Custodian', { assigned_department_id: validDeptId, assigned_location_id: null }),
      null
    );
  }

  await check(
    'custodian invalid location',
    await runValidation('Custodian', { assigned_department_id: null, assigned_location_id: 999999 }),
    'Selected laboratory does not exist.'
  );
  if (validLocId) {
    await check(
      'custodian valid location',
      await runValidation('Custodian', { assigned_department_id: null, assigned_location_id: validLocId }),
      null
    );
  }

  console.log(`\n${failed === 0 ? 'All integration checks passed.' : `${failed} check(s) failed.`}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error('Integration test error:', err.message);
  process.exit(1);
});
