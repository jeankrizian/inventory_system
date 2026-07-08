const {
  canAccessReports,
  canSubmitTransfer,
  canSubmitMaintenance,
  canSubmitDisposal,
  canOperateTransfers,
  canOperateMaintenance,
  canOperateDisposal,
  canViewInventory,
  canViewAllBorrows,
  canViewTransfers,
  canViewMaintenance,
  canViewDisposal,
  getBorrowListScope,
  getAccessScope,
  transferMatchesScope
} = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const custodian = 'Custodian';
const pm = 'Property Manager';
const admin = 'Administrator';
const employee = 'Employee';

assert(canAccessReports(custodian), 'Custodian can access reports');
assert(!canAccessReports(employee), 'Employee cannot access reports');
assert(canAccessReports(pm), 'Property Manager can access reports');
assert(canAccessReports(admin), 'Administrator can access reports');

assert(canSubmitTransfer(custodian), 'Custodian can submit transfers');
assert(canSubmitMaintenance(custodian), 'Custodian can submit maintenance');
assert(canSubmitDisposal(custodian), 'Custodian can submit disposal');

assert(!canOperateTransfers(custodian), 'Custodian cannot operate transfers');
assert(!canOperateMaintenance(custodian), 'Custodian cannot operate maintenance');
assert(!canOperateDisposal(custodian), 'Custodian cannot operate disposal');

assert(canOperateTransfers(pm), 'Property Manager can operate transfers');
assert(canOperateMaintenance(pm), 'Property Manager can operate maintenance');
assert(canOperateDisposal(pm), 'Property Manager can operate disposal');

assert(canViewInventory(custodian), 'Custodian can view inventory module');
assert(!canViewAllBorrows(custodian), 'Custodian borrow list is not school-wide');
assert(canViewTransfers(custodian), 'Custodian can view transfers');
assert(canViewMaintenance(custodian), 'Custodian can view maintenance');
assert(canViewDisposal(custodian), 'Custodian can view disposal');

const custodianBorrowScope = getBorrowListScope({
  id: 10,
  role: 'Custodian',
  assigned_department_id: 2
});
const custodianInventoryScope = getAccessScope({
  id: 10,
  role: 'Custodian',
  assigned_department_id: 2
});

assert(custodianBorrowScope.type === 'own', 'Custodian borrow transactions are own requests only');
assert(custodianInventoryScope.type === 'department', 'Custodian inventory scope stays department-based');
assert(
  transferMatchesScope({ from_department_id: 2, to_department_id: 5 }, custodianInventoryScope),
  'Custodian transfer scope matches involved departments'
);
assert(
  !transferMatchesScope({ from_department_id: 3, to_department_id: 5 }, custodianInventoryScope),
  'Custodian transfer scope excludes unrelated departments'
);

console.log('Custodian modules unit tests OK');
