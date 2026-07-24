/**
 * PRODUCTION-SAFE: Permanently delete Archive module records only.
 * Deletes rows where is_archived = 1 (inventory + other archive modules if any).
 * Does NOT touch active (is_archived = 0) inventory or other active records.
 *
 * Usage: node database/purgeArchiveRecords.js
 * Dry run: node database/purgeArchiveRecords.js --dry-run
 */
require('dotenv').config();
const pool = require('../config/database');

const DRY_RUN = process.argv.includes('--dry-run');

async function countWith(connOrPool, sql, params = []) {
  const [rows] = await connOrPool.query(sql, params);
  return Number(rows[0]?.c || 0);
}

async function snapshot(connOrPool) {
  return {
    archivedInventory: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM inventory_items WHERE is_archived = 1'),
    activeInventory: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM inventory_items WHERE is_archived = 0'),
    archivedDepartments: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM departments WHERE is_archived = 1'),
    archivedLocations: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM locations WHERE is_archived = 1'),
    archivedSuppliers: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM suppliers WHERE is_archived = 1'),
    archivedUsers: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM users WHERE is_archived = 1'),
    activeDepartments: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM departments WHERE is_archived = 0'),
    activeLocations: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM locations WHERE is_archived = 0'),
    activeSuppliers: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM suppliers WHERE is_archived = 0'),
    activeUsers: await countWith(connOrPool, 'SELECT COUNT(*) AS c FROM users WHERE is_archived = 0 OR is_archived IS NULL')
  };
}

async function main() {
  const conn = await pool.getConnection();
  try {
    const before = await snapshot(pool);

    const archiveTotal =
      before.archivedInventory +
      before.archivedDepartments +
      before.archivedLocations +
      before.archivedSuppliers +
      before.archivedUsers;

    console.log('=== BEFORE ===');
    console.log(JSON.stringify(before, null, 2));
    console.log('Archive total:', archiveTotal);

    if (archiveTotal === 0) {
      console.log('Archive already empty. Nothing to do.');
      return;
    }

    const blockers = {
      borrow_items: await countWith(
        pool,
        `SELECT COUNT(*) AS c FROM borrow_items bi
         JOIN inventory_items i ON i.id = bi.inventory_item_id
         WHERE i.is_archived = 1`
      ),
      transfer_requests: await countWith(
        pool,
        `SELECT COUNT(*) AS c FROM transfer_requests t
         JOIN inventory_items i ON i.id = t.inventory_item_id
         WHERE i.is_archived = 1`
      ),
      disposal_requests: await countWith(
        pool,
        `SELECT COUNT(*) AS c FROM disposal_requests d
         JOIN inventory_items i ON i.id = d.inventory_item_id
         WHERE i.is_archived = 1`
      ),
      active_inventory_on_archived_locations: await countWith(
        pool,
        `SELECT COUNT(*) AS c FROM inventory_items i
         JOIN locations l ON l.id = i.location_id
         WHERE l.is_archived = 1 AND i.is_archived = 0`
      ),
      users_on_archived_locations: await countWith(
        pool,
        `SELECT COUNT(*) AS c FROM users u
         JOIN locations l ON l.id = u.assigned_location_id
         WHERE l.is_archived = 1`
      )
    };
    console.log('=== BLOCKERS / SAFETY CHECKS ===');
    console.log(JSON.stringify(blockers, null, 2));

    if (blockers.active_inventory_on_archived_locations > 0) {
      throw new Error(
        'Abort: active inventory still references archived locations. Will not delete those locations.'
      );
    }

    if (DRY_RUN) {
      console.log('Dry run only. No changes made.');
      return;
    }

    await conn.beginTransaction();

    // Clear parent links pointing at archived parents (active or archived children).
    await conn.query(
      `UPDATE inventory_items child
       JOIN inventory_items parent ON child.parent_asset_id = parent.id
       SET child.parent_asset_id = NULL
       WHERE parent.is_archived = 1`
    );

    // Remove RESTRICT children scoped to archived inventory only.
    await conn.query(
      `DELETE bi FROM borrow_items bi
       INNER JOIN inventory_items i ON i.id = bi.inventory_item_id
       WHERE i.is_archived = 1`
    );
    await conn.query(
      `DELETE t FROM transfer_requests t
       INNER JOIN inventory_items i ON i.id = t.inventory_item_id
       WHERE i.is_archived = 1`
    );
    await conn.query(
      `DELETE d FROM disposal_requests d
       INNER JOIN inventory_items i ON i.id = d.inventory_item_id
       WHERE i.is_archived = 1`
    );

    // Permanent delete archived inventory (CASCADE handles maintenance/components/history).
    const [invDel] = await conn.query('DELETE FROM inventory_items WHERE is_archived = 1');

    // Clear user assignment to archived locations before deleting locations.
    await conn.query(
      `UPDATE users u
       JOIN locations l ON l.id = u.assigned_location_id
       SET u.assigned_location_id = NULL
       WHERE l.is_archived = 1`
    );

    const [locDel] = await conn.query('DELETE FROM locations WHERE is_archived = 1');
    const [deptDel] = await conn.query('DELETE FROM departments WHERE is_archived = 1');
    const [supDel] = await conn.query('DELETE FROM suppliers WHERE is_archived = 1');

    // Verify using the same transaction connection.
    const after = await snapshot(conn);

    if (after.activeInventory !== before.activeInventory) {
      throw new Error(
        `Abort: active inventory changed (${before.activeInventory} -> ${after.activeInventory})`
      );
    }
    if (after.activeDepartments !== before.activeDepartments) {
      throw new Error('Abort: active departments changed');
    }
    if (after.activeLocations !== before.activeLocations) {
      throw new Error('Abort: active locations changed');
    }
    if (after.activeSuppliers !== before.activeSuppliers) {
      throw new Error('Abort: active suppliers changed');
    }
    if (after.activeUsers !== before.activeUsers) {
      throw new Error('Abort: active users changed');
    }
    if (
      after.archivedInventory !== 0
      || after.archivedLocations !== 0
      || after.archivedDepartments !== 0
      || after.archivedSuppliers !== 0
    ) {
      throw new Error(`Abort: archive not empty after delete: ${JSON.stringify(after)}`);
    }

    await conn.commit();

    console.log('=== DELETED ===');
    console.log({
      inventory: invDel.affectedRows,
      locations: locDel.affectedRows,
      departments: deptDel.affectedRows,
      suppliers: supDel.affectedRows
    });
    console.log('=== AFTER ===');
    console.log(JSON.stringify(await snapshot(pool), null, 2));
    console.log('Archive purge completed successfully.');
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_e) {
      // ignore
    }
    console.error('FAILED:', err.message);
    process.exitCode = 1;
  } finally {
    conn.release();
    await pool.end();
  }
}

main();
