const DashboardModel = require('./models/DashboardModel');
const { getAccessScope, getBorrowListScope } = require('./utils/roleHelpers');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function modulesFor(role, assignment = {}) {
  return DashboardModel.getDashboardModules({
    user: { id: 1, role, ...assignment },
    inventoryScope: getAccessScope({ id: 1, role, ...assignment }),
    borrowScope: getBorrowListScope({ id: 1, role, ...assignment })
  });
}

const admin = modulesFor('admin');
const pm = modulesFor('Property Manager');
const custodian = modulesFor('Custodian', { assigned_department_id: 2 });
const employee = modulesFor('staff');

assert(admin.usersStats, 'Administrator dashboard shows users summary');
assert(admin.charts, 'Administrator dashboard shows charts');
assert(!admin.personalBorrowStats, 'Administrator dashboard hides personal borrow stats');

assert(pm.pendingApprovals, 'Property Manager dashboard shows pending approvals');
assert(pm.recentBorrows, 'Property Manager dashboard shows recent borrows');

assert(custodian.inventoryStats, 'Custodian dashboard shows assigned assets summary');
assert(custodian.lowStock, 'Custodian dashboard shows low stock');
assert(custodian.activities, 'Custodian dashboard shows assigned asset activity');
assert(!custodian.recentBorrows, 'Custodian dashboard hides school-wide borrow table');
assert(!custodian.recentReturns, 'Custodian dashboard hides return processing table');
assert(custodian.transferStats && custodian.maintenanceStats && custodian.disposalStats,
  'Custodian dashboard shows pending operational summaries');

assert(employee.personalBorrowStats, 'Employee dashboard shows personal borrow summary');
assert(!employee.inventoryStats, 'Employee dashboard hides inventory summary');
assert(employee.recentBorrows, 'Employee dashboard shows borrow history');

console.log('Dashboard module unit tests OK');
