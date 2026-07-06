/**
 * Integration smoke test for custodian validation against the database.
 * Run: node scripts/verify-custodian-validation-db.js
 */
require('dotenv').config();
const CategoryModel = require('../models/CategoryModel');
const LocationModel = require('../models/LocationModel');
const UserModel = require('../models/UserModel');

async function runValidation(roleName, assignments) {
  const { normalizeRoleName, isDepartmentCustodian, isLaboratoryCustodian } = require('../utils/roleHelpers');
  const normalized = normalizeRoleName(roleName);

  if (isDepartmentCustodian(normalized)) {
    if (assignments.assigned_department_id == null) {
      return 'Department Custodian requires an assigned department.';
    }
    const dept = await CategoryModel.findById(assignments.assigned_department_id);
    if (!dept) return 'Selected department does not exist.';
  }

  if (isLaboratoryCustodian(normalized)) {
    if (assignments.assigned_location_id == null) {
      return 'Laboratory Custodian requires an assigned laboratory.';
    }
    const loc = await LocationModel.findById(assignments.assigned_location_id);
    if (!loc) return 'Selected laboratory does not exist.';
  }

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
    'dept custodian missing department',
    await runValidation('Department Custodian', { assigned_department_id: null, assigned_location_id: null }),
    'Department Custodian requires an assigned department.'
  );
  await check(
    'dept custodian invalid department',
    await runValidation('Department Custodian', { assigned_department_id: 999999, assigned_location_id: null }),
    'Selected department does not exist.'
  );
  if (validDeptId) {
    await check(
      'dept custodian valid department',
      await runValidation('Department Custodian', { assigned_department_id: validDeptId, assigned_location_id: null }),
      null
    );
  }

  await check(
    'lab custodian missing location',
    await runValidation('Laboratory Custodian', { assigned_department_id: null, assigned_location_id: null }),
    'Laboratory Custodian requires an assigned laboratory.'
  );
  await check(
    'lab custodian invalid location',
    await runValidation('Laboratory Custodian', { assigned_department_id: null, assigned_location_id: 999999 }),
    'Selected laboratory does not exist.'
  );
  if (validLocId) {
    await check(
      'lab custodian valid location',
      await runValidation('Laboratory Custodian', { assigned_department_id: null, assigned_location_id: validLocId }),
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
