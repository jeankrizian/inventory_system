/**
 * Seed varied sample data for QA / defense testing.
 * Idempotent — skips records that already exist by item_code or transaction_code.
 * Does NOT create, modify, or delete user accounts.
 * Run: npm run seed:sample-data
 * Prerequisites: npm run seed:test-accounts (and npm run seed for base roles/admin if fresh DB)
 */
require('dotenv').config();
const pool = require('../config/database');

const MIN_SAMPLE = 5;
const SAMPLE_PREFIX = 'SMP-';

const SAMPLE_SUPPLIERS = [
  { name: 'TechPro Solutions', contact_person: 'Maria Santos', phone: '09171234567', email: 'maria@techpro.com', address: 'Imus, Cavite' },
  { name: 'Office Depot PH', contact_person: 'Juan Dela Cruz', phone: '09181234567', email: 'juan@officedepot.ph', address: 'Dasmariñas, Cavite' },
  { name: 'LabEquip Supply Co.', contact_person: 'Ana Reyes', phone: '09191234567', email: 'ana@labequip.com', address: 'Bacoor, Cavite' },
  { name: 'Furniture World', contact_person: 'Pedro Garcia', phone: '09201234567', email: 'pedro@furnitureworld.com', address: 'Tagaytay, Cavite' }
];

const SAMPLE_LOCATIONS = [
  { name: 'Com Lab 1', description: 'Main computer laboratory' },
  { name: 'Engineering Workshop', description: 'Engineering tools and equipment room' },
  { name: 'SHS Faculty Room', description: 'Senior High School faculty office' },
  { name: 'Property Office Storage', description: 'Central property management storage' },
  { name: 'Main Building Lobby', description: 'Lobby AV and display equipment' }
];

const EXISTING_ITEM_ENRICHMENTS = [
  { item_code: 'ENG-001', item_name: 'Torque Wrench Set (Metric)', material: 'Metal' },
  { item_code: 'ENG-002', item_name: 'Engineering Drawing Template Set', material: 'Plastic' },
  { item_code: 'ENG-003', item_name: 'Digital Caliper 150mm', material: 'Metal' },
  { item_code: 'ENG-004', item_name: 'Safety Helmet (Yellow)', material: 'Plastic' },
  { item_code: 'ENG-005', item_name: 'Steel Measuring Tape 5m', material: 'Metal' },
  { item_code: 'ENG-006', item_name: 'Cordless Drill Driver', material: 'Metal' },
  { item_code: 'ENG-007', item_name: 'Workbench Vise 4-inch', material: 'Metal' },
  { item_code: 'ENG-008', item_name: 'Angle Grinder 4-inch', material: 'Metal' }
];

const SAMPLE_INVENTORY = [
  {
    item_code: 'SMP-ICT-001',
    item_name: 'Lenovo ThinkPad E14 Laptop',
    departmentCode: 'ICT',
    custodianUsername: 'ict_custodian',
    locationName: 'Com Lab 1',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ICT-2025-001',
    brand: 'Lenovo',
    model: 'ThinkPad E14 Gen 5',
    quantity: 12,
    available_quantity: 9,
    unit: 'units',
    acquisition_date: '2025-01-20',
    unit_cost: 48500,
    acquisition_cost: 582000,
    purchase_request_number: 'PR-2025-014',
    purchase_order_number: 'PO-2025-008',
    invoice_number: 'INV-TPS-2025-112',
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 2,
    maintenance_schedule: 'Annual',
    next_maintenance_date: '2026-01-15',
    maintenance_status: 'Scheduled',
    service_provider: 'TechPro Solutions'
  },
  {
    item_code: 'SMP-ICT-002',
    item_name: 'Epson LCD Projector',
    departmentCode: 'ICT',
    custodianUsername: 'ict_custodian',
    locationName: 'Com Lab 1',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ICT-2025-002',
    brand: 'Epson',
    model: 'EB-L210SW',
    quantity: 8,
    available_quantity: 5,
    unit: 'units',
    acquisition_date: '2025-02-10',
    unit_cost: 32000,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 2
  },
  {
    item_code: 'SMP-ICT-003',
    item_name: 'Cisco Network Switch 28-Port',
    departmentCode: 'ICT',
    custodianUsername: 'ict_custodian',
    locationName: 'Com Lab 1',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ICT-2025-003',
    brand: 'Cisco',
    model: 'SG350-28',
    quantity: 4,
    available_quantity: 2,
    unit: 'units',
    acquisition_date: '2025-03-05',
    unit_cost: 28500,
    condition: 'Good',
    status: 'Low Stock',
    low_stock_threshold: 2
  },
  {
    item_code: 'SMP-ICT-004',
    item_name: '8GB DDR4 RAM Module',
    departmentCode: 'ICT',
    locationName: 'Property Office Storage',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Semi-Durable',
    brand: 'Kingston',
    model: 'KVR26N19S8/8',
    quantity: 20,
    available_quantity: 14,
    unit: 'pcs',
    acquisition_date: '2025-04-01',
    unit_cost: 1800,
    condition: 'New',
    status: 'Available',
    low_stock_threshold: 5
  },
  {
    item_code: 'SMP-ICT-005',
    item_name: 'HDMI Cable 2m',
    departmentCode: 'ICT',
    locationName: 'Com Lab 1',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Semi-Durable',
    brand: 'Belkin',
    model: 'HDMI-2M',
    quantity: 30,
    available_quantity: 0,
    unit: 'pcs',
    acquisition_date: '2025-04-15',
    condition: 'Good',
    status: 'Out of Stock',
    low_stock_threshold: 5
  },
  {
    item_code: 'SMP-ENG-001',
    item_name: 'MIG Welding Machine',
    departmentCode: 'ENG',
    custodianUsername: 'eng_custodian',
    locationName: 'Engineering Workshop',
    supplierName: 'LabEquip Supply Co.',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ENG-2025-001',
    brand: 'Lincoln Electric',
    model: 'Pro-MIG 180',
    quantity: 3,
    available_quantity: 2,
    unit: 'units',
    acquisition_date: '2025-02-20',
    unit_cost: 65000,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 1,
    maintenance_schedule: 'Semi-Annual',
    next_maintenance_date: '2025-08-20',
    maintenance_status: 'Scheduled',
    service_provider: 'Lincoln Service Center'
  },
  {
    item_code: 'SMP-ENG-002',
    item_name: 'Digital Multimeter',
    departmentCode: 'ENG',
    custodianUsername: 'eng_custodian',
    locationName: 'Engineering Workshop',
    supplierName: 'LabEquip Supply Co.',
    asset_classification: 'Semi-Durable',
    brand: 'Fluke',
    model: '117',
    quantity: 15,
    available_quantity: 11,
    unit: 'pcs',
    acquisition_date: '2025-03-01',
    unit_cost: 8500,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 3
  },
  {
    item_code: 'SMP-ENG-003',
    item_name: 'Bench Grinder 6-inch',
    departmentCode: 'ENG',
    custodianUsername: 'eng_custodian',
    locationName: 'Engineering Workshop',
    supplierName: 'LabEquip Supply Co.',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-ENG-2025-002',
    brand: 'Bosch',
    model: 'GBG 60-20',
    quantity: 2,
    available_quantity: 1,
    unit: 'units',
    acquisition_date: '2025-03-15',
    unit_cost: 12000,
    condition: 'Good',
    status: 'Under Maintenance',
    low_stock_threshold: 1,
    maintenance_status: 'In Progress',
    service_provider: 'Bosch Authorized Service'
  },
  {
    item_code: 'SMP-ENG-004',
    item_name: 'Safety Goggles (Clear)',
    departmentCode: 'ENG',
    locationName: 'Engineering Workshop',
    supplierName: 'Office Depot PH',
    asset_classification: 'Semi-Durable',
    brand: '3M',
    model: 'SF201AF',
    quantity: 50,
    available_quantity: 8,
    unit: 'pcs',
    acquisition_date: '2025-04-10',
    condition: 'New',
    status: 'Low Stock',
    low_stock_threshold: 10
  },
  {
    item_code: 'SMP-SHS-001',
    item_name: 'BenQ Classroom Projector',
    departmentCode: 'SHS',
    custodianUsername: 'shs_custodian',
    locationName: 'SHS Faculty Room',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-SHS-2025-001',
    brand: 'BenQ',
    model: 'MW560',
    quantity: 6,
    available_quantity: 4,
    unit: 'units',
    acquisition_date: '2025-01-25',
    unit_cost: 28000,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 2
  },
  {
    item_code: 'SMP-SHS-002',
    item_name: 'General Science Lab Kit',
    departmentCode: 'SHS',
    custodianUsername: 'shs_custodian',
    locationName: 'SHS Faculty Room',
    supplierName: 'LabEquip Supply Co.',
    asset_classification: 'Semi-Durable',
    brand: 'Eisco',
    model: 'GS-KIT-100',
    quantity: 10,
    available_quantity: 7,
    unit: 'sets',
    acquisition_date: '2025-02-05',
    unit_cost: 4500,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 2
  },
  {
    item_code: 'SMP-SHS-003',
    item_name: 'Interactive Whiteboard 75-inch',
    departmentCode: 'SHS',
    custodianUsername: 'shs_custodian',
    locationName: 'Main Building Lobby',
    supplierName: 'TechPro Solutions',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-SHS-2025-002',
    brand: 'Samsung',
    model: 'Flip Pro WM75B',
    quantity: 2,
    available_quantity: 2,
    unit: 'units',
    acquisition_date: '2025-05-01',
    unit_cost: 185000,
    condition: 'New',
    status: 'Available',
    low_stock_threshold: 1,
    maintenance_schedule: 'Annual',
    next_maintenance_date: '2026-05-01',
    maintenance_status: 'Scheduled',
    service_provider: 'Samsung Business Solutions'
  },
  {
    item_code: 'SMP-SHS-004',
    item_name: 'Portable PA Speaker System',
    departmentCode: 'SHS',
    locationName: 'Main Building Lobby',
    supplierName: 'Office Depot PH',
    asset_classification: 'Semi-Durable',
    brand: 'JBL',
    model: 'EON ONE Compact',
    quantity: 4,
    available_quantity: 3,
    unit: 'sets',
    acquisition_date: '2025-05-20',
    unit_cost: 22000,
    condition: 'Good',
    status: 'Available',
    low_stock_threshold: 1
  },
  {
    item_code: 'SMP-SHS-005',
    item_name: 'Celestron Digital Microscope',
    departmentCode: 'SHS',
    custodianUsername: 'shs_custodian',
    locationName: 'SHS Faculty Room',
    supplierName: 'LabEquip Supply Co.',
    asset_classification: 'Non-Consumable (Fixed Asset)',
    property_tag: 'CI-SHS-2025-003',
    brand: 'Celestron',
    model: 'LCD Digital II',
    quantity: 5,
    available_quantity: 3,
    unit: 'units',
    acquisition_date: '2025-06-01',
    unit_cost: 18500,
    condition: 'Good',
    status: 'Borrowed',
    low_stock_threshold: 1
  }
];

const SAMPLE_BORROWS = [
  {
    transaction_code: 'BRW-SMP-001',
    borrower: 'ict_custodian',
    borrower_department: 'ICT Department',
    purpose: 'Faculty training on new LMS platform',
    borrow_date: '2025-06-01',
    expected_return_date: '2025-06-15',
    status: 'Pending',
    items: [{ item_code: 'SMP-ICT-002', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-002',
    borrower: 'eng_custodian',
    borrower_department: 'Engineering Department',
    purpose: 'Skills demonstration for Grade 12 students',
    borrow_date: '2025-06-05',
    expected_return_date: '2025-06-20',
    status: 'Approved',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-ENG-001', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-003',
    borrower: 'shs_custodian',
    borrower_department: 'Senior High School',
    purpose: 'Science practical exam setup',
    borrow_date: '2025-06-10',
    expected_return_date: '2025-06-25',
    status: 'Borrowed',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-SHS-005', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-004',
    borrower: 'pm_test',
    borrower_department: 'Property Management Office',
    purpose: 'SHS orientation AV presentation',
    borrow_date: '2025-05-15',
    expected_return_date: '2025-05-30',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-SHS-001', quantity: 1 }]
  },
  {
    transaction_code: 'BRW-SMP-005',
    borrower: 'ict_custodian',
    borrower_department: 'ICT Department',
    purpose: 'Network infrastructure audit presentation',
    borrow_date: '2025-05-01',
    expected_return_date: '2025-05-14',
    status: 'Returned',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-ICT-001', quantity: 2 }]
  },
  {
    transaction_code: 'BRW-SMP-006',
    borrower: 'eng_custodian',
    borrower_department: 'Engineering Department',
    purpose: 'Engineering week equipment showcase',
    borrow_date: '2025-06-20',
    expected_return_date: '2025-07-05',
    status: 'Rejected',
    approved_by: 'admin',
    notes: 'Requested quantity exceeds available stock',
    items: [{ item_code: 'SMP-ENG-001', quantity: 5 }]
  },
  {
    transaction_code: 'BRW-SMP-007',
    borrower: 'shs_custodian',
    borrower_department: 'Senior High School',
    purpose: 'Classroom multimedia lesson',
    borrow_date: '2025-04-01',
    expected_return_date: '2025-04-15',
    status: 'Overdue',
    approved_by: 'admin',
    items: [{ item_code: 'SMP-SHS-001', quantity: 1 }]
  }
];

const SAMPLE_RETURNS = [
  { transaction_code: 'RTN-SMP-001', borrow_code: 'BRW-SMP-004', returned_by: 'pm_test', return_date: '2025-05-28', condition: 'Good', notes: 'Projector returned in working condition' },
  { transaction_code: 'RTN-SMP-002', borrow_code: 'BRW-SMP-005', returned_by: 'ict_custodian', return_date: '2025-05-12', condition: 'Good', notes: 'All laptops accounted for and functional' }
];

const SAMPLE_TRANSFERS = [
  {
    transaction_code: 'TRF-SMP-001',
    item_code: 'SMP-ICT-001',
    quantity: 1,
    fromLocationName: 'Com Lab 1',
    toLocationName: 'SHS Faculty Room',
    fromDepartmentCode: 'ICT',
    toDepartmentCode: 'SHS',
    reason: 'Temporary laptop loan to SHS faculty for research week',
    status: 'Pending',
    requested_by: 'ict_custodian'
  },
  {
    transaction_code: 'TRF-SMP-002',
    item_code: 'SMP-ICT-004',
    quantity: 4,
    fromLocationName: 'Property Office Storage',
    toLocationName: 'Com Lab 1',
    fromDepartmentCode: 'ICT',
    toDepartmentCode: 'ICT',
    reason: 'RAM modules needed for Com Lab 1 PC upgrades',
    status: 'Approved',
    requested_by: 'pm_test',
    approved_by: 'admin'
  },
  {
    transaction_code: 'TRF-SMP-003',
    item_code: 'SMP-SHS-001',
    quantity: 1,
    fromLocationName: 'SHS Faculty Room',
    toLocationName: 'Main Building Lobby',
    fromDepartmentCode: 'SHS',
    toDepartmentCode: 'SHS',
    reason: 'Projector for lobby school assembly',
    status: 'Rejected',
    requested_by: 'shs_custodian',
    approved_by: 'admin',
    notes: 'Item currently on borrow — transfer deferred'
  },
  {
    transaction_code: 'TRF-SMP-004',
    item_code: 'SMP-ENG-002',
    quantity: 3,
    fromLocationName: 'Engineering Workshop',
    toLocationName: 'Property Office Storage',
    fromDepartmentCode: 'ENG',
    toDepartmentCode: 'ENG',
    reason: 'Spare multimeters for property audit calibration',
    status: 'Completed',
    requested_by: 'pm_test',
    approved_by: 'admin'
  }
];

const SAMPLE_MAINTENANCE = [
  {
    transaction_code: 'MNT-SMP-001',
    item_code: 'SMP-ENG-003',
    requested_by: 'eng_custodian',
    requested_date: '2025-06-01',
    reported_problem: 'Grinder motor overheating during extended use',
    maintenance_type: 'Corrective',
    priority: 'High',
    scheduled_date: '2025-06-15',
    service_provider: 'Bosch Authorized Service',
    status: 'Pending',
    description: 'Bench grinder motor inspection and bearing replacement'
  },
  {
    transaction_code: 'MNT-SMP-002',
    item_code: 'SMP-ICT-001',
    requested_by: 'ict_custodian',
    requested_date: '2025-05-20',
    reported_problem: 'Annual preventive maintenance for laptop fleet',
    maintenance_type: 'Preventive',
    priority: 'Medium',
    scheduled_date: '2025-06-10',
    service_provider: 'TechPro Solutions',
    status: 'Approved',
    approved_by: 'admin',
    description: 'Dust cleaning, thermal paste replacement, and OS updates'
  },
  {
    transaction_code: 'MNT-SMP-003',
    item_code: 'SMP-SHS-001',
    requested_by: 'pm_test',
    requested_date: '2025-05-01',
    reported_problem: 'Projector lamp hours approaching end of life',
    maintenance_type: 'Preventive',
    priority: 'Low',
    scheduled_date: '2025-07-01',
    service_provider: 'BenQ Authorized Service',
    status: 'Scheduled',
    approved_by: 'admin',
    description: 'Replace projector lamp before next school year'
  },
  {
    transaction_code: 'MNT-SMP-004',
    item_code: 'SMP-SHS-005',
    requested_by: 'shs_custodian',
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
    cost: 1500,
    description: 'Focus mechanism serviced and calibrated'
  },
  {
    transaction_code: 'MNT-SMP-005',
    item_code: 'SMP-ICT-005',
    requested_by: 'ict_custodian',
    requested_date: '2025-06-18',
    reported_problem: 'Bulk HDMI cables showing bent connectors',
    maintenance_type: 'Emergency',
    priority: 'High',
    scheduled_date: '2025-06-20',
    status: 'Cancelled',
    approved_by: 'admin',
    rejection_reason: 'Items marked for disposal instead of repair',
    description: 'Damaged HDMI cables — disposal request filed separately'
  }
];

const SAMPLE_DISPOSALS = [
  {
    transaction_code: 'DSP-SMP-001',
    item_code: 'SMP-ICT-005',
    quantity: 10,
    reason: 'HDMI cables with bent pins and exposed wiring',
    status: 'Pending',
    requested_by: 'ict_custodian',
    notes: 'Replacement cables already ordered'
  },
  {
    transaction_code: 'DSP-SMP-002',
    item_code: 'SMP-ENG-004',
    quantity: 5,
    reason: 'Scratched safety goggles beyond classroom use',
    status: 'Inspected',
    requested_by: 'eng_custodian',
    inspected_by: 'pm_test',
    inspection_notes: 'Confirmed unusable — lenses scratched on all units'
  },
  {
    transaction_code: 'DSP-SMP-003',
    item_code: 'SMP-ICT-003',
    quantity: 1,
    reason: 'Network switch with intermittent port failures',
    status: 'Approved',
    requested_by: 'ict_custodian',
    inspected_by: 'pm_test',
    approved_by: 'admin',
    disposal_method: 'Recycling',
    notes: 'E-waste recycling per CI policy'
  },
  {
    transaction_code: 'DSP-SMP-004',
    item_code: 'SMP-SHS-004',
    quantity: 1,
    reason: 'PA speaker with blown driver — repair uneconomical',
    status: 'Rejected',
    requested_by: 'shs_custodian',
    approved_by: 'admin',
    notes: 'Sent for warranty repair instead'
  },
  {
    transaction_code: 'DSP-SMP-005',
    item_code: 'ENG-001',
    quantity: 1,
    reason: 'Torque wrench with broken ratchet mechanism',
    status: 'Completed',
    requested_by: 'eng_custodian',
    inspected_by: 'admin',
    approved_by: 'admin',
    disposal_method: 'Destruction',
    disposal_date: '2025-05-30',
    notes: 'Tool destroyed per disposal committee approval'
  }
];

const SAMPLE_NOTIFICATIONS = [
  { username: 'pm_test', title: 'Low Stock Alert', message: 'SMP-ICT-003 Cisco Network Switch is below threshold (2 remaining).', type: 'low_stock', link_url: '/pages/inventory.html?low_stock=true' },
  { username: 'pm_test', title: 'Borrow Request Pending', message: 'BRW-SMP-001 awaits approval from ICT custodian.', type: 'borrow_pending', link_url: '/pages/orders.html' },
  { username: 'ict_custodian', title: 'Transfer Request Approved', message: 'TRF-SMP-002 RAM module transfer has been approved.', type: 'transfer_approved', link_url: '/pages/transfer-requests.html' },
  { username: 'eng_custodian', title: 'Maintenance Scheduled', message: 'MNT-SMP-001 bench grinder repair scheduled for June 15.', type: 'maintenance_scheduled', link_url: '/pages/maintenance-requests.html' },
  { username: 'shs_custodian', title: 'Borrow Overdue', message: 'BRW-SMP-007 classroom projector is past expected return date.', type: 'borrow_overdue', link_url: '/pages/orders.html' },
  { username: 'admin', title: 'Disposal Pending Inspection', message: 'DSP-SMP-001 HDMI cable disposal awaits inspection.', type: 'disposal_pending', link_url: '/pages/disposal-requests.html' }
];

const SAMPLE_ACTIVITY_LOGS = [
  { username: 'admin', action: 'CREATE', module: 'Inventory', description: 'SMP: Seeded sample inventory records for QA testing' },
  { username: 'pm_test', action: 'BORROW', module: 'Borrow', description: 'SMP: Created borrow request BRW-SMP-004' },
  { username: 'ict_custodian', action: 'TRANSFER', module: 'Transfer', description: 'SMP: Requested transfer TRF-SMP-001' },
  { username: 'eng_custodian', action: 'MAINTENANCE', module: 'Maintenance', description: 'SMP: Reported maintenance issue MNT-SMP-001' },
  { username: 'shs_custodian', action: 'RETURN', module: 'Return', description: 'SMP: Processed return RTN-SMP-001' },
  { username: 'admin', action: 'APPROVE', module: 'Borrow', description: 'SMP: Approved borrow request BRW-SMP-002' },
  { username: 'pm_test', action: 'INSPECT', module: 'Disposal', description: 'SMP: Inspected disposal request DSP-SMP-002' },
  { username: 'admin', action: 'LOGIN', module: 'Auth', description: 'SMP: Administrator session for sample data verification' }
];

const SAMPLE_COMPONENTS = [
  {
    parent_item_code: 'SMP-ICT-001',
    old_component_name: 'Original 8GB RAM',
    new_item_code: 'SMP-ICT-004',
    replaced_by: 'ict_custodian',
    replacement_date: '2025-05-10',
    notes: 'Upgraded laptop RAM from 8GB to 16GB using stock module'
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

async function getDepartment(connection, code) {
  const [rows] = await connection.query(
    `SELECT id, name, code, custodian_id FROM departments
     WHERE code = ? AND (is_archived = 0 OR is_archived IS NULL)
     LIMIT 1`,
    [code]
  );
  if (!rows.length) throw new Error(`Department not found: ${code}`);
  return rows[0];
}

async function getLocationId(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM locations WHERE name = ? LIMIT 1',
    [name]
  );
  if (!rows.length) throw new Error(`Location not found: ${name}`);
  return rows[0].id;
}

async function getSupplierId(connection, name) {
  const [rows] = await connection.query(
    'SELECT id FROM suppliers WHERE name = ? LIMIT 1',
    [name]
  );
  if (!rows.length) throw new Error(`Supplier not found: ${name}`);
  return rows[0].id;
}

async function getItemId(connection, itemCode) {
  const [rows] = await connection.query(
    'SELECT id FROM inventory_items WHERE item_code = ?',
    [itemCode]
  );
  if (!rows.length) throw new Error(`Inventory item not found: ${itemCode}`);
  return rows[0].id;
}

async function getBorrowId(connection, code) {
  const [rows] = await connection.query(
    'SELECT id FROM borrow_transactions WHERE transaction_code = ?',
    [code]
  );
  if (!rows.length) throw new Error(`Borrow transaction not found: ${code}`);
  return rows[0].id;
}

async function ensureSuppliers(connection) {
  let created = 0;
  for (const supplier of SAMPLE_SUPPLIERS) {
    const [existing] = await connection.query('SELECT id FROM suppliers WHERE name = ? LIMIT 1', [supplier.name]);
    if (existing.length) continue;
    await connection.query(
      `INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES (?, ?, ?, ?, ?)`,
      [supplier.name, supplier.contact_person, supplier.phone, supplier.email, supplier.address]
    );
    created += 1;
    console.log(`  Created supplier: ${supplier.name}`);
  }
  return created;
}

async function ensureLocations(connection) {
  let created = 0;
  for (const location of SAMPLE_LOCATIONS) {
    const [existing] = await connection.query('SELECT id FROM locations WHERE name = ? LIMIT 1', [location.name]);
    if (existing.length) continue;
    await connection.query(
      'INSERT INTO locations (name, description) VALUES (?, ?)',
      [location.name, location.description]
    );
    created += 1;
    console.log(`  Created location: ${location.name}`);
  }
  return created;
}

async function enrichExistingInventory(connection) {
  let updated = 0;
  for (const item of EXISTING_ITEM_ENRICHMENTS) {
    const [rows] = await connection.query('SELECT id, department_id FROM inventory_items WHERE item_code = ? LIMIT 1', [item.item_code]);
    if (!rows.length) continue;

    const [deptRows] = await connection.query('SELECT custodian_id FROM departments WHERE id = ?', [rows[0].department_id]);
    const custodianId = deptRows[0]?.custodian_id || null;
    const locationId = await getLocationId(connection, 'Engineering Workshop').catch(() => null)
      || await getLocationId(connection, 'Com Lab 1');

    await connection.query(
      `UPDATE inventory_items
       SET item_name = ?, material = ?, custodian_id = COALESCE(custodian_id, ?), location_id = COALESCE(location_id, ?),
           description = COALESCE(description, ?)
       WHERE item_code = ?`,
      [
        item.item_name,
        item.material,
        custodianId,
        locationId,
        `Engineering department equipment — ${item.item_name}`,
        item.item_code
      ]
    );
    updated += 1;
    console.log(`  Enriched existing item: ${item.item_code}`);
  }
  return updated;
}

async function seedInventory(connection) {
  const prefix = 'SMP-';
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

    const department = await getDepartment(connection, item.departmentCode);
    const locationId = await getLocationId(connection, item.locationName);
    const supplierId = await getSupplierId(connection, item.supplierName);
    let custodianId = null;
    if (item.custodianUsername) {
      custodianId = (await getUser(connection, item.custodianUsername)).id;
    } else if (department.custodian_id) {
      custodianId = department.custodian_id;
    }

    await connection.query(
      `INSERT INTO inventory_items
        (item_code, item_name, description, department_id, asset_classification, material, property_tag, custodian_id,
         brand, model, quantity, available_quantity, unit, supplier_id,
         acquisition_date, purchase_request_number, purchase_order_number, invoice_number,
         unit_cost, acquisition_cost, \`condition\`, status, location_id, low_stock_threshold,
         maintenance_schedule, next_maintenance_date, maintenance_status, service_provider)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        item.item_code,
        item.item_name,
        `${item.item_name} — ${department.name} department asset`,
        department.id,
        item.asset_classification,
        item.material || null,
        item.property_tag || null,
        custodianId,
        item.brand,
        item.model,
        item.quantity,
        item.available_quantity,
        item.unit,
        supplierId,
        item.acquisition_date || null,
        item.purchase_request_number || null,
        item.purchase_order_number || null,
        item.invoice_number || null,
        item.unit_cost || null,
        item.acquisition_cost || null,
        item.condition,
        item.status,
        locationId,
        item.low_stock_threshold,
        item.maintenance_schedule || null,
        item.next_maintenance_date || null,
        item.maintenance_status || null,
        item.service_provider || null
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
      approvedById = (await getUser(connection, borrow.approved_by)).id;
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

    for (const line of borrow.items) {
      const itemId = await getItemId(connection, line.item_code);
      await connection.query(
        'INSERT INTO borrow_items (borrow_transaction_id, inventory_item_id, quantity) VALUES (?, ?, ?)',
        [result.insertId, itemId, line.quantity]
      );
    }

    created += 1;
    console.log(`  Created borrow: ${borrow.transaction_code} (${borrow.status})`);
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
      [ret.transaction_code, borrowId, returnedBy.id, ret.return_date, ret.condition, ret.notes]
    );

    created += 1;
    console.log(`  Created return: ${ret.transaction_code}`);
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
    const fromDept = await getDepartment(connection, transfer.fromDepartmentCode);
    const toDept = await getDepartment(connection, transfer.toDepartmentCode);
    const fromLocationId = await getLocationId(connection, transfer.fromLocationName);
    const toLocationId = await getLocationId(connection, transfer.toLocationName);

    let approvedById = null;
    let approvedAt = null;
    if (transfer.approved_by) {
      approvedById = (await getUser(connection, transfer.approved_by)).id;
      approvedAt = '2025-06-01 10:00:00';
    }

    const [result] = await connection.query(
      `INSERT INTO transfer_requests
        (transaction_code, inventory_item_id, quantity, from_location_id, to_location_id,
         from_department_id, to_department_id, reason, status, requested_by, approved_by,
         approved_at, notes, request_date)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        transfer.transaction_code,
        itemId,
        transfer.quantity,
        fromLocationId,
        toLocationId,
        fromDept.id,
        toDept.id,
        transfer.reason,
        transfer.status,
        requester.id,
        approvedById,
        approvedAt,
        transfer.notes || null,
        '2025-06-01'
      ]
    );

    if (transfer.status === 'Completed') {
      await connection.query(
        `INSERT INTO transfer_history
          (transfer_request_id, inventory_item_id, from_department_id, to_department_id,
           from_location_id, to_location_id, reason, approved_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          result.insertId,
          itemId,
          fromDept.id,
          toDept.id,
          fromLocationId,
          toLocationId,
          transfer.reason,
          approvedById
        ]
      );
    }

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
    if (record.approved_by) approvedById = (await getUser(connection, record.approved_by)).id;
    if (record.performed_by) performedById = (await getUser(connection, record.performed_by)).id;

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
        record.service_provider || null,
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
    console.log(`  Created maintenance: ${record.transaction_code} (${record.status})`);
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
    if (disposal.inspected_by) inspectedById = (await getUser(connection, disposal.inspected_by)).id;
    if (disposal.approved_by) approvedById = (await getUser(connection, disposal.approved_by)).id;

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

async function seedNotifications(connection) {
  const prefix = 'SMP:';
  const [existing] = await connection.query(
    'SELECT COUNT(*) AS c FROM notifications WHERE message LIKE ?',
    [`${prefix}%`]
  );
  if (existing[0].c >= MIN_SAMPLE) {
    console.log(`  Notifications: ${existing[0].c} sample notifications exist — skipped`);
    return { created: 0, skipped: existing[0].c };
  }

  let created = 0;
  for (const note of SAMPLE_NOTIFICATIONS) {
    const user = await getUser(connection, note.username);
    const [dup] = await connection.query(
      'SELECT id FROM notifications WHERE user_id = ? AND title = ? AND message LIKE ? LIMIT 1',
      [user.id, note.title, `${prefix}%`]
    );
    if (dup.length) continue;

    await connection.query(
      `INSERT INTO notifications (user_id, title, message, type, link_url, is_read)
       VALUES (?, ?, ?, ?, ?, 0)`,
      [user.id, note.title, `${prefix} ${note.message}`, note.type, note.link_url]
    );
    created += 1;
    console.log(`  Created notification for ${note.username}: ${note.title}`);
  }

  return { created, skipped: 0 };
}

async function seedActivityLogs(connection) {
  const prefix = 'SMP:';
  const [existing] = await connection.query(
    'SELECT COUNT(*) AS c FROM activity_logs WHERE description LIKE ?',
    [`${prefix}%`]
  );
  if (existing[0].c >= MIN_SAMPLE) {
    console.log(`  Activity logs: ${existing[0].c} sample logs exist — skipped`);
    return { created: 0, skipped: existing[0].c };
  }

  let created = 0;
  for (const log of SAMPLE_ACTIVITY_LOGS) {
    const user = await getUser(connection, log.username);
    const [dup] = await connection.query(
      'SELECT id FROM activity_logs WHERE user_id = ? AND description = ? LIMIT 1',
      [user.id, log.description]
    );
    if (dup.length) continue;

    await connection.query(
      'INSERT INTO activity_logs (user_id, action, module, description) VALUES (?, ?, ?, ?)',
      [user.id, log.action, log.module, log.description]
    );
    created += 1;
  }

  if (created) console.log(`  Created ${created} sample activity log(s)`);
  return { created, skipped: 0 };
}

async function seedComponents(connection) {
  const [existing] = await connection.query(
    `SELECT COUNT(*) AS c FROM component_replacements cr
     JOIN inventory_items p ON cr.parent_asset_id = p.id
     WHERE p.item_code LIKE 'SMP-%'`
  );
  if (existing[0].c >= 1) {
    console.log(`  Components: ${existing[0].c} sample replacement(s) exist — skipped`);
    return { created: 0, skipped: existing[0].c };
  }

  let created = 0;
  for (const comp of SAMPLE_COMPONENTS) {
    const parentId = await getItemId(connection, comp.parent_item_code);
    const newItemId = comp.new_item_code ? await getItemId(connection, comp.new_item_code) : null;
    const replacedBy = (await getUser(connection, comp.replaced_by)).id;

    await connection.query(
      `INSERT INTO component_replacements
        (parent_asset_id, old_component_name, new_inventory_item_id, replaced_by, replacement_date, notes)
       VALUES (?, ?, ?, ?, ?, ?)`,
      [parentId, comp.old_component_name, newItemId, replacedBy, comp.replacement_date, comp.notes]
    );
    created += 1;
    console.log(`  Created component replacement on ${comp.parent_item_code}`);
  }

  return { created, skipped: 0 };
}

async function printSummary(connection) {
  const tables = [
    ['suppliers', 'suppliers', null, null],
    ['locations', 'locations', null, null],
    ['inventory_items (SMP-*)', 'inventory_items', 'item_code', 'SMP-'],
    ['borrow_transactions (BRW-SMP-*)', 'borrow_transactions', 'transaction_code', 'BRW-SMP-'],
    ['return_transactions (RTN-SMP-*)', 'return_transactions', 'transaction_code', 'RTN-SMP-'],
    ['transfer_requests (TRF-SMP-*)', 'transfer_requests', 'transaction_code', 'TRF-SMP-'],
    ['maintenance_records (MNT-SMP-*)', 'maintenance_records', 'transaction_code', 'MNT-SMP-'],
    ['disposal_requests (DSP-SMP-*)', 'disposal_requests', 'transaction_code', 'DSP-SMP-'],
    ['notifications (SMP:)', 'notifications', 'message', 'SMP:%'],
    ['activity_logs (SMP:)', 'activity_logs', 'description', 'SMP:%'],
    ['component_replacements', 'component_replacements', null, null],
    ['transfer_history', 'transfer_history', null, null]
  ];

  console.log('\n--- Sample data counts ---\n');
  for (const [label, table, column, prefix] of tables) {
    let sample = 0;
    if (column && prefix) {
      sample = await countSample(connection, table, column, prefix.replace('%', ''));
    }
    const [total] = await connection.query(`SELECT COUNT(*) AS c FROM ${table}`);
    console.log(`${label}: ${column ? sample + ' sample / ' : ''}${total[0].c} total`);
  }
}

async function verifyPrerequisites(connection) {
  const [depts] = await connection.query('SELECT COUNT(*) AS c FROM departments WHERE is_archived = 0 OR is_archived IS NULL');
  if (depts[0].c < 1) {
    throw new Error('No departments found. Run "npm run seed:test-accounts" first.');
  }

  for (const username of ['admin', 'pm_test', 'ict_custodian', 'eng_custodian', 'shs_custodian']) {
    await getUser(connection, username);
  }

  for (const code of ['ICT', 'ENG', 'SHS']) {
    await getDepartment(connection, code);
  }
}

async function seedSampleData() {
  const connection = await pool.getConnection();
  const stats = {};

  try {
    console.log('Seeding sample data for QA / defense testing...\n');
    await connection.beginTransaction();
    await verifyPrerequisites(connection);

    console.log('Foundation data (suppliers & locations):');
    stats.suppliers = await ensureSuppliers(connection);
    stats.locations = await ensureLocations(connection);

    console.log('\nEnriching existing inventory:');
    stats.enriched = await enrichExistingInventory(connection);

    console.log('\nInventory items:');
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

    console.log('\nNotifications:');
    stats.notifications = await seedNotifications(connection);

    console.log('\nActivity logs:');
    stats.activity = await seedActivityLogs(connection);

    console.log('\nComponent replacements:');
    stats.components = await seedComponents(connection);

    await connection.commit();

    await printSummary(connection);

    const totalCreated = Object.values(stats).reduce((sum, s) => {
      if (typeof s === 'number') return sum + s;
      return sum + (s?.created || 0);
    }, 0);
    console.log(`\nDone. Created ${totalCreated} new sample record(s).`);
    console.log('Re-run safely: npm run seed:sample-data');
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
