/**
 * Seed sample inventory items with unit_cost + acquisition_date
 * so the Admin "Monthly Department Cost" chart has demo data.
 *
 * Idempotent: skips items whose item_code already exists.
 * Run: node database/seed-monthly-cost-demo.js
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const SAMPLE_COST_ITEMS = [
  {
    item_code: 'MDC-ICT-001',
    item_name: 'Demo Desktop Computer',
    departmentCode: 'ICT',
    property_tag: 'MDC-2026-0001',
    brand: 'Dell',
    model: 'OptiPlex 7090',
    acquisition_date: '2026-02-12',
    unit_cost: 42000
  },
  {
    item_code: 'MDC-ICT-002',
    item_name: 'Demo Wireless Router',
    departmentCode: 'ICT',
    property_tag: 'MDC-2026-0002',
    brand: 'Cisco',
    model: 'RV340',
    acquisition_date: '2026-04-08',
    unit_cost: 18500
  },
  {
    item_code: 'MDC-ICT-003',
    item_name: 'Demo Monitor 24inch',
    departmentCode: 'ICT',
    property_tag: 'MDC-2026-0003',
    brand: 'LG',
    model: '24MK430H',
    acquisition_date: '2026-06-03',
    unit_cost: 9500
  },
  {
    item_code: 'MDC-ENG-001',
    item_name: 'Demo Digital Multimeter',
    departmentCode: 'ENG',
    property_tag: 'MDC-2026-0004',
    brand: 'Fluke',
    model: '115',
    acquisition_date: '2026-03-18',
    unit_cost: 12500
  },
  {
    item_code: 'MDC-ENG-002',
    item_name: 'Demo Oscilloscope',
    departmentCode: 'ENG',
    property_tag: 'MDC-2026-0005',
    brand: 'Rigol',
    model: 'DS1054Z',
    acquisition_date: '2026-05-14',
    unit_cost: 28500
  },
  {
    item_code: 'MDC-ENG-003',
    item_name: 'Demo Soldering Station',
    departmentCode: 'ENG',
    property_tag: 'MDC-2026-0006',
    brand: 'Weller',
    model: 'WE1010',
    acquisition_date: '2026-07-02',
    unit_cost: 9800
  },
  {
    item_code: 'MDC-LIB-001',
    item_name: 'Demo Reference Encyclopedia Set',
    departmentCode: 'DEPT-004',
    property_tag: 'MDC-2026-0007',
    brand: null,
    model: null,
    acquisition_date: '2026-04-22',
    unit_cost: 15000
  },
  {
    item_code: 'MDC-LIB-002',
    item_name: 'Demo Journal Subscription Pack',
    departmentCode: 'DEPT-004',
    property_tag: 'MDC-2026-0008',
    brand: null,
    model: null,
    acquisition_date: '2026-07-05',
    unit_cost: 8000
  },
  {
    item_code: 'MDC-SHS-001',
    item_name: 'Demo Classroom Projector',
    departmentCode: 'SHS',
    property_tag: 'MDC-2026-0009',
    brand: 'Epson',
    model: 'EB-X06',
    acquisition_date: '2026-05-28',
    unit_cost: 22000
  },
  {
    item_code: 'MDC-SHS-002',
    item_name: 'Demo Tablet for Learning',
    departmentCode: 'SHS',
    property_tag: 'MDC-2026-0010',
    brand: 'Lenovo',
    model: 'Tab M10',
    acquisition_date: '2026-06-20',
    unit_cost: 14500
  }
];

async function seedMonthlyCostDemo() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'cavite_inventory',
    port: Number(process.env.DB_PORT) || 3306
  });

  try {
    const [departments] = await connection.query(
      'SELECT id, name, code FROM departments WHERE is_archived = 0'
    );
    const deptByCode = new Map(departments.map((d) => [d.code, d]));

    let created = 0;
    let skipped = 0;

    for (const item of SAMPLE_COST_ITEMS) {
      const [existing] = await connection.query(
        'SELECT id FROM inventory_items WHERE item_code = ? OR property_tag = ? LIMIT 1',
        [item.item_code, item.property_tag]
      );
      if (existing.length) {
        skipped += 1;
        console.log(`  Skipped (exists): ${item.item_code}`);
        continue;
      }

      const dept = deptByCode.get(item.departmentCode);
      if (!dept) {
        console.warn(`  Skip ${item.item_code}: department ${item.departmentCode} not found`);
        skipped += 1;
        continue;
      }

      await connection.query(
        `INSERT INTO inventory_items
          (item_code, item_name, description, department_id, asset_classification,
           property_tag, brand, model, acquisition_date, unit_cost,
           \`condition\`, status, is_archived)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Good', 'Available', 0)`,
        [
          item.item_code,
          item.item_name,
          `Demo item for Monthly Department Cost chart — ${dept.name}`,
          dept.id,
          'Durable',
          item.property_tag,
          item.brand,
          item.model,
          item.acquisition_date,
          item.unit_cost
        ]
      );
      created += 1;
      console.log(
        `  Created: ${item.item_code} | ${dept.name} | ${item.acquisition_date} | ${item.unit_cost}`
      );
    }

    console.log(`\nDone. Created: ${created}, Skipped: ${skipped}`);
    console.log('Refresh Admin Dashboard to see Monthly Department Cost.');
  } finally {
    await connection.end();
  }
}

seedMonthlyCostDemo().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
