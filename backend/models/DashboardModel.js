const pool = require('../config/database');
const InventoryModel = require('./InventoryModel');
const DepartmentModel = require('./DepartmentModel');
const SupplierModel = require('./SupplierModel');
const BorrowModel = require('./BorrowModel');
const ReturnModel = require('./ReturnModel');
const UserModel = require('./UserModel');
const TransferModel = require('./TransferModel');
const DisposalModel = require('./DisposalModel');
const MaintenanceModel = require('./MaintenanceModel');
const {
  isAdministrator,
  isPropertyManager
} = require('../utils/roleHelpers');

const EMPTY_INVENTORY_STATS = {
  total_items: 0,
  available_items: 0,
  borrowed_items: 0,
  under_maintenance: 0,
  disposed: 0
};

function buildDashboardModules(role) {
  const admin = isAdministrator(role);
  const pm = isPropertyManager(role);

  if (admin) {
    return {
      personalBorrowStats: false,
      inventoryStats: true,
      usersStats: true,
      pendingApprovals: false,
      pendingWorkflow: false,
      transferStats: false,
      maintenanceStats: false,
      disposalStats: false,
      charts: true,
      recentInventory: false,
      recentBorrows: false,
      recentReturns: false,
      activities: true
    };
  }

  if (pm) {
    return {
      personalBorrowStats: false,
      inventoryStats: true,
      usersStats: false,
      pendingApprovals: true,
      pendingWorkflow: false,
      transferStats: true,
      maintenanceStats: true,
      disposalStats: true,
      charts: true,
      recentInventory: false,
      recentBorrows: false,
      recentReturns: false,
      activities: true
    };
  }

  return {
    personalBorrowStats: false,
    inventoryStats: true,
    usersStats: false,
    pendingApprovals: false,
    pendingWorkflow: true,
    transferStats: true,
    maintenanceStats: true,
    disposalStats: true,
    charts: false,
    recentInventory: false,
    recentBorrows: false,
    recentReturns: false,
    activities: true
  };
}

function resolveScopes(scopes = {}) {
  const role = scopes.user?.role || scopes.user?.role_name;
  const userId = scopes.user?.id ?? null;
  const fullVisibility = isAdministrator(role) || isPropertyManager(role);
  const modules = buildDashboardModules(role);

  let inventoryScope;
  let borrowScope;
  let operationalScope;

  if (fullVisibility) {
    inventoryScope = { type: 'all' };
    borrowScope = { type: 'all' };
    operationalScope = { type: 'all' };
  } else {
    inventoryScope = scopes.inventoryScope ?? { type: 'none', userId };
    borrowScope = scopes.borrowScope ?? { type: 'none', userId };
    operationalScope = scopes.inventoryScope ?? { type: 'none', userId };
  }

  return {
    role,
    userId,
    fullVisibility,
    modules,
    showUserStats: modules.usersStats,
    showDisposalStats: modules.disposalStats,
    inventoryScope,
    borrowScope,
    operationalScope
  };
}

const AUTH_SESSION_EXCLUSION = `
  UPPER(al.action) NOT IN ('LOGIN', 'LOGOUT')
  AND LOWER(IFNULL(al.module, '')) <> 'auth'
  AND UPPER(al.action) NOT LIKE '%LOGIN%'
  AND UPPER(al.action) NOT LIKE '%LOGOUT%'
  AND UPPER(al.action) NOT LIKE '%AUTH%'`;

/**
 * Recent Operations: Admin sees all users; Property Manager and Custodian
 * see only activity performed by their own logged-in user_id.
 */
function buildActivityQuery(ctx) {
  const baseSelect = `SELECT al.*, u.full_name AS user_name FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id`;

  if (isAdministrator(ctx.role)) {
    return {
      sql: `${baseSelect} WHERE ${AUTH_SESSION_EXCLUSION} ORDER BY al.created_at DESC LIMIT 8`,
      params: []
    };
  }

  return {
    sql: `${baseSelect} WHERE al.user_id = ? AND (${AUTH_SESSION_EXCLUSION}) ORDER BY al.created_at DESC LIMIT 8`,
    params: [ctx.userId]
  };
}

const EMPTY_CHARTS = {
  monthlyBorrowed: [],
  monthlyReturned: [],
  departmentDistribution: [],
  categoryDistribution: [],
  monthlyDepartmentCosts: []
};

const DashboardModel = {
  getDashboardModules(scopes = {}) {
    const ctx = resolveScopes(scopes);
    return ctx.modules;
  },

  async getStats(scopes = {}) {
    const ctx = resolveScopes(scopes);
    const inventoryStats = ctx.modules.inventoryStats
      ? await InventoryModel.getStats(ctx.inventoryScope)
      : { ...EMPTY_INVENTORY_STATS };

    const borrowScope = ctx.borrowScope;

    const [
      supplierCount,
      departmentCount,
      totalUsers,
      activeUsers,
      pendingBorrows,
      pendingTransfers,
      pendingDisposals,
      pendingMaintenance,
      ongoingMaintenance,
      scheduledMaintenance,
      currentBorrowed,
      approvedBorrows,
      overdueBorrows,
      dueSoonBorrows,
      totalBorrowRequests
    ] = await Promise.all([
      ctx.fullVisibility ? SupplierModel.count() : Promise.resolve(0),
      ctx.fullVisibility ? DepartmentModel.count() : Promise.resolve(0),
      ctx.showUserStats ? UserModel.countTotal() : Promise.resolve(0),
      ctx.showUserStats ? UserModel.countActive() : Promise.resolve(0),
      ctx.modules.pendingApprovals || ctx.modules.pendingWorkflow || ctx.modules.personalBorrowStats
        ? BorrowModel.countPending(borrowScope) : Promise.resolve(0),
      ctx.modules.transferStats ? TransferModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.showDisposalStats ? DisposalModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countOngoing(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countScheduled(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.personalBorrowStats ? BorrowModel.countCurrentBorrowed(borrowScope) : Promise.resolve(0),
      ctx.modules.personalBorrowStats ? BorrowModel.countByStatus(borrowScope, 'Approved') : Promise.resolve(0),
      ctx.modules.personalBorrowStats ? BorrowModel.countOverdue(borrowScope) : Promise.resolve(0),
      ctx.modules.personalBorrowStats ? BorrowModel.countDueSoon(borrowScope) : Promise.resolve(0),
      ctx.modules.personalBorrowStats ? BorrowModel.countTotal(borrowScope) : Promise.resolve(0)
    ]);

    const stats = {
      ...inventoryStats,
      total_items: Number(inventoryStats.total_items ?? 0),
      available_items: Number(inventoryStats.available_items ?? 0),
      borrowed_items: Number(inventoryStats.borrowed_items ?? 0),
      under_maintenance: Number(inventoryStats.under_maintenance ?? 0),
      disposed: Number(inventoryStats.disposed ?? 0),
      suppliers: Number(supplierCount ?? 0),
      departments: Number(departmentCount ?? 0),
      total_users: Number(totalUsers ?? 0),
      active_users: Number(activeUsers ?? 0),
      pending_borrows: Number(pendingBorrows ?? 0),
      pending_transfers: Number(pendingTransfers ?? 0),
      pending_disposals: Number(pendingDisposals ?? 0),
      pending_maintenance: Number(pendingMaintenance ?? 0),
      ongoing_maintenance: Number(ongoingMaintenance ?? 0),
      scheduled_maintenance: Number(scheduledMaintenance ?? 0),
      current_borrowed: Number(currentBorrowed ?? 0),
      approved_borrows: Number(approvedBorrows ?? 0),
      overdue_borrows: Number(overdueBorrows ?? 0),
      due_soon_borrows: Number(dueSoonBorrows ?? 0),
      total_borrow_requests: Number(totalBorrowRequests ?? 0)
    };

    return stats;
  },

  async getCharts(scopes = {}) {
    const ctx = resolveScopes(scopes);
    if (!ctx.modules.charts) {
      return { ...EMPTY_CHARTS };
    }

    const includeDepartmentCosts = isAdministrator(ctx.role) || isPropertyManager(ctx.role);

    const [monthlyBorrowed, monthlyReturned, departmentDistribution, monthlyDepartmentCosts] = await Promise.all([
      BorrowModel.getMonthlyBorrowed(ctx.borrowScope),
      ReturnModel.getMonthlyReturned(ctx.borrowScope),
      InventoryModel.getDepartmentDistribution(ctx.inventoryScope),
      includeDepartmentCosts
        ? InventoryModel.getMonthlyDepartmentCosts(ctx.inventoryScope)
        : Promise.resolve([])
    ]);

    const safeDepartmentDistribution = Array.isArray(departmentDistribution) ? departmentDistribution : [];

    return {
      monthlyBorrowed: Array.isArray(monthlyBorrowed) ? monthlyBorrowed : [],
      monthlyReturned: Array.isArray(monthlyReturned) ? monthlyReturned : [],
      departmentDistribution: safeDepartmentDistribution,
      categoryDistribution: safeDepartmentDistribution,
      monthlyDepartmentCosts: Array.isArray(monthlyDepartmentCosts) ? monthlyDepartmentCosts : []
    };
  },

  async getTables(scopes = {}) {
    const ctx = resolveScopes(scopes);
    const { sql: activitySql, params: activityParams } = buildActivityQuery(ctx);

    const recentActivities = ctx.modules.activities
      ? await pool.query(activitySql, activityParams).then(([rows]) => rows || [])
      : [];

    return {
      recentInventory: [],
      recentBorrows: [],
      recentReturns: [],
      recentActivities: Array.isArray(recentActivities) ? recentActivities : []
    };
  }
};

module.exports = DashboardModel;
