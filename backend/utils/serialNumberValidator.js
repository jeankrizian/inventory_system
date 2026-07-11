const pool = require('../config/database');

function normalizeSerialNumber(value) {
  if (value == null) return null;
  const trimmed = String(value).trim();
  return trimmed || null;
}

async function findConflictingSerialNumber(serial, conn = pool, excludeIds = []) {
  const normalized = normalizeSerialNumber(serial);
  if (!normalized) return null;

  const params = [normalized];
  let sql = `SELECT id, serial_number FROM inventory_items
             WHERE serial_number = ? AND is_archived = 0`;

  if (excludeIds.length) {
    sql += ` AND id NOT IN (${excludeIds.map(() => '?').join(', ')})`;
    params.push(...excludeIds);
  }

  const [rows] = await conn.query(sql, params);
  return rows[0] || null;
}

async function validateSerialNumberUnique(serial, conn = pool, excludeIds = []) {
  const conflict = await findConflictingSerialNumber(serial, conn, excludeIds);
  if (conflict) {
    throw new Error(`Serial number already exists: ${conflict.serial_number}`);
  }
  return true;
}

module.exports = {
  normalizeSerialNumber,
  findConflictingSerialNumber,
  validateSerialNumberUnique
};
