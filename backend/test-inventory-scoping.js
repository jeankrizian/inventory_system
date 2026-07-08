const {
  getAccessScope,
  canViewInventory,
  isInventoryScopeDenied,
  itemMatchesScope
} = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const adminScope = getAccessScope({ id: 1, role: 'admin' });
const pmScope = getAccessScope({ id: 2, role: 'Property Manager' });
const deptScope = getAccessScope({
  id: 3,
  role: 'Custodian',
  assigned_department_id: 5
});
const labScope = getAccessScope({
  id: 4,
  role: 'Custodian',
  assigned_location_id: 2
});
const employeeScope = getAccessScope({ id: 5, role: 'staff' });

assert(adminScope.type === 'all', 'Administrator should see all inventory');
assert(pmScope.type === 'all', 'Property Manager should see all inventory');
assert(deptScope.type === 'department' && deptScope.departmentId === 5, 'Department custodian scope');
assert(labScope.type === 'location' && labScope.locationId === 2, 'Laboratory custodian scope');
assert(employeeScope.type === 'denied', 'Employee should have no inventory scope');
assert(isInventoryScopeDenied(employeeScope), 'Employee inventory scope is denied');
assert(canViewInventory('admin'), 'Administrator can view inventory');
assert(canViewInventory('Property Manager'), 'Property Manager can view inventory');
assert(canViewInventory('Custodian'), 'Custodian can view inventory');
assert(!canViewInventory('staff'), 'Employee cannot view inventory');
assert(itemMatchesScope({ department_id: 5, location_id: 1 }, deptScope), 'Department item in scope');
assert(!itemMatchesScope({ department_id: 9, location_id: 1 }, deptScope), 'Department item out of scope');
assert(itemMatchesScope({ department_id: 9, location_id: 2 }, labScope), 'Location item in scope');
assert(!itemMatchesScope({ department_id: 9, location_id: 3 }, labScope), 'Location item out of scope');

console.log('Inventory scoping unit tests OK');
