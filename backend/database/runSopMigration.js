/**
 * SOP migration runner - safe to run multiple times
 */
const pool = require('../config/database');

const migrations = [
  `ALTER TABLE departments ADD COLUMN department_head VARCHAR(100) NULL AFTER description`,
  `ALTER TABLE departments ADD COLUMN custodian_id INT NULL AFTER department_head`,
  `ALTER TABLE departments ADD COLUMN custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL AFTER custodian_id`,
  `ALTER TABLE inventory_items MODIFY COLUMN status ENUM('Available', 'Borrowed', 'Low Stock', 'Out of Stock', 'Under Maintenance', 'Disposed') DEFAULT 'Available'`,
  `ALTER TABLE inventory_items ADD COLUMN asset_classification ENUM('Fixed Asset', 'Semi-Durable', 'Consumable') DEFAULT 'Consumable' AFTER department_id`,
  `ALTER TABLE inventory_items ADD COLUMN property_tag VARCHAR(50) NULL AFTER asset_classification`,
  `ALTER TABLE inventory_items ADD COLUMN custodian_id INT NULL AFTER property_tag`,
  `ALTER TABLE inventory_items ADD COLUMN custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL AFTER custodian_id`,
  `ALTER TABLE inventory_items ADD COLUMN parent_asset_id INT NULL AFTER custodian_type`,
  `ALTER TABLE inventory_items ADD COLUMN acquisition_date DATE NULL AFTER purchase_date`,
  `ALTER TABLE inventory_items ADD COLUMN maintenance_schedule ENUM('Monthly', 'Quarterly', 'Semi-Annual', 'Annual') NULL AFTER location_id`,
  `ALTER TABLE inventory_items ADD COLUMN next_maintenance_date DATE NULL AFTER maintenance_schedule`,
  `ALTER TABLE inventory_items ADD COLUMN maintenance_status ENUM('Scheduled', 'In Progress', 'Completed', 'Overdue') NULL AFTER next_maintenance_date`,
  `ALTER TABLE inventory_items ADD COLUMN service_provider VARCHAR(150) NULL AFTER maintenance_status`,
  `CREATE UNIQUE INDEX idx_inventory_property_tag ON inventory_items(property_tag)`,
  `CREATE TABLE IF NOT EXISTS transfer_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_code VARCHAR(50) NOT NULL UNIQUE,
    inventory_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    from_location_id INT NULL,
    to_location_id INT NULL,
    from_department_id INT NULL,
    to_department_id INT NULL,
    reason TEXT NOT NULL,
    status ENUM('Pending', 'Approved', 'Rejected', 'Completed') DEFAULT 'Pending',
    requested_by INT NOT NULL,
    approved_by INT NULL,
    approved_at TIMESTAMP NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (from_location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (to_location_id) REFERENCES locations(id) ON DELETE SET NULL,
    FOREIGN KEY (from_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (to_department_id) REFERENCES departments(id) ON DELETE SET NULL,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS disposal_requests (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transaction_code VARCHAR(50) NOT NULL UNIQUE,
    inventory_item_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    reason TEXT NOT NULL,
    inspection_notes TEXT,
    disposal_method ENUM('Auction', 'Donation', 'Recycling', 'Destruction', 'Trade-In', 'Other') NULL,
    status ENUM('Pending', 'Inspected', 'Approved', 'Rejected', 'Completed') DEFAULT 'Pending',
    requested_by INT NOT NULL,
    inspected_by INT NULL,
    approved_by INT NULL,
    disposal_date DATE NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT,
    FOREIGN KEY (requested_by) REFERENCES users(id) ON DELETE RESTRICT,
    FOREIGN KEY (inspected_by) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS maintenance_records (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_item_id INT NOT NULL,
    maintenance_type ENUM('Preventive', 'Corrective') DEFAULT 'Preventive',
    scheduled_date DATE NOT NULL,
    completed_date DATE NULL,
    service_provider VARCHAR(150),
    status ENUM('Scheduled', 'In Progress', 'Completed', 'Overdue') DEFAULT 'Scheduled',
    description TEXT,
    cost DECIMAL(12,2) NULL,
    performed_by INT NULL,
    next_maintenance_date DATE NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (performed_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE TABLE IF NOT EXISTS component_replacements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parent_asset_id INT NOT NULL,
    old_component_name VARCHAR(200) NOT NULL,
    new_inventory_item_id INT NULL,
    new_component_name VARCHAR(200) NULL,
    replaced_by INT NOT NULL,
    replacement_date DATE NOT NULL,
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_asset_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (new_inventory_item_id) REFERENCES inventory_items(id) ON DELETE SET NULL,
    FOREIGN KEY (replaced_by) REFERENCES users(id) ON DELETE RESTRICT
  )`,
  `CREATE INDEX idx_transfer_status ON transfer_requests(status)`,
  `CREATE INDEX idx_disposal_status ON disposal_requests(status)`,
  `CREATE INDEX idx_maintenance_item ON maintenance_records(inventory_item_id)`,
  `CREATE INDEX idx_maintenance_scheduled ON maintenance_records(scheduled_date)`,
  `CREATE INDEX idx_component_parent ON component_replacements(parent_asset_id)`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_CANT_CREATE_TABLE'].includes(err.code)
    || err.message.includes('Duplicate');
}

async function runSopMigration() {
  console.log('Running SOP migration...');
  for (const sql of migrations) {
    try {
      await pool.query(sql);
    } catch (err) {
      if (!isIgnorable(err)) {
        console.error('Migration error:', err.message);
        throw err;
      }
    }
  }
  console.log('SOP migration completed.');
}

if (require.main === module) {
  runSopMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runSopMigration };
