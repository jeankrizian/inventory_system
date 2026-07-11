const pool = require('../config/database');

class ArchiveBlockedError extends Error {
  constructor(message) {
    super(message);
    this.name = 'ArchiveBlockedError';
    this.statusCode = 400;
  }
}

const ACTIVE_USER_SQL = '(is_archived = 0 OR is_archived IS NULL)';
const ACTIVE_ITEM_SQL = 'is_archived = 0';

async function count(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return Number(rows[0]?.count || rows[0]?.c || 0);
}

async function getArchiveBlockers(table, id) {
  const blockers = [];

  if (table === 'departments') {
    const inventoryCount = await count(
      `SELECT COUNT(*) AS count FROM inventory_items
       WHERE department_id = ? AND ${ACTIVE_ITEM_SQL}`,
      [id]
    );
    if (inventoryCount > 0) {
      blockers.push(`${inventoryCount} active inventory item(s)`);
    }

    const userCount = await count(
      `SELECT COUNT(*) AS count FROM users
       WHERE assigned_department_id = ? AND ${ACTIVE_USER_SQL}`,
      [id]
    );
    if (userCount > 0) {
      blockers.push(`${userCount} user(s) assigned to this department`);
    }

    const transferCount = await count(
      `SELECT COUNT(*) AS count FROM transfer_requests
       WHERE status = 'Pending' AND (from_department_id = ? OR to_department_id = ?)`,
      [id, id]
    );
    if (transferCount > 0) {
      blockers.push(`${transferCount} pending transfer request(s)`);
    }
  }

  if (table === 'locations') {
    const inventoryCount = await count(
      `SELECT COUNT(*) AS count FROM inventory_items
       WHERE location_id = ? AND ${ACTIVE_ITEM_SQL}`,
      [id]
    );
    if (inventoryCount > 0) {
      blockers.push(`${inventoryCount} active inventory item(s)`);
    }

    const userCount = await count(
      `SELECT COUNT(*) AS count FROM users
       WHERE assigned_location_id = ? AND ${ACTIVE_USER_SQL}`,
      [id]
    );
    if (userCount > 0) {
      blockers.push(`${userCount} user(s) assigned to this location`);
    }

    const transferCount = await count(
      `SELECT COUNT(*) AS count FROM transfer_requests
       WHERE status = 'Pending' AND (from_location_id = ? OR to_location_id = ?)`,
      [id, id]
    );
    if (transferCount > 0) {
      blockers.push(`${transferCount} pending transfer request(s)`);
    }
  }

  if (table === 'suppliers') {
    const inventoryCount = await count(
      `SELECT COUNT(*) AS count FROM inventory_items
       WHERE supplier_id = ? AND ${ACTIVE_ITEM_SQL}`,
      [id]
    );
    if (inventoryCount > 0) {
      blockers.push(`${inventoryCount} active inventory item(s)`);
    }
  }

  if (table === 'users') {
    const departmentCount = await count(
      `SELECT COUNT(*) AS count FROM departments
       WHERE custodian_id = ? AND is_archived = 0`,
      [id]
    );
    if (departmentCount > 0) {
      blockers.push(`custodian for ${departmentCount} active department(s)`);
    }

    const inventoryCount = await count(
      `SELECT COUNT(*) AS count FROM inventory_items
       WHERE custodian_id = ? AND ${ACTIVE_ITEM_SQL}`,
      [id]
    );
    if (inventoryCount > 0) {
      blockers.push(`custodian for ${inventoryCount} active inventory item(s)`);
    }

    const borrowCount = await count(
      `SELECT COUNT(*) AS count FROM borrow_transactions
       WHERE borrower_id = ? AND status IN ('Pending', 'Approved', 'Borrowed', 'Overdue')`,
      [id]
    );
    if (borrowCount > 0) {
      blockers.push(`${borrowCount} active borrow transaction(s)`);
    }

    const transferCount = await count(
      `SELECT COUNT(*) AS count FROM transfer_requests
       WHERE requested_by = ? AND status = 'Pending'`,
      [id]
    );
    if (transferCount > 0) {
      blockers.push(`${transferCount} pending transfer request(s)`);
    }

    const maintenanceCount = await count(
      `SELECT COUNT(*) AS count FROM maintenance_records
       WHERE requested_by = ? AND status IN ('Pending', 'Scheduled', 'Ongoing', 'In Progress')`,
      [id]
    );
    if (maintenanceCount > 0) {
      blockers.push(`${maintenanceCount} open maintenance request(s)`);
    }

    const disposalCount = await count(
      `SELECT COUNT(*) AS count FROM disposal_requests
       WHERE requested_by = ? AND status IN ('Pending', 'Inspected')`,
      [id]
    );
    if (disposalCount > 0) {
      blockers.push(`${disposalCount} open disposal request(s)`);
    }
  }

  return blockers;
}

function formatArchiveBlockedMessage(entityLabel, blockers) {
  const detail = blockers.join('; ');
  return `Cannot archive this ${entityLabel} because it is still referenced by ${detail}. Reassign or complete those records first.`;
}

module.exports = {
  ArchiveBlockedError,
  getArchiveBlockers,
  formatArchiveBlockedMessage
};
