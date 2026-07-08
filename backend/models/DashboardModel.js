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
  isPropertyManager,
  isCustodian
} = require('../utils/roleHelpers');

const EMPTY_INVENTORY_STATS = {
  total_items: 0,
  available_items: 0,
  borrowed_items: 0,
  low_stock: 0,
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
      transferStats: false,
      maintenanceStats: false,
      disposalStats: false,
      charts: true,
      recentInventory: true,
      lowStock: true,
      assetsNeedingAttention: false,
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
      transferStats: true,
      maintenanceStats: true,
      disposalStats: true,
      charts: true,
      recentInventory: true,
      lowStock: true,
      assetsNeedingAttention: false,
      recentBorrows: true,
      recentReturns: true,
      activities: true
    };
  }

  return {
    personalBorrowStats: false,
    inventoryStats: true,
    usersStats: false,
    pendingApprovals: false,
    transferStats: true,
    maintenanceStats: true,
    disposalStats: true,
    charts: false,
    recentInventory: true,
    lowStock: true,
    assetsNeedingAttention: true,
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

const BORROW_ACTIVITY_MATCH = `
  EXISTS (
    SELECT 1 FROM borrow_transactions bt
    WHERE al.description LIKE CONCAT('%', bt.transaction_code, '%')
      AND (
        bt.borrower_id = ?
        OR EXISTS (
          SELECT 1 FROM borrow_items bi
          JOIN inventory_items i ON bi.inventory_item_id = i.id
          WHERE bi.borrow_transaction_id = bt.id
            AND (
              (? IS NOT NULL AND i.department_id = ?)
              OR (? IS NOT NULL AND i.location_id = ?)
            )
        )
      )
  )
  OR EXISTS (
    SELECT 1 FROM return_transactions rt
    JOIN borrow_transactions bt ON rt.borrow_transaction_id = bt.id
    WHERE al.description LIKE CONCAT('%', rt.transaction_code, '%')
      AND (
        bt.borrower_id = ?
        OR EXISTS (
          SELECT 1 FROM borrow_items bi
          JOIN inventory_items i ON bi.inventory_item_id = i.id
          WHERE bi.borrow_transaction_id = bt.id
            AND (
              (? IS NOT NULL AND i.department_id = ?)
              OR (? IS NOT NULL AND i.location_id = ?)
            )
        )
      )
  )`;

function buildActivityQuery(ctx) {
  const baseSelect = `SELECT al.*, u.full_name AS user_name FROM activity_logs al
    LEFT JOIN users u ON al.user_id = u.id`;

  if (ctx.fullVisibility) {
    return {
      sql: `${baseSelect} ORDER BY al.created_at DESC LIMIT 8`,
      params: []
    };
  }

  if (isCustodian(ctx.role)) {
    const departmentId = ctx.inventoryScope?.departmentId ?? null;
    const locationId = ctx.inventoryScope?.locationId ?? null;
    return {
      sql: `${baseSelect}
        WHERE al.user_id = ?
           OR (
             al.module IN ('Borrow', 'Process Return')
             AND ${BORROW_ACTIVITY_MATCH}
           )
        ORDER BY al.created_at DESC LIMIT 8`,
      params: [
        ctx.userId,
        ctx.userId,
        departmentId, departmentId,
        locationId, locationId,
        ctx.userId,
        departmentId, departmentId,
        locationId, locationId
      ]
    };
  }

  return {
    sql: `${baseSelect} WHERE al.user_id = ? ORDER BY al.created_at DESC LIMIT 8`,
    params: [ctx.userId]
  };
}

const EMPTY_CHARTS = {
  monthlyBorrowed: [],
  monthlyReturned: [],
  departmentDistribution: [],
  categoryDistribution: []
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
      returnCount,
      pendingBorrows,
      pendingTransfers,
      pendingDisposals,
      maintenanceDue,
      pendingMaintenance,
      ongoingMaintenance,
      scheduledMaintenance,
      approvedTransfers,
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
      ctx.modules.recentReturns ? ReturnModel.countTotal(borrowScope) : Promise.resolve(0),
      ctx.modules.pendingApprovals || ctx.modules.personalBorrowStats
        ? BorrowModel.countPending(borrowScope) : Promise.resolve(0),
      ctx.modules.transferStats ? TransferModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.showDisposalStats ? DisposalModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.assetsNeedingAttention || ctx.modules.maintenanceStats
        ? MaintenanceModel.countDue(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countPending(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countOngoing(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.maintenanceStats ? MaintenanceModel.countScheduled(ctx.operationalScope) : Promise.resolve(0),
      ctx.modules.transferStats ? TransferModel.countApproved(ctx.operationalScope) : Promise.resolve(0),
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
      low_stock: Number(inventoryStats.low_stock ?? 0),
      under_maintenance: Number(inventoryStats.under_maintenance ?? 0),
      disposed: Number(inventoryStats.disposed ?? 0),
      suppliers: Number(supplierCount ?? 0),
      departments: Number(departmentCount ?? 0),
      categories: Number(departmentCount ?? 0),
      total_users: Number(totalUsers ?? 0),
      active_users: Number(activeUsers ?? 0),
      returned_items: Number(returnCount ?? 0),
      pending_requests: Number(pendingBorrows ?? 0) + Number(pendingTransfers ?? 0) + Number(pendingDisposals ?? 0) + Number(pendingMaintenance ?? 0),
      pending_borrows: Number(pendingBorrows ?? 0),
      pending_transfers: Number(pendingTransfers ?? 0),
      pending_disposals: Number(pendingDisposals ?? 0),
      pending_maintenance: Number(pendingMaintenance ?? 0),
      ongoing_maintenance: Number(ongoingMaintenance ?? 0),
      scheduled_maintenance: Number(scheduledMaintenance ?? 0),
      approved_transfers: Number(approvedTransfers ?? 0),
      maintenance_due: Number(maintenanceDue ?? 0),
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

    const [monthlyBorrowed, monthlyReturned, departmentDistribution] = await Promise.all([
      BorrowModel.getMonthlyBorrowed(ctx.borrowScope),
      ReturnModel.getMonthlyReturned(ctx.borrowScope),
      InventoryModel.getDepartmentDistribution(ctx.inventoryScope)
    ]);

    const safeDepartmentDistribution = Array.isArray(departmentDistribution) ? departmentDistribution : [];

    return {
      monthlyBorrowed: Array.isArray(monthlyBorrowed) ? monthlyBorrowed : [],
      monthlyReturned: Array.isArray(monthlyReturned) ? monthlyReturned : [],
      departmentDistribution: safeDepartmentDistribution,
      categoryDistribution: safeDepartmentDistribution.map(d => ({
        category: d.category,
        department: d.department,
        count: Number(d.count ?? 0)
      }))
    };
  },

  async getTables(scopes = {}) {
    const ctx = resolveScopes(scopes);
    const { sql: activitySql, params: activityParams } = buildActivityQuery(ctx);

    const [recentInventory, lowStock, recentBorrows, recentReturns, recentActivities] = await Promise.all([
      ctx.modules.recentInventory ? InventoryModel.getRecent(5, ctx.inventoryScope) : Promise.resolve([]),
      ctx.modules.lowStock || ctx.modules.assetsNeedingAttention
        ? InventoryModel.getLowStock(5, ctx.inventoryScope) : Promise.resolve([]),
      ctx.modules.recentBorrows ? BorrowModel.getRecent(5, ctx.borrowScope) : Promise.resolve([]),
      ctx.modules.recentReturns ? ReturnModel.getRecent(5, ctx.borrowScope) : Promise.resolve([]),
      ctx.modules.activities
        ? pool.query(activitySql, activityParams).then(([rows]) => rows || [])
        : Promise.resolve([])
    ]);

    return {
      recentInventory: Array.isArray(recentInventory) ? recentInventory : [],
      lowStock: Array.isArray(lowStock) ? lowStock : [],
      recentBorrows: Array.isArray(recentBorrows) ? recentBorrows : [],
      recentReturns: Array.isArray(recentReturns) ? recentReturns : [],
      recentActivities: Array.isArray(recentActivities) ? recentActivities : []
    };
  }
};

module.exports = DashboardModel;
