const pool = require('../config/database');

function normalizeChangeValue(value) {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

/**
 * Compare before/after records and return changed fields.
 * @returns {{ field_name: string, old_value: string|null, new_value: string|null }[]}
 */
function collectChanges(before = {}, after = {}, fields = []) {
  const changes = [];
  for (const field of fields) {
    const oldValue = normalizeChangeValue(before?.[field]);
    const newValue = normalizeChangeValue(after?.[field]);
    if (oldValue !== newValue) {
      changes.push({
        field_name: field,
        old_value: oldValue,
        new_value: newValue
      });
    }
  }
  return changes;
}

async function insertActivityLog({
  userId,
  action,
  module,
  description,
  ipAddress = null,
  entityType = null,
  entityId = null,
  referenceCode = null,
  fieldName = null,
  oldValue = null,
  newValue = null
}) {
  await pool.query(
    `INSERT INTO activity_logs
      (user_id, action, module, description, ip_address,
       entity_type, entity_id, field_name, old_value, new_value, reference_code)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId,
      action,
      module,
      description,
      ipAddress,
      entityType,
      entityId,
      fieldName,
      oldValue,
      newValue,
      referenceCode
    ]
  );
}

/**
 * Log user activity to activity_logs table.
 * Optional 6th argument may be metadata: { entity_type, entity_id, reference_code, field_name, old_value, new_value }
 */
async function logActivity(userId, action, module, description, ipAddress = null, meta = null) {
  try {
    const options = meta && typeof meta === 'object' ? meta : {};
    await insertActivityLog({
      userId,
      action,
      module,
      description,
      ipAddress,
      entityType: options.entity_type ?? null,
      entityId: options.entity_id ?? null,
      referenceCode: options.reference_code ?? null,
      fieldName: options.field_name ?? null,
      oldValue: options.old_value ?? null,
      newValue: options.new_value ?? null
    });
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

/**
 * Log an update with per-field change rows. Always writes at least one summary row.
 */
async function logActivityWithChanges(
  userId,
  action,
  module,
  description,
  ipAddress,
  entityType,
  entityId,
  referenceCode,
  changes = []
) {
  try {
    const list = Array.isArray(changes) ? changes : [];

    if (!list.length) {
      await insertActivityLog({
        userId,
        action,
        module,
        description,
        ipAddress,
        entityType,
        entityId,
        referenceCode
      });
      return;
    }

    for (const change of list) {
      await insertActivityLog({
        userId,
        action,
        module,
        description,
        ipAddress,
        entityType,
        entityId,
        referenceCode,
        fieldName: change.field_name,
        oldValue: change.old_value,
        newValue: change.new_value
      });
    }
  } catch (err) {
    console.error('Activity log error:', err.message);
  }
}

module.exports = { logActivity, logActivityWithChanges, collectChanges };
