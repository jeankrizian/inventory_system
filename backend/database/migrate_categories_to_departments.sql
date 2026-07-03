-- Migration: Replace categories with departments
-- Run this script if upgrading from a database that uses the categories table.
USE cavite_inventory;

-- Create departments table if migrating from categories
CREATE TABLE IF NOT EXISTS departments (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(150) NOT NULL UNIQUE,
  code VARCHAR(20) NOT NULL UNIQUE,
  description TEXT,
  status ENUM('Active', 'Inactive') DEFAULT 'Active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Migrate existing category rows when categories table exists
INSERT IGNORE INTO departments (id, name, code, description, status, created_at, updated_at)
SELECT id, name, CONCAT('DEPT-', LPAD(id, 3, '0')), description, 'Active', created_at, updated_at
FROM categories
WHERE EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'categories');

-- Add department_id column if inventory still uses category_id
SET @has_category_id = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inventory_items' AND column_name = 'category_id'
);

SET @sql = IF(@has_category_id > 0,
  'ALTER TABLE inventory_items ADD COLUMN department_id INT NULL AFTER item_name',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @sql = IF(@has_category_id > 0,
  'UPDATE inventory_items SET department_id = category_id WHERE department_id IS NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Drop old foreign key and category_id column when present
SET @fk_name = (
  SELECT constraint_name FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE() AND table_name = 'inventory_items' AND column_name = 'category_id'
    AND referenced_table_name = 'categories' LIMIT 1
);

SET @sql = IF(@fk_name IS NOT NULL, CONCAT('ALTER TABLE inventory_items DROP FOREIGN KEY ', @fk_name), 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_category_id = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inventory_items' AND column_name = 'category_id'
);

SET @sql = IF(@has_category_id > 0, 'ALTER TABLE inventory_items DROP COLUMN category_id', 'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @has_dept_id = (
  SELECT COUNT(*) FROM information_schema.columns
  WHERE table_schema = DATABASE() AND table_name = 'inventory_items' AND column_name = 'department_id'
);

SET @sql = IF(@has_dept_id > 0,
  'ALTER TABLE inventory_items MODIFY department_id INT NOT NULL',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

SET @fk_exists = (
  SELECT COUNT(*) FROM information_schema.key_column_usage
  WHERE table_schema = DATABASE() AND table_name = 'inventory_items' AND column_name = 'department_id'
    AND referenced_table_name = 'departments'
);

SET @sql = IF(@fk_exists = 0 AND @has_dept_id > 0,
  'ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT',
  'SELECT 1');
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

DROP TABLE IF EXISTS categories;

CREATE INDEX IF NOT EXISTS idx_inventory_department ON inventory_items(department_id);
