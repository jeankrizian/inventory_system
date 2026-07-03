const bcrypt = require('bcryptjs');
const pool = require('../config/database');

async function seed() {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();

    // Roles
    await connection.query(`
      INSERT IGNORE INTO roles (id, name, description) VALUES
      (1, 'admin', 'Full system access'),
      (2, 'staff', 'Limited access for inventory operations')
    `);

    // Users (password: admin123 / staff123)
    const adminHash = await bcrypt.hash('admin123', 10);
    const staffHash = await bcrypt.hash('staff123', 10);
    await connection.query(`
      INSERT IGNORE INTO users (id, role_id, username, email, password_hash, full_name, is_active) VALUES
      (1, 1, 'admin', 'admin@caviteinstitute.edu', ?, 'System Administrator', 1),
      (2, 2, 'staff', 'staff@caviteinstitute.edu', ?, 'Inventory Staff', 1)
    `, [adminHash, staffHash]);

    // Departments
    await connection.query(`
      INSERT IGNORE INTO departments (id, name, code, description, status) VALUES
      (1, 'Information Technology Department', 'IT', 'School IT department managing technology resources', 'Active'),
      (2, 'Computer Science Department', 'CS', 'Computer Science academic department', 'Active'),
      (3, 'Senior High School', 'SHS', 'Senior High School department', 'Active'),
      (4, 'Junior High School', 'JHS', 'Junior High School department', 'Active'),
      (5, 'Registrar', 'REG', 'Registrar office', 'Active'),
      (6, 'Accounting Office', 'ACC', 'Accounting and finance office', 'Active'),
      (7, 'Human Resources', 'HR', 'Human Resources office', 'Active'),
      (8, 'Guidance Office', 'GDN', 'Guidance and counseling office', 'Active'),
      (9, 'Library', 'LIB', 'School library', 'Active'),
      (10, 'Science Laboratory', 'SCI-LAB', 'Science laboratory facilities', 'Active'),
      (11, 'ICT Laboratory', 'ICT-LAB', 'ICT laboratory facilities', 'Active'),
      (12, 'Principal''s Office', 'PRIN', 'Principal office', 'Active')
    `);

    // Suppliers
    await connection.query(`
      INSERT IGNORE INTO suppliers (id, name, contact_person, phone, email, address) VALUES
      (1, 'TechPro Solutions', 'Maria Santos', '09171234567', 'maria@techpro.com', 'Imus, Cavite'),
      (2, 'Office Depot PH', 'Juan Dela Cruz', '09181234567', 'juan@officedepot.ph', 'Dasmariñas, Cavite'),
      (3, 'LabEquip Supply Co.', 'Ana Reyes', '09191234567', 'ana@labequip.com', 'Bacoor, Cavite'),
      (4, 'Furniture World', 'Pedro Garcia', '09201234567', 'pedro@furnitureworld.com', 'Tagaytay, Cavite')
    `);

    // Locations
    await connection.query(`
      INSERT IGNORE INTO locations (id, name, description) VALUES
      (1, 'ICT Laboratory', 'Computer and ICT laboratory'),
      (2, 'Library', 'School library'),
      (3, 'Science Laboratory', 'Science laboratory rooms'),
      (4, 'Faculty Room', 'Faculty office and lounge'),
      (5, 'Office', 'Administrative office'),
      (6, 'Storage', 'Main storage room')
    `);

    // Inventory Items
    await connection.query(`
      INSERT IGNORE INTO inventory_items 
      (id, item_code, item_name, department_id, brand, model, quantity, available_quantity, unit, supplier_id, purchase_date, \`condition\`, status, location_id, low_stock_threshold) VALUES
      (1, 'ICT-001', 'Desktop Computer', 1, 'Dell', 'OptiPlex 7090', 25, 20, 'units', 1, '2024-01-15', 'Good', 'Available', 1, 5),
      (2, 'ICT-002', 'LCD Projector', 11, 'Epson', 'EB-X06', 10, 8, 'units', 1, '2024-02-20', 'Good', 'Available', 1, 3),
      (3, 'ICT-003', 'Network Switch', 1, 'Cisco', 'SG350-28', 5, 3, 'units', 1, '2024-03-10', 'Good', 'Low Stock', 1, 3),
      (4, 'FUR-001', 'Student Chair', 4, 'Mandaue Foam', 'SC-200', 100, 85, 'pcs', 4, '2023-08-01', 'Good', 'Available', 2, 20),
      (5, 'FUR-002', 'Teacher Desk', 12, 'Uratex', 'TD-150', 30, 28, 'pcs', 4, '2023-09-15', 'Good', 'Available', 4, 5),
      (6, 'LAB-001', 'Microscope', 10, 'Olympus', 'CX23', 15, 12, 'units', 3, '2024-01-20', 'Good', 'Available', 3, 3),
      (7, 'LAB-002', 'Bunsen Burner', 10, 'Generic', 'BB-100', 20, 4, 'pcs', 3, '2023-11-05', 'Fair', 'Low Stock', 3, 5),
      (8, 'LAB-003', 'Test Tube Set', 10, 'Pyrex', 'TT-50', 30, 25, 'sets', 3, '2024-02-01', 'Good', 'Available', 3, 5),
      (9, 'BK-001', 'Science Textbook', 9, 'Phoenix', 'Grade 10 Sci', 50, 45, 'pcs', 2, '2024-06-01', 'New', 'Available', 2, 10),
      (10, 'BK-002', 'Mathematics Reference', 9, 'Rex', 'Adv Math', 30, 28, 'pcs', 2, '2024-06-01', 'New', 'Available', 2, 5),
      (11, 'SPT-001', 'Basketball', 3, 'Molten', 'BG4500', 10, 7, 'pcs', 2, '2024-04-10', 'Good', 'Available', 6, 3),
      (12, 'SPT-002', 'Volleyball Net', 3, 'Mikasa', 'VN-200', 5, 2, 'pcs', 2, '2024-04-10', 'Good', 'Low Stock', 6, 2),
      (13, 'OFF-001', 'A4 Bond Paper', 6, 'Hard Copy', '80gsm', 100, 30, 'reams', 2, '2024-05-01', 'New', 'Available', 5, 20),
      (14, 'OFF-002', 'Whiteboard Marker', 6, 'Pilot', 'WBM-100', 50, 8, 'pcs', 2, '2024-05-15', 'New', 'Low Stock', 5, 15),
      (15, 'ICT-004', 'Laptop Computer', 1, 'Lenovo', 'ThinkPad E14', 15, 10, 'units', 1, '2024-06-01', 'Good', 'Available', 1, 3)
    `);

    // Borrow Transactions
    await connection.query(`
      INSERT IGNORE INTO borrow_transactions 
      (id, transaction_code, borrower_id, borrower_name, borrower_department, purpose, borrow_date, expected_return_date, status, approved_by, approved_at) VALUES
      (1, 'BRW-2024-001', 2, 'Inventory Staff', 'ICT Department', 'Classroom presentation', '2024-06-01', '2024-06-15', 'Returned', 1, '2024-06-01 08:00:00'),
      (2, 'BRW-2024-002', 2, 'Inventory Staff', 'Science Department', 'Lab experiment', '2024-06-05', '2024-06-20', 'Borrowed', 1, '2024-06-05 09:00:00'),
      (3, 'BRW-2024-003', 2, 'Inventory Staff', 'PE Department', 'Sports event', '2024-06-10', '2024-06-25', 'Approved', 1, '2024-06-10 10:00:00'),
      (4, 'BRW-2024-004', 2, 'Inventory Staff', 'Library', 'Research activity', '2024-06-15', '2024-06-30', 'Pending', NULL, NULL),
      (5, 'BRW-2024-005', 2, 'Inventory Staff', 'Faculty', 'Faculty meeting', '2024-05-20', '2024-06-05', 'Returned', 1, '2024-05-20 14:00:00'),
      (6, 'BRW-2024-006', 2, 'Inventory Staff', 'ICT Department', 'Training session', '2024-05-15', '2024-05-30', 'Returned', 1, '2024-05-15 08:30:00'),
      (7, 'BRW-2024-007', 2, 'Inventory Staff', 'Science Department', 'Chemistry lab', '2024-07-01', '2024-07-15', 'Borrowed', 1, '2024-07-01 09:00:00'),
      (8, 'BRW-2024-008', 2, 'Inventory Staff', 'Office', 'Inventory audit', '2024-07-05', '2024-07-20', 'Rejected', 1, '2024-07-05 11:00:00')
    `);

    // Borrow Items
    await connection.query(`
      INSERT IGNORE INTO borrow_items (id, borrow_transaction_id, inventory_item_id, quantity) VALUES
      (1, 1, 2, 1),
      (2, 2, 6, 2),
      (3, 2, 7, 3),
      (4, 3, 11, 2),
      (5, 4, 9, 5),
      (6, 5, 5, 1),
      (7, 6, 1, 2),
      (8, 7, 8, 4),
      (9, 8, 15, 1)
    `);

    // Return Transactions
    await connection.query(`
      INSERT IGNORE INTO return_transactions (id, transaction_code, borrow_transaction_id, returned_by, return_date, \`condition\`, notes) VALUES
      (1, 'RTN-2024-001', 1, 2, '2024-06-14', 'Good', 'Returned on time'),
      (2, 'RTN-2024-002', 5, 2, '2024-06-04', 'Good', 'No issues'),
      (3, 'RTN-2024-003', 6, 2, '2024-05-28', 'Good', 'All units functional')
    `);

    // Activity Logs
    await connection.query(`
      INSERT IGNORE INTO activity_logs (id, user_id, action, module, description) VALUES
      (1, 1, 'LOGIN', 'Auth', 'Admin logged in'),
      (2, 1, 'CREATE', 'Inventory', 'Added new inventory item ICT-004'),
      (3, 2, 'BORROW', 'Borrow', 'Created borrow request BRW-2024-004'),
      (4, 1, 'APPROVE', 'Borrow', 'Approved borrow request BRW-2024-003'),
      (5, 2, 'RETURN', 'Return', 'Processed return RTN-2024-001'),
      (6, 1, 'UPDATE', 'Inventory', 'Updated stock for OFF-002'),
      (7, 1, 'CREATE', 'Supplier', 'Added supplier TechPro Solutions'),
      (8, 2, 'LOGIN', 'Auth', 'Staff logged in')
    `);

    await connection.commit();
    console.log('Database seeded successfully!');
    console.log('Login credentials:');
    console.log('  Admin: admin / admin123');
    console.log('  Staff: staff / staff123');
  } catch (error) {
    await connection.rollback();
    console.error('Seed failed:', error.message);
    process.exit(1);
  } finally {
    connection.release();
    process.exit(0);
  }
}

seed();
