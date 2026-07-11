const pool = require('../config/database');
const NotificationModel = require('../models/NotificationModel');
const MaintenanceModel = require('../models/MaintenanceModel');
const InventoryModel = require('../models/InventoryModel');
const {
  isAdministrator,
  isPropertyManager,
  isCustodian
} = require('./roleHelpers');
const { borrowLink } = require('./notificationLinks');

async function getUserIdsByRoles(roleNames) {
  if (!roleNames.length) return [];
  const placeholders = roleNames.map(() => '?').join(', ');
  const [rows] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name IN (${placeholders}) AND u.is_active = 1`,
    roleNames
  );
  return rows.map((r) => r.id);
}

async function getAdministratorIds() {
  return getUserIdsByRoles(['admin']);
}

async function getPropertyManagerIds() {
  return getUserIdsByRoles(['Property Manager']);
}

async function getDepartmentCustodianIds(departmentId) {
  if (!departmentId) return [];
  const [rows] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE u.is_active = 1
       AND u.assigned_department_id = ?
       AND r.name = 'Custodian'`,
    [departmentId]
  );
  return rows.map((r) => r.id);
}

async function getCustodianIdsForItem(item) {
  if (!item) return [];
  return getDepartmentCustodianIds(item.department_id);
}

function actorExcludeOptions(req) {
  const actorId = req?.session?.user?.id;
  return actorId ? { excludeUserIds: [actorId] } : {};
}

async function notifyUser(userId, payload, options = {}) {
  if (!userId) return;
  const exclude = new Set((options.excludeUserIds || []).map(Number));
  if (exclude.has(Number(userId))) return;
  const { title, message, type, reference_id = null, link_url = null, skipDuplicate = false } = payload;
  if (skipDuplicate && reference_id) {
    const exists = await NotificationModel.hasRecent(userId, type, reference_id);
    if (exists) return;
  }
  await NotificationModel.create({ user_id: userId, title, message, type, reference_id, link_url });
}

function resolveRecipientIds(userIds, options = {}) {
  const exclude = new Set((options.excludeUserIds || []).map(Number));
  return [...new Set((userIds || []).map(Number))].filter((id) => id && !exclude.has(id));
}

async function notifyUsers(userIds, payload, options = {}) {
  const uniqueIds = resolveRecipientIds(userIds, options);
  await Promise.all(uniqueIds.map((id) => notifyUser(id, payload)));
}

/** Notify Property Managers for operational workflow events */
async function notifyPropertyManagers(payload, options = {}) {
  await notifyUsers(await getPropertyManagerIds(), payload, options);
}

/** Notify system administrators for governance / visibility events */
async function notifyAdministrators(payload, options = {}) {
  await notifyUsers(await getAdministratorIds(), payload, options);
}

/** Notify custodians assigned to the item's department or laboratory */
async function notifyCustodiansForItem(item, payload, options = {}) {
  await notifyUsers(await getCustodianIdsForItem(item), payload, options);
}

async function notifyCustodiansForBorrowTransaction(transaction, buildPayload, options = {}) {
  for (const line of transaction?.items || []) {
    const item = await InventoryModel.findById(line.inventory_item_id);
    if (!item) continue;
    const payload = buildPayload(item, line, transaction);
    await notifyCustodiansForItem(item, payload, options);
  }
}

async function checkDueDateReminders(userId, roleName) {
  if (!isCustodian(roleName) && !isAdministrator(roleName) && !isPropertyManager(roleName)) {
    return;
  }

  const [borrows] = await pool.query(
    `SELECT id, transaction_code, borrower_id, expected_return_date, status
     FROM borrow_transactions
     WHERE borrower_id = ? AND status IN ('Borrowed', 'Approved', 'Overdue')
       AND expected_return_date IS NOT NULL`,
    [userId]
  );

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const b of borrows) {
    const due = new Date(b.expected_return_date);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays === 1) {
      await notifyUser(userId, {
        title: 'Item Due Soon',
        message: `Your borrowed item (${b.transaction_code}) is due tomorrow.`,
        type: 'due_soon',
        reference_id: b.id,
        link_url: borrowLink(b.id),
        skipDuplicate: true
      });
    } else if (diffDays < 0) {
      await notifyUser(userId, {
        title: 'Item Overdue',
        message: `Your borrowed item (${b.transaction_code}) is overdue.`,
        type: 'overdue',
        reference_id: b.id,
        link_url: borrowLink(b.id),
        skipDuplicate: true
      });
    }
  }
}

async function checkOverdueBorrowAlertsForPropertyManagers() {
  const [rows] = await pool.query(
    `SELECT id, transaction_code, borrower_name
     FROM borrow_transactions
     WHERE status IN ('Borrowed', 'Approved', 'Overdue')
       AND expected_return_date IS NOT NULL
       AND expected_return_date < CURDATE()`
  );

  const managerIds = await getPropertyManagerIds();
  for (const borrow of rows) {
    await notifyUsers(managerIds, {
      title: 'Overdue Borrow Alert',
      message: `${borrow.borrower_name}'s borrow request (${borrow.transaction_code}) is overdue.`,
      type: 'borrow_overdue_alert',
      reference_id: borrow.id,
      link_url: borrowLink(borrow.id),
      skipDuplicate: true
    });
  }
}

async function checkMaintenanceReminders(userId, roleName) {
  const receivesMaintenanceDue = isPropertyManager(roleName);
  const upcoming = await MaintenanceModel.getUpcomingOnItems();

  for (const item of upcoming) {
    const due = new Date(item.next_maintenance_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays > 7 || diffDays < 0) continue;

    if (receivesMaintenanceDue) {
      await notifyUser(userId, {
        title: 'Maintenance Due',
        message: `${item.item_name} (${item.item_code}) maintenance is due on ${item.next_maintenance_date}.`,
        type: 'maintenance_due',
        reference_id: item.id,
        link_url: '/pages/inventory.html',
        skipDuplicate: true
      });
    }

    const custodianIds = await getCustodianIdsForItem(item);
    if (custodianIds.includes(userId)) {
      await notifyUser(userId, {
        title: 'Maintenance Notice',
        message: `Maintenance for assigned asset ${item.item_name} is due on ${item.next_maintenance_date}.`,
        type: 'maintenance_notice',
        reference_id: item.id,
        link_url: '/pages/inventory.html',
        skipDuplicate: true
      });
    } else if (item.custodian_id === userId) {
      await notifyUser(userId, {
        title: 'Maintenance Notice',
        message: `Maintenance for ${item.item_name} is due on ${item.next_maintenance_date}.`,
        type: 'maintenance_notice',
        reference_id: item.id,
        link_url: '/pages/inventory.html',
        skipDuplicate: true
      });
    }
  }
}

async function runNotificationChecks(user) {
  if (!user?.id) return;
  const roleName = user.role;

  await checkDueDateReminders(user.id, roleName);

  if (isPropertyManager(roleName)) {
    await checkOverdueBorrowAlertsForPropertyManagers();
  }

  if (isPropertyManager(roleName) || isCustodian(roleName)) {
    await checkMaintenanceReminders(user.id, roleName);
  }
}

module.exports = {
  actorExcludeOptions,
  notifyUser,
  notifyUsers,
  notifyPropertyManagers,
  notifyAdministrators,
  notifyCustodiansForItem,
  notifyCustodiansForBorrowTransaction,
  getCustodianIdsForItem,
  checkDueDateReminders,
  checkOverdueBorrowAlertsForPropertyManagers,
  checkMaintenanceReminders,
  runNotificationChecks
};
