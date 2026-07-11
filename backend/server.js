const express = require('express');
const session = require('express-session');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const pool = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const supplierRoutes = require('./routes/supplierRoutes');
const locationRoutes = require('./routes/locationRoutes');
const borrowRoutes = require('./routes/borrowRoutes');
const reportRoutes = require('./routes/reportRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const transferRoutes = require('./routes/transferRoutes');
const disposalRoutes = require('./routes/disposalRoutes');
const maintenanceRoutes = require('./routes/maintenanceRoutes');
const componentRoutes = require('./routes/componentRoutes');
const departmentRoutes = require('./routes/departmentRoutes');
const { runSopMigration } = require('./database/runSopMigration');
const { runArchiveMigration } = require('./database/runArchiveMigration');
const { runMaintenanceTransferMigration } = require('./database/runMaintenanceTransferMigration');
const { runAuthMigration } = require('./database/runAuthMigration');
const { runClassificationMigration } = require('./database/runClassificationMigration');
const { runUserArchiveMigration } = require('./database/runUserArchiveMigration');
const { runDocumentMigration } = require('./database/runDocumentMigration');
const { runPurchaseMigration } = require('./database/runPurchaseMigration');
const { runExtendedDocumentMigration } = require('./database/runExtendedDocumentMigration');
const { runDocumentNumberMigration } = require('./database/runDocumentNumberMigration');
const { runRbacAssignmentMigration } = require('./database/runRbacAssignmentMigration');
const { runItemDescriptionMigration } = require('./database/runItemDescriptionMigration');
const { runMaterialMigration } = require('./database/runMaterialMigration');
const { runCustodianRoleMigration } = require('./database/runCustodianRoleMigration');
const { runCustodianTypeMigration } = require('./database/runCustodianTypeMigration');
const { runStaffRoleRemovalMigration } = require('./database/runStaffRoleRemovalMigration');
const { runBackupMigration } = require('./database/runBackupMigration');
const { runIndividualAssetMigration } = require('./database/runIndividualAssetMigration');
const { runPropertyBasedInventoryMigration } = require('./database/runPropertyBasedInventoryMigration');
const { runBatchIdMigration } = require('./database/runBatchIdMigration');
const { runStatusAutomationMigration } = require('./database/runStatusAutomationMigration');
const { runRemoveQuantityFieldsMigration } = require('./database/runRemoveQuantityFieldsMigration');
const { runSerialNumberMigration } = require('./database/runSerialNumberMigration');
const { runSerialNumberUniqueMigration } = require('./database/runSerialNumberUniqueMigration');
const { runPerformanceIndexesMigration } = require('./database/runPerformanceIndexesMigration');
const { runLegacyDataMigration } = require('./database/runLegacyDataMigration');
const { runBorrowUxMigration } = require('./database/runBorrowUxMigration');
const { runActivityLogMigration } = require('./database/runActivityLogMigration');
const { runConditionOptionsMigration } = require('./database/runConditionOptionsMigration');
const { runPurchaseDateRemovalMigration } = require('./database/runPurchaseDateRemovalMigration');
const archiveRoutes = require('./routes/archiveRoutes');
const userRoutes = require('./routes/userRoutes');
const documentRoutes = require('./routes/documentRoutes');
const backupRoutes = require('./routes/backupRoutes');
const BackupController = require('./controllers/BackupController');
const { requireManageBackups } = require('./middleware/auth');
const { startArchiveCleanupScheduler } = require('./utils/archiveCleanup');
const { requireAuth } = require('./middleware/auth');
const {
  getAccessScope,
  getBorrowListScope,
  canViewInventory,
  canManageSuppliers
} = require('./utils/roleHelpers');

const app = express();
const PORT = process.env.PORT || 3000;
const frontendPath = path.join(__dirname, '../frontend');

// Block direct access to public registration page before static file serving
app.get('/register.html', (req, res) => {
  res.redirect('/');
});

// Middleware
app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

// Session
app.use(session({
  name: 'cavite.sid',
  secret: process.env.SESSION_SECRET || 'cavite_inventory_secret',
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    maxAge: 24 * 60 * 60 * 1000
  }
}));

// Serve frontend static files with caching for assets
app.use(express.static(frontendPath, {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
  index: false
}));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/borrow', borrowRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/transfers', transferRoutes);
app.use('/api/disposals', disposalRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/components', componentRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/archive', archiveRoutes);
app.use('/api/users', userRoutes);
app.use('/api/documents', documentRoutes);
app.post(
  '/api/backups/restore-upload',
  requireAuth,
  express.json({ limit: '50mb' }),
  requireManageBackups,
  BackupController.restoreUpload
);
app.use('/api/backups', backupRoutes);

// Global search endpoint
app.get('/api/search', requireAuth, async (req, res) => {
  try {
    const InventoryModel = require('./models/InventoryModel');
    const SupplierModel = require('./models/SupplierModel');
    const BorrowModel = require('./models/BorrowModel');
    const q = (req.query.q || '').trim();
    const role = req.session.user?.role;
    const borrowScope = getBorrowListScope(req.session.user);

    if (!q) {
      return res.json({ success: true, data: { inventory: [], suppliers: [], orders: [] } });
    }

    const inventoryScope = getAccessScope(req.session.user);
    const inventoryPromise = canViewInventory(role)
      ? InventoryModel.getAll({ search: q, limit: 10, scope: inventoryScope })
      : Promise.resolve([]);
    const suppliersPromise = canManageSuppliers(role)
      ? SupplierModel.search(q, 5)
      : Promise.resolve([]);
    const borrowFilters = { search: q, limit: 5 };
    if (borrowScope.type === 'own') {
      borrowFilters.borrower_id = borrowScope.userId;
    } else if (borrowScope.type !== 'all' && borrowScope.type !== 'none') {
      borrowFilters.scope = borrowScope;
    }
    const ordersPromise = borrowScope.type === 'none'
      ? Promise.resolve([])
      : BorrowModel.getAll(borrowFilters);

    const [inventory, suppliers, orders] = await Promise.all([
      inventoryPromise,
      suppliersPromise,
      ordersPromise
    ]);

    res.json({ success: true, data: { inventory, suppliers, orders } });
  } catch (err) {
    console.error('Search error:', err.message);
    res.status(500).json({ success: false, message: 'Search failed' });
  }
});

// Health check with database status
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT 1');
    res.json({ success: true, message: 'API and database are running' });
  } catch (err) {
    res.status(503).json({ success: false, message: 'Database connection failed', error: err.message });
  }
});

// HTML page routes — explicit routes for reliability
const pages = [
  'dashboard', 'inventory', 'reports', 'suppliers',
  'orders', 'maintenance-requests', 'transfer-requests', 'disposal-requests',
  'manage-departments', 'manage-locations', 'manage-users',
  'manage-store', 'settings', 'archive', 'documents', 'document-preview'
];

pages.forEach(page => {
  app.get(`/pages/${page}.html`, (req, res) => {
    res.sendFile(path.join(frontendPath, 'pages', `${page}.html`));
  });
});

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/index.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.get('/forgot-password.html', (req, res) => {
  res.sendFile(path.join(frontendPath, 'forgot-password.html'));
});

// 404 for unknown API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ success: false, message: 'API endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.message);
  if (res.headersSent) return next(err);
  res.status(500).json({ success: false, message: 'Internal server error' });
});

/** Silence migration chatter on startup unless MIGRATION_VERBOSE=1 */
async function runStartupMigrationsQuietly(fn) {
  if (process.env.MIGRATION_VERBOSE === '1') {
    await fn();
    return;
  }
  const original = {
    log: console.log,
    info: console.info,
    warn: console.warn
  };
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  try {
    await fn();
  } finally {
    console.log = original.log;
    console.info = original.info;
    console.warn = original.warn;
  }
}

async function startServer() {
  try {
    await pool.testConnection();
    console.log('MySQL database connected successfully');
    await runStartupMigrationsQuietly(async () => {
      await runSopMigration();
      await runArchiveMigration();
      await runMaintenanceTransferMigration();
      await runAuthMigration();
      await runClassificationMigration();
      await runUserArchiveMigration();
      await runDocumentMigration();
      await runPurchaseMigration();
      await runExtendedDocumentMigration();
      await runDocumentNumberMigration();
      await runRbacAssignmentMigration();
      await runItemDescriptionMigration();
      await runMaterialMigration();
      await runCustodianRoleMigration();
      await runCustodianTypeMigration();
      await runStaffRoleRemovalMigration();
      await runBackupMigration();
      await runIndividualAssetMigration();
      await runPropertyBasedInventoryMigration();
      await runBatchIdMigration();
      await runStatusAutomationMigration();
      await runRemoveQuantityFieldsMigration();
      await runSerialNumberMigration();
      await runSerialNumberUniqueMigration();
      await runPerformanceIndexesMigration();
      await runLegacyDataMigration();
      await runBorrowUxMigration();
      await runActivityLogMigration();
      await runConditionOptionsMigration();
      await runPurchaseDateRemovalMigration();
    });
    startArchiveCleanupScheduler();
  } catch (err) {
    console.error('WARNING: Database connection failed:', err.message);
    console.error('Check your .env file and ensure MySQL is running.');
  }

  app.listen(PORT, () => {
    console.log(`Cavite Institute Property Management System running on http://localhost:${PORT}`);
  });
}

startServer();

module.exports = app;
