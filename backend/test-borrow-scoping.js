const { getBorrowListScope, getAccessScope } = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const adminBorrowScope = getBorrowListScope({ id: 1, role: 'admin' });
const pmBorrowScope = getBorrowListScope({ id: 2, role: 'Property Manager' });
const deptBorrowScope = getBorrowListScope({
  id: 3,
  role: 'Custodian',
  assigned_department_id: 5
});
const labBorrowScope = getBorrowListScope({
  id: 4,
  role: 'Custodian',
  assigned_location_id: 2
});
const employeeBorrowScope = getBorrowListScope({ id: 5, role: 'staff' });

const deptInventoryScope = getAccessScope({
  id: 3,
  role: 'Custodian',
  assigned_department_id: 5
});

assert(adminBorrowScope.type === 'all', 'Administrator borrow list is school-wide');
assert(pmBorrowScope.type === 'all', 'Property Manager borrow list is school-wide');
assert(deptBorrowScope.type === 'own', 'Department custodian borrow list is own requests only');
assert(labBorrowScope.type === 'own', 'Laboratory custodian borrow list is own requests only');
assert(employeeBorrowScope.type === 'own', 'Employee borrow list is own requests only');
assert(deptInventoryScope.type === 'department', 'Inventory scope remains assigned for custodian');

console.log('Borrow scoping unit tests OK');
