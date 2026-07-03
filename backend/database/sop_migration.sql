-- SOP Integration Migration for Cavite Institute Property Management System
-- Run after schema.sql on existing databases

USE cavite_inventory;

-- Extend departments with SOP custodian fields
ALTER TABLE departments
  ADD COLUMN IF NOT EXISTS department_head VARCHAR(100) NULL AFTER description,
  ADD COLUMN IF NOT EXISTS custodian_id INT NULL AFTER department_head,
  ADD COLUMN IF NOT EXISTS custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL AFTER custodian_id;

-- Add FK for department custodian (ignore if exists)
SET @fk_exists = (SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE CONSTRAINT_SCHEMA = 'cavite_inventory' AND TABLE_NAME = 'departments' AND CONSTRAINT_NAME = 'fk_departments_custodian');
SET @sql = IF(@fk_exists = 0,
  'ALTER TABLE departments ADD CONSTRAINT fk_departments_custodian FOREIGN KEY (custodian_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Extend inventory_items with SOP asset lifecycle fields
ALTER TABLE inventory_items
  MODIFY COLUMN status ENUM('Available', 'Borrowed', 'Low Stock', 'Out of Stock', 'Under Maintenance', 'Disposed') DEFAULT 'Available';

ALTER TABLE inventory_items
  ADD COLUMN IF NOT EXISTS asset_classification ENUM('Fixed Asset', 'Semi-Durable', 'Consumable') DEFAULT 'Consumable' AFTER department_id,
  ADD COLUMN IF NOT EXISTS property_tag VARCHAR(50) NULL AFTER asset_classification,
  ADD COLUMN IF NOT EXISTS custodian_id INT NULL AFTER property_tag,
  ADD COLUMN IF NOT EXISTS custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL AFTER custodian_id,
  ADD COLUMN IF NOT EXISTS parent_asset_id INT NULL AFTER custodian_type,
  ADD COLUMN IF NOT EXISTS acquisition_date DATE NULL AFTER purchase_date,
  ADD COLUMN IF NOT EXISTS maintenance_schedule ENUM('Monthly', 'Quarterly', 'Semi-Annual', 'Annual') NULL AFTER low_stock_threshold,
  ADD COLUMN IF NOT EXISTS next_maintenance_date DATE NULL AFTER maintenance_schedule,
  ADD COLUMN IF NOT EXISTS maintenance_status ENUM('Scheduled', 'In Progress', 'Completed', 'Overdue') NULL AFTER next_maintenance_date,
  ADD COLUMN IF NOT EXISTS service_provider VARCHAR(150) NULL AFTER maintenance_status;

-- Property tag unique index
SET @idx_exists = (SELECT COUNT(*) FROM information_schema.STATISTICS
  WHERE TABLE_SCHEMA = 'cavite_inventory' AND TABLE_NAME = 'inventory_items' AND INDEX_NAME = 'idx_inventory_property_tag');
SET @sql = IF(@idx_exists = 0,
  'CREATE UNIQUE INDEX idx_inventory_property_tag ON inventory_items(property_tag)',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Transfer Requests (Asset Movement)
CREATE TABLE IF NOT EXISTS transfer_requests (
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
);

-- Disposal Requests
CREATE TABLE IF NOT EXISTS disposal_requests (
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
);

-- Maintenance Records (Preventive Maintenance)
CREATE TABLE IF NOT EXISTS maintenance_records (
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
);

-- Component Replacements
CREATE TABLE IF NOT EXISTS component_replacements (
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
);

CREATE INDEX IF NOT EXISTS idx_transfer_status ON transfer_requests(status);
CREATE INDEX IF NOT EXISTS idx_disposal_status ON disposal_requests(status);
CREATE INDEX IF NOT EXISTS idx_maintenance_item ON maintenance_records(inventory_item_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_scheduled ON maintenance_records(scheduled_date);
CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance_records(status);
CREATE INDEX IF NOT EXISTS idx_component_parent ON component_replacements(parent_asset_id);
