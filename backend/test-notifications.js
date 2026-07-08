require('dotenv').config();
const pool = require('./config/database');
const {
  getCustodianIdsForItem,
  notifyUser,
  notifyPropertyManagers,
  notifyAdministrators,
  notifyCustodiansForItem,
  runNotificationChecks
} = require('./utils/notificationService');
const NotificationModel = require('./models/NotificationModel');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

(async () => {
  const [deptCustodians] = await pool.query(
    `SELECT u.id, u.assigned_department_id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = 'deptcust_test' AND r.name = 'Custodian'`
  );
  const [labCustodians] = await pool.query(
    `SELECT u.id, u.assigned_location_id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = 'labcust_test' AND r.name = 'Custodian'`
  );
  const [admins] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = 'admin' AND r.name = 'admin'`
  );
  const [pms] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.username = 'pm_test' AND r.name = 'Property Manager'`
  );

  assert(deptCustodians.length, 'deptcust_test account required');
  assert(labCustodians.length, 'labcust_test account required');
  assert(admins.length, 'admin account required');
  assert(pms.length, 'pm_test account required');

  const deptCustodianId = deptCustodians[0].id;
  const deptAssignmentId = deptCustodians[0].assigned_department_id;
  const labCustodianId = labCustodians[0].id;
  const labAssignmentId = labCustodians[0].assigned_location_id;
  const adminId = admins[0].id;
  const pmId = pms[0].id;

  assert(deptAssignmentId, 'deptcust_test must have assigned_department_id');
  assert(labAssignmentId, 'labcust_test must have assigned_location_id');

  const deptItem = { department_id: deptAssignmentId, location_id: 99 };
  const labItem = { department_id: 99, location_id: labAssignmentId };
  const deptIds = await getCustodianIdsForItem(deptItem);
  const labIds = await getCustodianIdsForItem(labItem);

  assert(deptIds.includes(deptCustodianId), 'Department custodian resolved for department item');
  assert(!deptIds.includes(labCustodianId), 'Lab custodian excluded for department-only item');
  assert(labIds.includes(labCustodianId), 'Lab custodian resolved for location item');
  assert(!labIds.includes(deptCustodianId), 'Dept custodian excluded for location-only item');

  const testRef = 999999001;
  await notifyUser(adminId, {
    title: 'Unit Test Notification',
    message: 'Role routing unit test',
    type: 'unit_test',
    reference_id: testRef,
    skipDuplicate: false
  });

  await notifyPropertyManagers({
    title: 'PM Unit Test',
    message: 'PM routing test',
    type: 'unit_test_pm',
    reference_id: testRef + 1,
    skipDuplicate: false
  });

  await notifyAdministrators({
    title: 'Admin Unit Test',
    message: 'Admin routing test',
    type: 'unit_test_admin',
    reference_id: testRef + 2,
    skipDuplicate: false
  });

  const pmNotes = await NotificationModel.getByUser(pmId, 5);
  assert(
    pmNotes.some((n) => n.type === 'unit_test_pm'),
    'Property Manager receives PM notifications'
  );

  const adminNotes = await NotificationModel.getByUser(adminId, 10);
  assert(
    adminNotes.some((n) => n.type === 'unit_test_admin'),
    'Administrator receives admin notifications'
  );
  assert(
    !adminNotes.some((n) => n.type === 'unit_test_pm'),
    'Administrator does not receive PM-only notifications from notifyPropertyManagers'
  );

  await notifyCustodiansForItem(deptItem, {
    title: 'Custodian Unit Test',
    message: 'Custodian routing test',
    type: 'unit_test_custodian',
    reference_id: testRef + 3,
    skipDuplicate: false
  });

  const custNotes = await NotificationModel.getByUser(deptCustodianId, 5);
  assert(
    custNotes.some((n) => n.type === 'unit_test_custodian'),
    'Department custodian receives assigned-asset notifications'
  );

  await runNotificationChecks({ id: adminId, role: 'admin' });
  await runNotificationChecks({ id: pmId, role: 'Property Manager' });

  await pool.query(
    `DELETE FROM notifications WHERE type LIKE 'unit_test%' OR reference_id IN (?, ?, ?, ?)`,
    [testRef, testRef + 1, testRef + 2, testRef + 3]
  );

  console.log('Role-based notification unit tests OK');
  process.exit(0);
})().catch((err) => {
  console.error('Notification unit test failed:', err.message);
  process.exit(1);
});
