/**
 * Seed sample notifications for demo/testing
 * Run: node database/seed-notifications.js
 */
require('dotenv').config();
const pool = require('../config/database');

async function seedNotifications() {
  const samples = [
    [1, 'New Borrow Request', 'Inventory Staff submitted a borrow request (BRW-2024-004) for Science Textbook.', 'borrow_request', 4, '/pages/orders.html', 0],
    [1, 'Low Stock Alert', 'Whiteboard Marker (OFF-002) is now low in stock (8 remaining).', 'low_stock', 14, '/pages/inventory.html?low_stock=true', 0],
    [1, 'Item Returned', 'Inventory Staff returned items (RTN-2024-001): LCD Projector.', 'borrow_returned', 1, '/pages/orders.html', 1],
    [2, 'Borrow Request Approved', 'Your request to borrow (BRW-2024-003) has been approved.', 'borrow_approved', 3, '/pages/orders.html', 0],
    [2, 'Borrow Request Rejected', 'Your request to borrow (BRW-2024-008) has been rejected.', 'borrow_rejected', 8, '/pages/orders.html', 1],
    [2, 'Return Recorded', 'Your returned item (RTN-2024-001) has been successfully processed.', 'return_recorded', 1, '/pages/orders.html', 1]
  ];

  for (const row of samples) {
    await pool.query(
      `INSERT INTO notifications (user_id, title, message, type, reference_id, link_url, is_read)
       SELECT ?, ?, ?, ?, ?, ?, ?
       WHERE NOT EXISTS (
         SELECT 1 FROM notifications WHERE user_id = ? AND type = ? AND reference_id <=> ?
       )`,
      [...row, row[0], row[3], row[4]]
    );
  }

  const [adminUnread] = await pool.query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = 1 AND is_read = 0'
  );
  const [staffUnread] = await pool.query(
    'SELECT COUNT(*) AS c FROM notifications WHERE user_id = 2 AND is_read = 0'
  );
  console.log(`Sample notifications seeded. Admin unread: ${adminUnread[0].c}, Staff unread: ${staffUnread[0].c}`);
  process.exit(0);
}

seedNotifications().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
