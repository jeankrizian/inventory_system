import mysql from 'mysql2/promise';
import dotenv from 'dotenv';
dotenv.config();

const db = await mysql.createConnection({
  host: process.env.DB_HOST || 'localhost',
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'inventory_system'
});

const [invCols] = await db.query(`SHOW COLUMNS FROM inventory_items`);
console.log('inventory_items fields with ref/tag/date/code:', invCols.map(c => c.Field).filter(f => /ref|tag|date|code|acquis/i.test(f)));

const [sample] = await db.query(
  `SELECT id, item_code, property_tag, batch_id, acquisition_date, purchase_date, item_name, asset_classification
   FROM inventory_items WHERE is_archived = 0 ORDER BY id DESC LIMIT 10`
);
console.log('sample', sample);

const [docs] = await db.query(
  `SELECT id, document_number, document_type, related_module, status, generated_at
   FROM documents ORDER BY id DESC LIMIT 5`
).catch(async () => {
  const [t] = await db.query(`SHOW TABLES LIKE '%document%'`);
  console.log('doc tables', t);
  return [[]];
});
console.log('docs', docs);

await db.end();
