/**
 * Seed varied sample data for QA / defense testing.
 * Idempotent — skips records that already exist by item_code or transaction_code.
 * Run: npm run seed:sample-data
 * Prerequisites: npm run seed && npm run seed:test-accounts
 */
require('dotenv').config();
const pool = require('../config/database');

const MIN_SAMPLE = 5;

const SAMPLE_INVENTORY = [
  {
    item_code: 'SMP-INV-001',
    item_name: 'Bond Paper A4 (80gsm)',
    department_id: 6,
    asset_classification: 'Consumable',
    brand: 'Hard Copy',
    model: '80gsm White',
    quantity: 50,
    available_quantity: 35,
    unit: 'reams',
    supplier_id: 2,
    purchase_date: '2025-01-10',
    condition: 'New',
    status: 'Available',
    location_id: 5,
    low_stock_threshold: 10
  },
  {
    item_code: 'SMP-INV-002',
    item_name: 'USB Flash Drive 32GB',
    department_id: 1,
    asset_classification: 'Semi-Durable',
    brand: 'SanDisk',
    model: 'Cruzer Blade',
    quantity: 40,
    available_quantity: 28,
    unit: 'pcs',
    supplier_id: 1,
    purchase_date: '2025-02-15',
    condition: 'Good',
    status: 'Available',
    location_id: 1,
    low_stock_threshold: 8
  },
  {
    item_code: 'SMP-INV-003',
    item_name: 'Lenovo ThinkPad Laptop',
    department_id: 1,
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-IT-2025-001',
    brand: 'Lenovo',
    model: 'ThinkPad E14 Gen 5',
    quantity: 12,
    available_quantity: 8,
    unit: 'units',
    supplier_id: 1,
    purchase_date: '2025-03-01',
    acquisition_date: '2025-03-05',
    unit_cost: 48500.0,
    condition: 'Good',
    status: 'Available',
    location_id: 1,
    low_stock_threshold: 2
  },
  {
    item_code: 'SMP-INV-004',
    item_name: 'Epson LCD Projector',
    department_id: 11,
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ICT-2025-002',
    brand: 'Epson',
    model: 'EB-L210SW',
    quantity: 6,
    available_quantity: 3,
    unit: 'units',
    supplier_id: 1,
    purchase_date: '2025-03-20',
    unit_cost: 32000.0,
    condition: 'Good',
    status: 'Borrowed',
    location_id: 1,
    low_stock_threshold: 1
  },
  {
    item_code: 'SMP-INV-005',
    item_name: 'Disposable Lab Gloves (Box)',
    department_id: 10,
    asset_classification: 'Consumable',
    brand: 'MedSafe',
    model: 'LG-100',
    quantity: 80,
    available_quantity: 6,
    unit: 'boxes',
    supplier_id: 3,
    purchase_date: '2025-04-01',
    condition: 'New',
    status: 'Low Stock',
    location_id: 3,
    low_stock_threshold: 10
  },
  {
    item_code: 'SMP-INV-006',
    item_name: 'HDMI Cable 2m',
    department_id: 11,
    asset_classification: 'Semi-Durable',
    brand: 'Belkin',
    model: 'HDMI-2M',
    quantity: 25,
    available_quantity: 0,
    unit: 'pcs',
    supplier_id: 1,
    purchase_date: '2025-04-15',
    condition: 'Good',
    status: 'Out of Stock',
    location_id: 1,
    low_stock_threshold: 5
  },
  {
    item_code: 'SMP-INV-007',
    item_name: 'Digital Microscope',
    department_id: 10,
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-SCI-2025-003',
    brand: 'Celestron',
    model: 'LCD Digital II',
    quantity: 4,
    available_quantity: 3,
    unit: 'units',
    supplier_id: 3,
    purchase_date: '2025-05-01',
    unit_cost: 18500.0,
    condition: 'Good',
    status: 'Under Maintenance',
    location_id: 3,
    low_stock_threshold: 1,
    maintenance_status: 'In Progress'
  }
];

const SAMPLE_BORROWS = [
  {
    transaction_code: 'BRW-SMP-001',
    borrower: 'staff',
    borrower_department: 'Accounting Office',
    purpose: 'Quarterly inventory audit paperwork',
    borrow_date: '2025-06-01',
    expected_return_date: '2025-06-15',
    status: 'Pending',
    approved_by: null,
    items: [{ item_code: 'SMP-INV-001', quantity: 2 }]
  },
  {
    transaction_code: 'BRW-SMP-002',
    borrower: 'deptcust_test',
    borrower_department: 'Information Technology Department',
    purpose: 'Faculty training on new software',
    borrow_date: '2025-06-05',
    expected_return_date: '2025-06-20',
    status: 'Approved',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-INV-003', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-003',
    borrower: 'labcust_test',
    borrower_department: 'Science Laboratory',
    purpose: 'Grade 11 chemistry demonstration',
    borrow_date: '2025-06-10',
    expected_return_date: '2025-06-25',
    status: 'Borrowed',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-INV-004', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-004',
    borrower: 'pm_test',
    borrower_department: 'Property Management Office',
    purpose: 'SHS orientation AV setup',
    borrow_date: '2025-05-15',
    expected_return_date: '2025-05-30',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'ICT-002', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-005',
    borrower: 'staff',
    borrower_department: 'Library',
    purpose: 'Research week book display',
    borrow_date: '2025-05-01',
    expected_return_date: '2025-05-14',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'BK-001', quantity: 3 }]
  },
  {
    transaction_code: 'BRW-SMP-006',
    borrower: 'deptcust_test',
    borrower_department: 'Computer Science Department',
    purpose: 'Hackathon event equipment',
    borrow_date: '2025-06-20',
    expected_return_date: '2025-07-05',
    status: 'Rejected',
    approved_by: 'admin',
    notes: 'Insufficient stock for requested quantity',
    items: [{ item_code: 'SMP-INV-002', quantity: 15 }]
  },
  {
    transaction_code: 'BRW-SMP-007',
    borrower: 'staff',
    borrower_department: 'Junior High School',
    purpose: 'Classroom multimedia lesson',
    borrow_date: '2025-04-01',
    expected_return_date: '2025-04-15',
    status: 'Overdue',
    approved_by: 'admin',
    items: [{ item_code: 'ICT-002', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-008',
    borrower: 'labcust_test',
    borrower_department: 'Science Laboratory',
    purpose: 'Biology lab practical exam',
    borrow_date: '2025-05-20',
    expected_return_date: '2025-06-05',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'LAB-001', quantity: 2 }]
  },
  {
    transaction_code: 'BRW-SMP-009',
    borrower: 'pm_test',
    borrower_department: 'Senior High School',
    purpose: 'Sports fest equipment checkout',
    borrow_date: '2025-04-10',
    expected_return_date: '2025-04-25',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'SPT-001', quantity: 2 }]
  },
  {
    transaction_code: 'BRW-SMP-010',
    borrower: 'deptcust_test',
    borrower_department: 'Registrar',
    purpose: 'Enrollment period document printing',
    borrow_date: '2025-03-01',
    expected_return_date: '2025-03-15',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'OFF-001', quantity: 5 }]
  }
];

const SAMPLE_RETURNS = [
  {
    transaction_code: 'RTN-SMP-001',
    borrow_code: 'BRW-SMP-004',
    returned_by: 'pm_test',
    return_date: '2025-05-28',
    condition: 'Good',
    notes: 'Projector returned in working condition'
  },
  {
    transaction_code: 'RTN-SMP-002',
    borrow_code: 'BRW-SMP-005',
    returned_by: 'staff',
    return_date: '2025-05-12',
    condition: 'Good',
    notes: 'All textbooks accounted for'
  },
  {
    transaction_code: 'RTN-SMP-003',
    borrow_code: 'BRW-SMP-008',
    returned_by: 'labcust_test',
    return_date: '2025-06-03',
    condition: 'Fair',
    notes: 'One microscope eyepiece needs cleaning'
  },
  {
    transaction_code: 'RTN-SMP-004',
    borrow_code: 'BRW-SMP-009',
    returned_by: 'pm_test',
    return_date: '2025-04-22',
    condition: 'Good',
    notes: 'Basketballs returned after sports fest'
  },
  {
    transaction_code: 'RTN-SMP-005',
    borrow_code: 'BRW-SMP-010',
    returned_by: 'deptcust_test',
    return_date: '2025-03-14',
    condition: 'Good',
    notes: 'Unused reams returned to stock'
  }
];

const SAMPLE_TRANSFERS = [
  {
    transaction_code: 'TRF-SMP-001',
    item_code: 'SMP-INV-003',
    quantity: 1,
    from_location_id: 1,
    to_location_id: 4,
    from_department_id: 1,
    to_department_id: 2,
    reason: 'Transfer laptop to CS faculty room for programming class',
    status: 'Pending',
    requested_by: 'deptcust_test'
  },
  {
    transaction_code: 'TRF-SMP-002',
    item_code: 'ICT-001',
    quantity: 2,
    from_location_id: 1,
    to_location_id: 5,
    from_department_id: 1,
    to_department_id: 5,
    reason: 'Desktop units needed at Registrar enrollment booth',
    status: 'Approved',
    requested_by: 'pm_test',
    approved_by: 'admin'
  },
  {
    transaction_code: 'TRF-SMP-003',
    item_code: 'SMP-INV-004',
    quantity: 1,
    from_location_id: 1,
    to_location_id: 2,
    from_department_id: 11,
    to_department_id: 9,
    reason: 'Projector for library research presentation',
    status: 'Rejected',
    requested_by: 'staff',
    approved_by: 'admin',
    notes: 'Item currently borrowed — transfer deferred'
  },
  {
    transaction_code: 'TRF-SMP-004',
    item_code: 'FUR-001',
    quantity: 10,
    from_location_id: 6,
    to_location_id: 2,
    from_department_id: 4,
    to_department_id: 9,
    reason: 'Additional chairs for library reading area',
    status: 'Completed',
    requested_by: 'pm_test',
    approved_by: 'admin'
  },
  {
    transaction_code: 'TRF-SMP-005',
    item_code: 'SMP-INV-002',
    quantity: 5,
    from_location_id: 1,
    to_location_id: 3,
    from_department_id: 1,
    to_department_id: 10,
    reason: 'USB drives for science lab data collection',
    status: 'Pending',
    requested_by: 'labcust_test'
  }
];

const SAMPLE_MAINTENANCE = [
  {
    transaction_code: 'MNT-SMP-001',
    item_code: 'SMP-INV-007',
    requested_by: 'labcust_test',
    requested_date: '2025-06-01',
    reported_problem: 'Microscope LCD screen flickering intermittently',
    maintenance_type: 'Corrective',
    priority: 'High',
    scheduled_date: '2025-06-15',
    service_provider: 'Celestron Service Center',
    status: 'Pending',
    description: 'Digital microscope display issue during lab sessions'
  },
  {
    transaction_code: 'MNT-SMP-002',
    item_code: 'ICT-001',
    requested_by: 'deptcust_test',
    requested_date: '2025-05-20',
    reported_problem: 'Annual preventive maintenance for desktop fleet',
    maintenance_type: 'Preventive',
    priority: 'Medium',
    scheduled_date: '2025-06-10',
    service_provider: 'TechPro Solutions',
    status: 'Approved',
    approved_by: 'admin',
    description: 'Scheduled dust cleaning and thermal paste replacement'
  },
  {
    transaction_code: 'MNT-SMP-003',
    item_code: 'ICT-002',
    requested_by: 'pm_test',
    requested_date: '2025-05-01',
    reported_problem: 'Projector lamp hours approaching end of life',
    maintenance_type: 'Preventive',
    priority: 'Low',
    scheduled_date: '2025-07-01',
    service_provider: 'Epson Authorized Service',
    status: 'Scheduled',
    approved_by: 'admin',
    description: 'Replace projector lamp before next school year'
  },
  {
    transaction_code: 'MNT-SMP-004',
    item_code: 'LAB-001',
    requested_by: 'labcust_test',
    requested_date: '2025-04-01',
    reported_problem: 'Microscope focus knob stiff — lubrication needed',
    maintenance_type: 'Corrective',
    priority: 'Medium',
    scheduled_date: '2025-04-10',
    completed_date: '2025-04-12',
    service_provider: 'LabEquip Supply Co.',
    status: 'Completed',
    approved_by: 'admin',
    performed_by: 'admin',
    cost: 1500.0,
    description: 'Focus mechanism serviced and calibrated'
  },
  {
    transaction_code: 'MNT-SMP-005',
    item_code: 'SMP-INV-006',
    requested_by: 'staff',
    requested_date: '2025-06-18',
    reported_problem: 'Bulk HDMI cables showing bent connectors',
    maintenance_type: 'Emergency',
    priority: 'High',
    scheduled_date: '2025-06-20',
    service_provider: null,
    status: 'Cancelled',
    approved_by: 'admin',
    rejection_reason: 'Items marked for disposal instead of repair',
    description: 'Damaged HDMI cables — disposal request filed separately'
  }
];

const SAMPLE_DISPOSALS = [
  {
    transaction_code: 'DSP-SMP-001',
    item_code: 'LAB-002',
    quantity: 3,
    reason: 'Bunsen burners with cracked bases — safety hazard',
    status: 'Pending',
    requested_by: 'labcust_test',
    notes: 'Replacement units already ordered'
  },
  {
    transaction_code: 'DSP-SMP-002',
    item_code: 'OFF-002',
    quantity: 20,
    reason: 'Dried-out whiteboard markers beyond usable life',
    status: 'Inspected',
    requested_by: 'staff',
    inspected_by: 'pm_test',
    inspection_notes: 'Confirmed unusable — no ink remaining in 18 of 20 markers'
  },
  {
    transaction_code: 'DSP-SMP-003',
    item_code: 'SMP-INV-006',
    quantity: 10,
    reason: 'HDMI cables with bent pins and exposed wiring',
    status: 'Approved',
    requested_by: 'deptcust_test',
    inspected_by: 'pm_test',
    approved_by: 'admin',
    disposal_method: 'Recycling',
    notes: 'E-waste recycling per CI policy'
  },
  {
    transaction_code: 'DSP-SMP-004',
    item_code: 'ICT-003',
    quantity: 1,
    reason: 'Network switch with intermittent port failures',
    status: 'Rejected',
    requested_by: 'staff',
    approved_by: 'admin',
    notes: 'Sent for repair instead — still under warranty'
  },
  {
    transaction_code: 'DSP-SMP-005',
    item_code: 'FUR-002',
    quantity: 2,
    reason: 'Teacher desks with termite damage in storage',
    status: 'Completed',
    requested_by: 'pm_test',
    inspected_by: 'admin',
    approved_by: 'admin',
    disposal_method: 'Destruction',
    disposal_date: '2025-05-30',
    notes: 'Wood destroyed per disposal committee approval'
  }
];

async function existsByCode(connection, table, column, code) {
  const [rows] = await connection.query(
    `SELECT id FROM ${table} WHERE ${column} = ? LIMIT 1`,
    [code]
  );
  return rows.length > 0;
}

async function countSample(connection, table, column, prefix) {
  const [rows] = await connection.query(
    `SELECT COUNT(*) AS c FROM ${table} WHERE ${column} LIKE ?`,
    [`${prefix}%`]
  );
  return rows[0].c;
}

async function getUser(connection, username) {
  const [rows] = await connection.query(
    'SELECT id, full_name FROM users WHERE username = ?',
    [username]
  );
  if (!rows.length) {
    throw new Error(`User not found: ${username}. Run npm run seed:test-accounts first.`);
  }
  return rows[0];
}

async function getItemId(connection, itemCode) {
  const [rows] = await connection.query(
    'SELECT id FROM inventory_items WHERE item_code = ?',
    [itemCode]
  );
  if (!rows.length) {
    throw new Error(`Inventory item not found: ${itemCode}`);
  }
  return rows[0].id;
}

async function getBorrowId(connection, code) {
  const [rows] = await connection.query(
    'SELECT id FROM borrow_transactions WHERE transaction_code = ?',
    [code]
  );
  if (!rows.length) {
    throw new Error(`Borrow transaction not found: ${code}`);
  }
  return rows[0].id;
}

async function seedInventory(connection) {
  const prefix = 'SMP-INV-';
  const existing = await countSample(connection, 'inventory_items', 'item_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Inventory: ${existing} sample items exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const item of SAMPLE_INVENTORY) {
    if (await existsByCode(connection, 'inventory_items', 'item_code', item.item_code)) {
      skipped += 1;
      continue;
    }

    await connection.query(
      `INSERT INTO inventory_items
        (item_code, item_name, department_id, asset_classification, property_tag,
         brand, model, quantity, available_quantity, unit, supplier_id,
         purchase_date, acquisition_date, unit_cost, \`condition\`, status,
         location_id, low_stock_threshold, maintenance_status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.item_code,
        item.item_name,
        item.department_id,
        item.asset_classification,
        item.property_tag || null,
        item.brand,
        item.model,
        item.quantity,
        item.available_quantity,
        item.unit,
        item.supplier_id,
        item.purchase_date,
        item.acquisition_date || null,
        item.unit_cost || null,
        item.condition,
        item.status,
        item.location_id,
        item.low_stock_threshold,
        item.maintenance_status || null
      ]
    );
    created += 1;
    console.log(`  Created inventory: ${item.item_code} (${item.asset_classification}, ${item.status})`);
  }

  return { created, skipped };
}

async function seedBorrows(connection) {
  const prefix = 'BRW-SMP-';
  const existing = await countSample(connection, 'borrow_transactions', 'transaction_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Borrows: ${existing} sample transactions exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const borrow of SAMPLE_BORROWS) {
    if (await existsByCode(connection, 'borrow_transactions', 'transaction_code', borrow.transaction_code)) {
      skipped += 1;
      continue;
    }

    const borrower = await getUser(connection, borrow.borrower);
    let approvedById = null;
    let approvedAt = null;
    if (borrow.approved_by) {
      const approver = await getUser(connection, borrow.approved_by);
      approvedById = approver.id;
      approvedAt = `${borrow.borrow_date} 09:00:00`;
    }

    const [result] = await connection.query(
      `INSERT INTO borrow_transactions
        (transaction_code, borrower_id, borrower_name, borrower_department, purpose,
         borrow_date, expected_return_date, status, approved_by, approved_at, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        borrow.transaction_code,
        borrower.id,
        borrower.full_name,
        borrow.borrower_department,
        borrow.purpose,
        borrow.borrow_date,
        borrow.expected_return_date,
        borrow.status,
        approvedById,
        approvedAt,
        borrow.notes || null
      ]
    );

    const borrowId = result.insertId;
    for (const line of borrow.items) {
      const itemId = await getItemId(connection, line.item_code);
      await connection.query(
        `INSERT INTO borrow_items (borrow_transaction_id, inventory_item_id, quantity) VALUES (?, ?, ?)`,
        [borrowId, itemId, line.quantity]
      );
    }

    created += 1;
    console.log(`  Created borrow: ${borrow.transaction_code} (${borrow.status}, ${borrow.borrower})`);
  }

  return { created, skipped };
}

async function seedReturns(connection) {
  const prefix = 'RTN-SMP-';
  const existing = await countSample(connection, 'return_transactions', 'transaction_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Returns: ${existing} sample records exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const ret of SAMPLE_RETURNS) {
    if (await existsByCode(connection, 'return_transactions', 'transaction_code', ret.transaction_code)) {
      skipped += 1;
      continue;
    }

    const borrowId = await getBorrowId(connection, ret.borrow_code);
    const returnedBy = await getUser(connection, ret.returned_by);

    await connection.query(
      `INSERT INTO return_transactions
        (transaction_code, borrow_transaction_id, returned_by, return_date, \`condition\`, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [
        ret.transaction_code,
        borrowId,
        returnedBy.id,
        ret.return_date,
        ret.condition,
        ret.notes
      ]
    );

    created += 1;
    console.log(`  Created return: ${ret.transaction_code} → ${ret.borrow_code}`);
  }

  return { created, skipped };
}

async function seedTransfers(connection) {
  const prefix = 'TRF-SMP-';
  const existing = await countSample(connection, 'transfer_requests', 'transaction_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Transfers: ${existing} sample requests exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const transfer of SAMPLE_TRANSFERS) {
    if (await existsByCode(connection, 'transfer_requests', 'transaction_code', transfer.transaction_code)) {
      skipped += 1;
      continue;
    }

    const itemId = await getItemId(connection, transfer.item_code);
    const requester = await getUser(connection, transfer.requested_by);
    let approvedById = null;
    let approvedAt = null;
    if (transfer.approved_by) {
      const approver = await getUser(connection, transfer.approved_by);
      approvedById = approver.id;
      approvedAt = '2025-06-01 10:00:00';
    }

    await connection.query(
      `INSERT INTO transfer_requests
        (transaction_code, inventory_item_id, quantity, from_location_id, to_location_id,
         from_department_id, to_department_id, reason, status, requested_by, approved_by,
         approved_at, notes, request_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.transaction_code,
        itemId,
        transfer.quantity,
        transfer.from_location_id,
        transfer.to_location_id,
        transfer.from_department_id,
        transfer.to_department_id,
        transfer.reason,
        transfer.status,
        requester.id,
        approvedById,
        approvedAt,
        transfer.notes || null,
        '2025-06-01'
      ]
    );

    created += 1;
    console.log(`  Created transfer: ${transfer.transaction_code} (${transfer.status})`);
  }

  return { created, skipped };
}

async function seedMaintenance(connection) {
  const prefix = 'MNT-SMP-';
  const existing = await countSample(connection, 'maintenance_records', 'transaction_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Maintenance: ${existing} sample records exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const record of SAMPLE_MAINTENANCE) {
    if (await existsByCode(connection, 'maintenance_records', 'transaction_code', record.transaction_code)) {
      skipped += 1;
      continue;
    }

    const itemId = await getItemId(connection, record.item_code);
    const requester = await getUser(connection, record.requested_by);
    let approvedById = null;
    let performedById = null;
    if (record.approved_by) {
      approvedById = (await getUser(connection, record.approved_by)).id;
    }
    if (record.performed_by) {
      performedById = (await getUser(connection, record.performed_by)).id;
    }

    await connection.query(
      `INSERT INTO maintenance_records
        (transaction_code, inventory_item_id, requested_by, requested_date, reported_problem,
         maintenance_type, priority, scheduled_date, completed_date, service_provider,
         status, description, cost, performed_by, approved_by, approved_at, rejection_reason, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        record.transaction_code,
        itemId,
        requester.id,
        record.requested_date,
        record.reported_problem,
        record.maintenance_type,
        record.priority,
        record.scheduled_date,
        record.completed_date || null,
        record.service_provider,
        record.status,
        record.description,
        record.cost || null,
        performedById,
        approvedById,
        approvedById ? `${record.scheduled_date} 11:00:00` : null,
        record.rejection_reason || null,
        record.description
      ]
    );

    created += 1;
    console.log(`  Created maintenance: ${record.transaction_code} (${record.status}, ${record.priority})`);
  }

  return { created, skipped };
}

async function seedDisposals(connection) {
  const prefix = 'DSP-SMP-';
  const existing = await countSample(connection, 'disposal_requests', 'transaction_code', prefix);
  if (existing >= MIN_SAMPLE) {
    console.log(`  Disposals: ${existing} sample requests exist — skipped`);
    return { created: 0, skipped: existing };
  }

  let created = 0;
  let skipped = 0;

  for (const disposal of SAMPLE_DISPOSALS) {
    if (await existsByCode(connection, 'disposal_requests', 'transaction_code', disposal.transaction_code)) {
      skipped += 1;
      continue;
    }

    const itemId = await getItemId(connection, disposal.item_code);
    const requester = await getUser(connection, disposal.requested_by);
    let inspectedById = null;
    let approvedById = null;
    if (disposal.inspected_by) {
      inspectedById = (await getUser(connection, disposal.inspected_by)).id;
    }
    if (disposal.approved_by) {
      approvedById = (await getUser(connection, disposal.approved_by)).id;
    }

    await connection.query(
      `INSERT INTO disposal_requests
        (transaction_code, inventory_item_id, quantity, reason, inspection_notes,
         disposal_method, status, requested_by, inspected_by, approved_by, disposal_date, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        disposal.transaction_code,
        itemId,
        disposal.quantity,
        disposal.reason,
        disposal.inspection_notes || null,
        disposal.disposal_method || null,
        disposal.status,
        requester.id,
        inspectedById,
        approvedById,
        disposal.disposal_date || null,
        disposal.notes || null
      ]
    );

    created += 1;
    console.log(`  Created disposal: ${disposal.transaction_code} (${disposal.status})`);
  }

  return { created, skipped };
}

async function printSummary(connection) {
  const tables = [
    ['inventory_items (SMP-INV-*)', 'inventory_items', 'item_code', 'SMP-INV-'],
    ['borrow_transactions (BRW-SMP-*)', 'borrow_transactions', 'transaction_code', 'BRW-SMP-'],
    ['return_transactions (RTN-SMP-*)', 'return_transactions', 'transaction_code', 'RTN-SMP-'],
    ['transfer_requests (TRF-SMP-*)', 'transfer_requests', 'transaction_code', 'TRF-SMP-'],
    ['maintenance_records (MNT-SMP-*)', 'maintenance_records', 'transaction_code', 'MNT-SMP-'],
    ['disposal_requests (DSP-SMP-*)', 'disposal_requests', 'transaction_code', 'DSP-SMP-']
  ];

  console.log('\n--- Sample data counts ---\n');
  for (const [label, table, column, prefix] of tables) {
    const sample = await countSample(connection, table, column, prefix);
    const [total] = await connection.query(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`${label}: ${sample} sample / ${total[0].c} total`);
  }
}

async function verifyPrerequisites(connection) {
  const [depts] = await connection.query('SELECT COUNT(*) AS c FROM departments');
  if (depts[0].c < 1) {
    throw new Error('No departments found. Run "npm run seed" first.');
  }

  const requiredUsers = ['admin', 'staff', 'pm_test', 'deptcust_test', 'labcust_test'];
  for (const username of requiredUsers) {
    await getUser(connection, username);
  }
}

async function seedSampleData() {
  const connection = await pool.getConnection();
  const stats = {};

  try {
    console.log('Seeding sample data for QA / defense testing...\n');
    await connection.beginTransaction();
    await verifyPrerequisites(connection);

    console.log('Inventory items:');
    stats.inventory = await seedInventory(connection);

    console.log('\nBorrow transactions:');
    stats.borrows = await seedBorrows(connection);

    console.log('\nReturn records:');
    stats.returns = await seedReturns(connection);

    console.log('\nTransfer requests:');
    stats.transfers = await seedTransfers(connection);

    console.log('\nMaintenance records:');
    stats.maintenance = await seedMaintenance(connection);

    console.log('\nDisposal requests:');
    stats.disposals = await seedDisposals(connection);

    await connection.commit();

    await printSummary(connection);

    const totalCreated = Object.values(stats).reduce((sum, s) => sum + (s.created || 0), 0);
    console.log(`\nDone. Created ${totalCreated} new sample record(s).`);
    console.log('Re-run safely: npm run seed:sample-data');
    console.log('See SAMPLE_DATA.md for full reference.');
  } catch (error) {
    await connection.rollback();
    console.error('Seed sample data failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seedSampleData();
