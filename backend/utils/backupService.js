const fs = require('fs');
const path = require('path');
const pool = require('../config/database');

const BACKUP_HEADER = '-- Cavite Institute PMS Database Backup';
const BACKUP_DIR = path.join(__dirname, '..', 'storage', 'backups');
const MAX_BACKUP_BYTES = 100 * 1024 * 1024;

function ensureBackupDir() {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
  }
}

function escapeSqlValue(value) {
  if (value === null || value === undefined) return 'NULL';
  if (value instanceof Date) {
    return `'${value.toISOString().slice(0, 19).replace('T', ' ')}'`;
  }
  if (Buffer.isBuffer(value)) {
    return `X'${value.toString('hex')}'`;
  }
  if (typeof value === 'number') return String(value);
  if (typeof value === 'boolean') return value ? '1' : '0';
  return `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "''")}'`;
}

function splitSqlStatements(sql) {
  const statements = [];
  let current = '';
  let inString = false;
  let stringChar = '';
  let escaped = false;

  for (let i = 0; i < sql.length; i++) {
    const ch = sql[i];
    if (escaped) {
      current += ch;
      escaped = false;
      continue;
    }
    if (ch === '\\' && inString) {
      current += ch;
      escaped = true;
      continue;
    }
    if ((ch === "'" || ch === '"') && !inString) {
      inString = true;
      stringChar = ch;
      current += ch;
      continue;
    }
    if (ch === stringChar && inString) {
      inString = false;
      stringChar = '';
      current += ch;
      continue;
    }
    if (ch === ';' && !inString) {
      if (current.trim()) statements.push(current.trim());
      current = '';
      continue;
    }
    current += ch;
  }

  if (current.trim()) statements.push(current.trim());
  return statements;
}

function validateBackupSql(sql) {
  if (!sql || typeof sql !== 'string') {
    return 'Invalid backup file.';
  }
  if (Buffer.byteLength(sql, 'utf8') > MAX_BACKUP_BYTES) {
    return 'Backup file is too large.';
  }
  const normalized = sql.trim();
  if (!normalized.includes('CREATE TABLE')) {
    return 'Invalid backup file format.';
  }
  if (/\bDROP\s+DATABASE\b/i.test(normalized)) {
    return 'Invalid backup file.';
  }
  if (!normalized.includes(BACKUP_HEADER) && !normalized.includes('CREATE TABLE')) {
    return 'Invalid backup file format.';
  }
  return null;
}

async function generateDatabaseSql() {
  const connection = await pool.getConnection();
  const dbName = process.env.DB_NAME || 'cavite_inventory';
  const tableKey = `Tables_in_${dbName}`;

  try {
    const [tables] = await connection.query('SHOW TABLES');
    let sql = `${BACKUP_HEADER}\n`;
    sql += `-- Generated: ${new Date().toISOString()}\n\n`;
    sql += 'SET FOREIGN_KEY_CHECKS=0;\n';
    sql += "SET SQL_MODE='NO_AUTO_VALUE_ON_ZERO';\n\n";

    for (const row of tables) {
      const table = row[tableKey];
      const [createRows] = await connection.query(`SHOW CREATE TABLE \`${table}\``);
      sql += `DROP TABLE IF EXISTS \`${table}\`;\n`;
      sql += `${createRows[0]['Create Table']};\n\n`;

      const [dataRows] = await connection.query(`SELECT * FROM \`${table}\``);
      if (dataRows.length) {
        const columns = Object.keys(dataRows[0]);
        const columnList = columns.map((col) => `\`${col}\``).join(', ');
        for (const dataRow of dataRows) {
          const values = columns.map((col) => escapeSqlValue(dataRow[col]));
          sql += `INSERT INTO \`${table}\` (${columnList}) VALUES (${values.join(', ')});\n`;
        }
        sql += '\n';
      }
    }

    sql += 'SET FOREIGN_KEY_CHECKS=1;\n';
    return sql;
  } finally {
    connection.release();
  }
}

async function restoreDatabaseSql(sql) {
  const validationError = validateBackupSql(sql);
  if (validationError) {
    const err = new Error(validationError);
    err.statusCode = 400;
    throw err;
  }

  const connection = await pool.getConnection();
  try {
    await connection.query('SET FOREIGN_KEY_CHECKS=0');
    const statements = splitSqlStatements(sql);
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (!trimmed || trimmed.startsWith('--')) continue;
      await connection.query(trimmed);
    }
    await connection.query('SET FOREIGN_KEY_CHECKS=1');
  } finally {
    connection.release();
  }
}

function buildBackupFileName() {
  const now = new Date();
  const stamp = [
    now.getFullYear(),
    String(now.getMonth() + 1).padStart(2, '0'),
    String(now.getDate()).padStart(2, '0'),
    String(now.getHours()).padStart(2, '0'),
    String(now.getMinutes()).padStart(2, '0'),
    String(now.getSeconds()).padStart(2, '0')
  ].join('');
  return `backup-${stamp}.sql`;
}

function resolveBackupPath(fileName) {
  const safeName = path.basename(fileName);
  if (!safeName.endsWith('.sql') || safeName !== fileName) {
    const err = new Error('Invalid backup file name.');
    err.statusCode = 400;
    throw err;
  }
  const fullPath = path.join(BACKUP_DIR, safeName);
  if (!fullPath.startsWith(BACKUP_DIR)) {
    const err = new Error('Invalid backup file path.');
    err.statusCode = 400;
    throw err;
  }
  return fullPath;
}

function writeBackupFile(fileName, content) {
  ensureBackupDir();
  const fullPath = resolveBackupPath(fileName);
  fs.writeFileSync(fullPath, content, 'utf8');
  return fullPath;
}

function readBackupFile(fileName) {
  const fullPath = resolveBackupPath(fileName);
  if (!fs.existsSync(fullPath)) {
    const err = new Error('Backup file not found.');
    err.statusCode = 404;
    throw err;
  }
  return fs.readFileSync(fullPath, 'utf8');
}

function deleteBackupFile(fileName) {
  const fullPath = resolveBackupPath(fileName);
  if (fs.existsSync(fullPath)) {
    fs.unlinkSync(fullPath);
  }
}

module.exports = {
  BACKUP_DIR,
  MAX_BACKUP_BYTES,
  ensureBackupDir,
  validateBackupSql,
  generateDatabaseSql,
  restoreDatabaseSql,
  buildBackupFileName,
  resolveBackupPath,
  writeBackupFile,
  readBackupFile,
  deleteBackupFile
};
