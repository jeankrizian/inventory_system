const mysql = require('mysql2/promise');
require('dotenv').config();

async function migrate() {
  const c = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    port: process.env.DB_PORT,
    database: process.env.DB_NAME,
    multipleStatements: true
  });

  const steps = [
    `CREATE TABLE IF NOT EXISTS departments (
      id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(150) NOT NULL UNIQUE,
      code VARCHAR(20) NOT NULL UNIQUE, description TEXT,
      status ENUM('Active','Inactive') DEFAULT 'Active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP)`,
    `INSERT IGNORE INTO departments (id,name,code,description,status,created_at,updated_at)
     SELECT id,name,CONCAT('DEPT-',LPAD(id,3,'0')),description,'Active',created_at,updated_at FROM categories`,
    `ALTER TABLE inventory_items ADD COLUMN department_id INT NULL AFTER item_name`,
    `UPDATE inventory_items SET department_id = category_id WHERE department_id IS NULL`,
    `ALTER TABLE inventory_items DROP FOREIGN KEY inventory_items_ibfk_1`,
    `ALTER TABLE inventory_items DROP COLUMN category_id`,
    `ALTER TABLE inventory_items MODIFY department_id INT NOT NULL`,
    `ALTER TABLE inventory_items ADD CONSTRAINT fk_inventory_department FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE RESTRICT`,
    `DROP TABLE IF EXISTS categories`
  ];

  for (const s of steps) {
    try {
      await c.query(s);
      console.log('OK:', s.slice(0, 70));
    } catch (e) {
      const skip = ['ER_DUP_FIELDNAME', 'ER_CANT_DROP_FIELD_OR_KEY', 'ER_DUP_KEYNAME', 'ER_FK_DUP_NAME', 'ER_BAD_FIELD_ERROR', 'ER_CANT_DROP_FIELD_OR_KEY'];
      if (skip.includes(e.code) || e.message.includes('check that column')) {
        console.log('SKIP:', e.message);
      } else {
        throw e;
      }
    }
  }
  await c.end();
  console.log('Category migration complete');
}

migrate().catch(e => { console.error(e.message); process.exit(1); });
