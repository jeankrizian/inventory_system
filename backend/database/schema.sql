-- Cavite Institute Property Management System
-- Run this script in MySQL Workbench

CREATE DATABASE IF NOT EXISTS cavite_inventory;
USE cavite_inventory;

-- Roles
CREATE TABLE IF NOT EXISTS roles (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description VARCHAR(255),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Users
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  role_id INT NOT NULL,
  username VARCHAR(50) NOT NULL UNIQUE,
  email VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  full_name VARCHAR(100) NOT NULL,
  profile_image VARCHAR(255) DEFAULT NULL,
  is_active TINYINT(1) DEFAULT 1,
  last_login TIMESTAMP NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE RESTRICT
);

-- Departments
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  department_head VARCHAR(100) NULL,
  custodian_id INT NULL,
  custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (custodian_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Suppliers
CREATE TABLE IF NOT EXISTS suppliers (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL,
  contact_person VARCHAR(100),
  phone VARCHAR(30),
  email VARCHAR(100),
  address TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Locations
CREATE TABLE IF NOT EXISTS locations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL UNIQUE,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Inventory Items
CREATE TABLE IF NOT EXISTS inventory_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  item_code VARCHAR(50) NOT NULL UNIQUE,
  item_name VARCHAR(200) NOT NULL,
  department_id INT NOT NULL,
  asset_classification ENUM('Consumable', 'Semi-Durable', 'Non-Consumable (Fixed Asset)') DEFAULT 'Consumable',
  property_tag VARCHAR(50) NULL UNIQUE,
  custodian_id INT NULL,
  custodian_type ENUM('Property Custodian', 'Department Custodian', 'Laboratory Custodian') NULL,
  parent_asset_id INT NULL,
  brand VARCHAR(100),
  model VARCHAR(100),
  quantity INT NOT NULL DEFAULT 0,
  available_quantity INT NOT NULL DEFAULT 0,
  unit VARCHAR(50) DEFAULT 'pcs',
  supplier_id INT,
  purchase_date DATE,
  acquisition_date DATE,
  purchase_request_number VARCHAR(50) NULL,
  purchase_order_number VARCHAR(50) NULL,
  invoice_number VARCHAR(50) NULL,
  unit_cost DECIMAL(12,2) NULL,
  acquisition_cost DECIMAL(12,2) NULL,
  `condition` ENUM('New', 'Good', 'Fair', 'Poor', 'Damaged') DEFAULT 'Good',
  status ENUM('Available', 'Borrowed', 'Low Stock', 'Out of Stock', 'Under Maintenance', 'Disposed') DEFAULT 'Available',
  location_id INT,
  low_stock_threshold INT DEFAULT 5,
  maintenance_schedule ENUM('Monthly', 'Quarterly', 'Semi-Annual', 'Annual') NULL,
  next_maintenance_date DATE NULL,
  maintenance_status ENUM('Scheduled', 'In Progress', 'Completed', 'Overdue') NULL,
  service_provider VARCHAR(150) NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT,
  FOREIGN KEY (supplier_id) REFERENCES suppliers(id) ON DELETE SET NULL,
  FOREIGN KEY (location_id) REFERENCES locations(id) ON DELETE SET NULL,
  FOREIGN KEY (custodian_id) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (parent_asset_id) REFERENCES inventory_items(id) ON DELETE SET NULL
);

-- Borrow Transactions
CREATE TABLE IF NOT EXISTS borrow_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(50) NOT NULL UNIQUE,
  borrower_id INT NOT NULL,
  borrower_name VARCHAR(100) NOT NULL,
  borrower_department VARCHAR(100),
  purpose TEXT,
  borrow_date DATE NOT NULL,
  expected_return_date DATE,
  status ENUM('Pending', 'Approved', 'Rejected', 'Borrowed', 'Returned', 'Overdue') DEFAULT 'Pending',
  approved_by INT,
  approved_at TIMESTAMP NULL,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (borrower_id) REFERENCES users(id) ON DELETE RESTRICT,
  FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL
);

-- Borrow Items (line items per borrow transaction)
CREATE TABLE IF NOT EXISTS borrow_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  borrow_transaction_id INT NOT NULL,
  inventory_item_id INT NOT NULL,
  quantity INT NOT NULL DEFAULT 1,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrow_transaction_id) REFERENCES borrow_transactions(id) ON DELETE CASCADE,
  FOREIGN KEY (inventory_item_id) REFERENCES inventory_items(id) ON DELETE RESTRICT
);

-- Return Transactions
CREATE TABLE IF NOT EXISTS return_transactions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  transaction_code VARCHAR(50) NOT NULL UNIQUE,
  borrow_transaction_id INT NOT NULL,
  returned_by INT NOT NULL,
  return_date DATE NOT NULL,
  `condition` ENUM('Good', 'Fair', 'Damaged', 'Lost') DEFAULT 'Good',
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (borrow_transaction_id) REFERENCES borrow_transactions(id) ON DELETE RESTRICT,
  FOREIGN KEY (returned_by) REFERENCES users(id) ON DELETE RESTRICT
);

-- Activity Logs
CREATE TABLE IF NOT EXISTS activity_logs (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT,
  action VARCHAR(100) NOT NULL,
  module VARCHAR(50) NOT NULL,
  description TEXT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
);

-- Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  title VARCHAR(200) NOT NULL,
  message TEXT NOT NULL,
  type VARCHAR(50) NOT NULL,
  reference_id INT NULL,
  link_url VARCHAR(255) NULL,
  is_read TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Indexes for performance
CREATE INDEX idx_inventory_department ON inventory_items(department_id);
CREATE INDEX idx_inventory_supplier ON inventory_items(supplier_id);
CREATE INDEX idx_inventory_location ON inventory_items(location_id);
CREATE INDEX idx_inventory_status ON inventory_items(status);
CREATE INDEX idx_borrow_status ON borrow_transactions(status);
CREATE INDEX idx_borrow_date ON borrow_transactions(borrow_date);
CREATE INDEX idx_return_date ON return_transactions(return_date);
CREATE INDEX idx_activity_created ON activity_logs(created_at);
CREATE INDEX idx_notifications_user ON notifications(user_id);
CREATE INDEX idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX idx_notifications_created ON notifications(created_at);
CREATE INDEX idx_notifications_type_ref ON notifications(type, reference_id);

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

-- Maintenance Records
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
  FOREIGN KEY (replaced_by) REFERENCES users(id) ON DELETE SET NULL
);

CREATE INDEX idx_transfer_status ON transfer_requests(status);
CREATE INDEX idx_disposal_status ON disposal_requests(status);
CREATE INDEX idx_maintenance_item ON maintenance_records(inventory_item_id);
CREATE INDEX idx_maintenance_scheduled ON maintenance_records(scheduled_date);
CREATE INDEX idx_component_parent ON component_replacements(parent_asset_id);
