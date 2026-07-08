const {
  getAccessScope,
  isCustodian,
  isUnifiedCustodian,
  resolveRoleDbName,
  getCustodianScopeFromAssignments
} = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(resolveRoleDbName('Custodian') === 'Custodian', 'Custodian role resolves');
assert(isUnifiedCustodian('Custodian'), 'Unified custodian detected');
assert(isCustodian('Custodian'), 'Custodian included in isCustodian');
assert(isCustodian('Department Custodian'), 'Legacy role name still maps to custodian permissions');
assert(resolveRoleDbName('Department Custodian') === 'Custodian', 'Legacy role resolves to Custodian');

const deptScope = getAccessScope({
  id: 1,
  role: 'Custodian',
  assigned_department_id: 5,
  assigned_location_id: null
});
const labScope = getAccessScope({
  id: 2,
  role: 'Custodian',
  assigned_department_id: null,
  assigned_location_id: 3
});

assert(deptScope.type === 'department' && deptScope.departmentId === 5, 'Department-assigned custodian scope');
assert(labScope.type === 'location' && labScope.locationId === 3, 'Laboratory-assigned custodian scope');

const assignmentScope = getCustodianScopeFromAssignments({
  assigned_department_id: 2,
  assigned_location_id: null
});
assert(assignmentScope?.type === 'department', 'Assignment helper resolves department');

console.log('Custodian role unit tests OK');
