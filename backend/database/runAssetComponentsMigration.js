const pool = require('../config/database');

async function tableExists(table) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  return rows.length > 0;
}

async function columnExists(table, column) {
  const [rows] = await pool.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [table, column]
  );
  return rows.length > 0;
}

async function runAssetComponentsMigration() {
  if (!(await tableExists('asset_components'))) {
    await pool.query(`
      CREATE TABLE asset_components (
        id INT AUTO_INCREMENT PRIMARY KEY,
        parent_asset_id INT NOT NULL,
        component_name VARCHAR(200) NOT NULL,
        brand VARCHAR(100) NULL,
        model VARCHAR(100) NULL,
        serial_number VARCHAR(100) NULL,
        date_installed DATE NULL,
        \`condition\` VARCHAR(50) NULL,
        status ENUM('Active', 'Replaced') NOT NULL DEFAULT 'Active',
        remarks TEXT NULL,
        created_by INT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_asset_components_parent (parent_asset_id),
        INDEX idx_asset_components_status (status),
        CONSTRAINT fk_asset_components_parent
          FOREIGN KEY (parent_asset_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
        CONSTRAINT fk_asset_components_created_by
          FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('Created asset_components table.');
  }

  if (await tableExists('component_replacements')) {
    if (!(await columnExists('component_replacements', 'old_component_id'))) {
      await pool.query(
        'ALTER TABLE component_replacements ADD COLUMN old_component_id INT NULL AFTER parent_asset_id'
      );
      console.log('Added old_component_id to component_replacements.');
    }
    if (!(await columnExists('component_replacements', 'new_component_id'))) {
      await pool.query(
        'ALTER TABLE component_replacements ADD COLUMN new_component_id INT NULL AFTER old_component_id'
      );
      console.log('Added new_component_id to component_replacements.');
    }
  }

  return { applied: true };
}

module.exports = { runAssetComponentsMigration };
