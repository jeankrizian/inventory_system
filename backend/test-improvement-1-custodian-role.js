const {
  resolveRoleDbName,
  formatRoleDisplayName,
  isCustodian,
  getAccessScope
} = require('./utils/roleHelpers');
const {
  normalizeAssetCustodianType,
  isValidAssetCustodianType,
  formatAssetCustodianTypeLabel
} = require('./utils/custodianTypeLabels');
const DashboardModel = require('./models/DashboardModel');
const { getBorrowListScope } = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

assert(resolveRoleDbName('Department Custodian') === 'Custodian', 'Legacy department role resolves to Custodian');
assert(resolveRoleDbName('Laboratory Custodian') === 'Custodian', 'Legacy laboratory role resolves to Custodian');
assert(resolveRoleDbName('Custodian') === 'Custodian', 'Unified custodian role preserved');
assert(formatRoleDisplayName('Department Custodian') === 'Custodian', 'Legacy role displays as Custodian');
assert(isCustodian('Department Custodian'), 'Legacy role still treated as custodian for permissions');

const deptScope = getAccessScope({
  id: 3,
  role: 'Department Custodian',
  assigned_department_id: 5
});
assert(deptScope.type === 'department' && deptScope.departmentId === 5, 'Legacy role keeps assignment scope');

const modules = DashboardModel.getDashboardModules({
  user: { id: 1, role: 'Custodian', assigned_department_id: 2 },
  inventoryScope: getAccessScope({ id: 1, role: 'Custodian', assigned_department_id: 2 }),
  borrowScope: getBorrowListScope({ id: 1, role: 'Custodian', assigned_department_id: 2 })
});
assert(modules.inventoryStats && modules.transferStats, 'Unified custodian dashboard modules remain available');

assert(normalizeAssetCustodianType('Department Custodian') === 'Department', 'Legacy asset custodian type normalized');
assert(normalizeAssetCustodianType('Laboratory Custodian') === 'Laboratory', 'Legacy laboratory asset type normalized');
assert(isValidAssetCustodianType('Department'), 'Department asset custodian type valid');
assert(formatAssetCustodianTypeLabel('Department Custodian') === 'Department', 'Asset custodian label normalized');

console.log('Improvement 1 custodian role simplification tests OK');
