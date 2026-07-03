/**
 * Database setup script - creates schema and seeds data
 * Run: node database/setup.js
 */
const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

async function setup() {
  const config = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    multipleStatements: true
  };

  console.log('Connecting to MySQL...');
  let connection;

  try {
    connection = await mysql.createConnection(config);

    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf8');
    console.log('Running schema.sql...');
    await connection.query(schema);
    console.log('Schema created successfully.');

    await connection.end();

    // Run seed
    console.log('Seeding data...');
    require('./seed.js');
  } catch (err) {
    console.error('\nSetup failed:', err.message);
    if (err.code === 'ER_ACCESS_DENIED_ERROR') {
      console.error('\nPlease update backend/.env with your MySQL credentials:');
      console.error('  DB_USER=root');
      console.error('  DB_PASSWORD=your_password');
    }
    process.exit(1);
  }
}

setup();
