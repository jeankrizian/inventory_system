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



const DashboardModel = {

  async getStats() {

    const inventoryStats = await InventoryModel.getStats();

    const [supplierCount, departmentCount, totalUsers, activeUsers, returnCount, pendingBorrows, pendingTransfers, pendingDisposals, maintenanceDue, pendingMaintenance, ongoingMaintenance, scheduledMaintenance, approvedTransfers] = await Promise.all([

      SupplierModel.count(),

      DepartmentModel.count(),

      UserModel.countTotal(),

      UserModel.countActive(),

      ReturnModel.countTotal(),

      BorrowModel.countPending(),

      TransferModel.countPending(),

      DisposalModel.countPending(),

      MaintenanceModel.countDue(),

      MaintenanceModel.countPending(),

      MaintenanceModel.countOngoing(),

      MaintenanceModel.countScheduled(),

      TransferModel.countApproved()

    ]);



    const stats = {

      ...inventoryStats,

      total_items: Number(inventoryStats.total_items),

      available_items: Number(inventoryStats.available_items),

      borrowed_items: Number(inventoryStats.borrowed_items),

      low_stock: Number(inventoryStats.low_stock),

      under_maintenance: Number(inventoryStats.under_maintenance || 0),

      disposed: Number(inventoryStats.disposed || 0),

      suppliers: supplierCount,

      departments: departmentCount,

      categories: departmentCount,

      total_users: totalUsers,

      active_users: activeUsers,

      returned_items: returnCount,

      pending_requests: Number(pendingBorrows) + Number(pendingTransfers) + Number(pendingDisposals) + Number(pendingMaintenance),

      pending_borrows: Number(pendingBorrows),

      pending_transfers: Number(pendingTransfers),

      pending_maintenance: Number(pendingMaintenance),

      ongoing_maintenance: Number(ongoingMaintenance),

      scheduled_maintenance: Number(scheduledMaintenance),

      approved_transfers: Number(approvedTransfers),

      maintenance_due: Number(maintenanceDue)

    };

    return stats;

  },



  async getCharts() {

    const [monthlyBorrowed, monthlyReturned, departmentDistribution] = await Promise.all([

      BorrowModel.getMonthlyBorrowed(),

      ReturnModel.getMonthlyReturned(),

      InventoryModel.getDepartmentDistribution()

    ]);

    return {

      monthlyBorrowed,

      monthlyReturned,

      departmentDistribution,

      categoryDistribution: departmentDistribution.map(d => ({

        category: d.department,

        department: d.department,

        count: d.count

      }))

    };

  },



  async getTables() {

    const [recentInventory, lowStock, recentBorrows, recentReturns, recentActivities] = await Promise.all([

      InventoryModel.getRecent(5),

      InventoryModel.getLowStock(5),

      BorrowModel.getRecent(5),

      ReturnModel.getRecent(5),

      pool.query(

        `SELECT al.*, u.full_name AS user_name FROM activity_logs al

         LEFT JOIN users u ON al.user_id = u.id

         ORDER BY al.created_at DESC LIMIT 8`

      ).then(([rows]) => rows)

    ]);

    return { recentInventory, lowStock, recentBorrows, recentReturns, recentActivities };

  }

};



module.exports = DashboardModel;

