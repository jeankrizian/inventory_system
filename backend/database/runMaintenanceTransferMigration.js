const pool = require('../config/database');

const migrations = [
  `ALTER TABLE maintenance_records ADD COLUMN transaction_code VARCHAR(50) NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN requested_by INT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN requested_date DATE NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN reported_problem TEXT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN priority ENUM('Low', 'Medium', 'High') DEFAULT 'Medium'`,
  `ALTER TABLE maintenance_records ADD COLUMN technician VARCHAR(150) NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN admin_remarks TEXT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN completion_remarks TEXT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN rejection_reason TEXT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN approved_by INT NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN approved_at TIMESTAMP NULL`,
  `ALTER TABLE maintenance_records MODIFY COLUMN maintenance_type ENUM('Preventive', 'Corrective', 'Emergency') DEFAULT 'Preventive'`,
  `ALTER TABLE maintenance_records MODIFY COLUMN status ENUM('Pending', 'Approved', 'Scheduled', 'Ongoing', 'Completed', 'Cancelled', 'Overdue', 'In Progress') DEFAULT 'Pending'`,
  `ALTER TABLE transfer_requests ADD COLUMN rejection_reason TEXT NULL`,
  `ALTER TABLE transfer_requests ADD COLUMN request_date DATE NULL`,
  `ALTER TABLE maintenance_records ADD COLUMN notes TEXT NULL`,
  `CREATE TABLE IF NOT EXISTS transfer_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    transfer_request_id INT NOT NULL,
    inventory_item_id INT NOT NULL,
    from_department_id INT NULL,
    to_department_id INT NULL,
    from_location_id INT NULL,
    to_location_id INT NULL,
    reason TEXT,
    approved_by INT NULL,
    transfer_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (transfer_request_id) REFERENCES transfer_requests(id) ON DELETE CASCADE,
    FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
  )`,
  `CREATE INDEX idx_transfer_history_item ON transfer_history(inventory_item_id)`
];

function isIgnorable(err) {
  return ['ER_DUP_FIELDNAME', 'ER_DUP_KEYNAME', 'ER_TABLE_EXISTS_ERROR', 'ER_CANT_CREATE_TABLE'].includes(err.code)
    || err.message.includes('Duplicate');
}

async function runMaintenanceTransferMigration() {
  console.log('Running maintenance/transfer migration...');
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
  try {
    await pool.query('CREATE UNIQUE INDEX idx_maintenance_transaction_code ON maintenance_records(transaction_code)');
  } catch (err) {
    if (!isIgnorable(err)) throw err;
  }
  console.log('Maintenance/transfer migration completed.');
}

if (require.main === module) {
  runMaintenanceTransferMigration().then(() => process.exit(0)).catch(() => process.exit(1));
}

module.exports = { runMaintenanceTransferMigration };
