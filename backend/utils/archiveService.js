const pool = require('../config/database');

const ARCHIVE_MODULES = {
  inventory: {
    table: 'inventory_items',
    module: 'Inventory',
    titleSql: 'item_name',
    detailSql: 'item_code'
  },
  department: {
    table: 'departments',
    module: 'Department',
    titleSql: 'name',
    detailSql: 'code'
  },
  location: {
    table: 'locations',
    module: 'Location',
    titleSql: 'name',
    detailSql: 'description'
  },
  supplier: {
    table: 'suppliers',
    module: 'Supplier',
    titleSql: 'name',
    detailSql: 'contact_person'
  },
  user: {
    table: 'users',
    module: 'User',
    titleSql: 'full_name',
    detailSql: 'username'
  }
};

const ARCHIVE_TABLES = Object.values(ARCHIVE_MODULES).map(m => m.table);

async function archiveRecord(table, id, userId) {
  const [result] = await pool.query(
    `UPDATE ${table} SET is_archived = 1, archived_at = NOW(), archived_by = ?
     WHERE id = ? AND (is_archived = 0 OR is_archived IS NULL)`,
    [userId, id]
  );
  if (result.affectedRows > 0 && table === 'users') {
    await pool.query('UPDATE users SET is_active = 0 WHERE id = ?', [id]);
  }
  return result.affectedRows > 0;
}

async function restoreRecord(table, id) {
  const [result] = await pool.query(
    `UPDATE ${table} SET is_archived = 0, archived_at = NULL, archived_by = NULL WHERE id = ? AND is_archived = 1`,
    [id]
  );
  if (result.affectedRows > 0 && table === 'users') {
    await pool.query('UPDATE users SET is_active = 1 WHERE id = ?', [id]);
  }
  return result.affectedRows > 0;
}

async function purgeExpiredRecords() {
  let total = 0;
  for (const table of ARCHIVE_TABLES) {
    const [result] = await pool.query(
      `DELETE FROM ${table} WHERE is_archived = 1 AND archived_at < DATE_SUB(NOW(), INTERVAL 30 DAY)`
    );
    total += result.affectedRows;
  }
  return total;
}

function getModuleConfig(moduleKey) {
  return ARCHIVE_MODULES[moduleKey] || null;
}

module.exports = {
  ARCHIVE_MODULES,
  ARCHIVE_TABLES,
  archiveRecord,
  restoreRecord,
  purgeExpiredRecords,
  getModuleConfig
};
