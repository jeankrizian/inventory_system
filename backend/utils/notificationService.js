const pool = require('../config/database');
const NotificationModel = require('../models/NotificationModel');
const MaintenanceModel = require('../models/MaintenanceModel');

async function getAdminUserIds() {
  const [rows] = await pool.query(
    `SELECT u.id FROM users u
     JOIN roles r ON u.role_id = r.id
     WHERE r.name = 'admin' AND u.is_active = 1`
  );
  return rows.map(r => r.id);
}

async function notifyUser(userId, payload) {
  if (!userId) return;
  const { title, message, type, reference_id = null, link_url = null, skipDuplicate = false } = payload;
  if (skipDuplicate && reference_id) {
    const exists = await NotificationModel.hasRecent(userId, type, reference_id);
    if (exists) return;
  }
  await NotificationModel.create({ user_id: userId, title, message, type, reference_id, link_url });
}

async function notifyAdmins(payload) {
  const adminIds = await getAdminUserIds();
  await Promise.all(adminIds.map(id => notifyUser(id, payload)));
}

async function checkDueDateReminders(userId) {
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
        link_url: '/pages/orders.html',
        skipDuplicate: true
      });
    } else if (diffDays < 0) {
      await notifyUser(userId, {
        title: 'Item Overdue',
        message: `Your borrowed item (${b.transaction_code}) is overdue.`,
        type: 'overdue',
        reference_id: b.id,
        link_url: '/pages/orders.html',
        skipDuplicate: true
      });
    }
  }
}

async function checkMaintenanceReminders(userId) {
  const isAdmin = (await pool.query(
    `SELECT r.name FROM users u JOIN roles r ON u.role_id = r.id WHERE u.id = ?`,
    [userId]
  ))[0][0]?.name === 'admin';

  const upcoming = await MaintenanceModel.getUpcomingOnItems();

  for (const item of upcoming) {
    const due = new Date(item.next_maintenance_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    const diffDays = Math.round((due - today) / (1000 * 60 * 60 * 24));

    if (diffDays <= 7 && diffDays >= 0) {
      if (isAdmin) {
        await notifyUser(userId, {
          title: 'Maintenance Due',
          message: `${item.item_name} (${item.item_code}) maintenance is due on ${item.next_maintenance_date}.`,
          type: 'maintenance_due',
          reference_id: item.id,
          link_url: '/pages/inventory.html',
          skipDuplicate: true
        });
      }
      if (item.custodian_id === userId) {
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
}

module.exports = { notifyUser, notifyAdmins, checkDueDateReminders, checkMaintenanceReminders };
