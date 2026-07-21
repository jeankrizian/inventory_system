const DashboardModel = require('../models/DashboardModel');
const { sendSuccess, sendError } = require('../utils/response');
const { getAccessScope, getInventoryAccessScope, getBorrowListScope } = require('../utils/roleHelpers');

function getDashboardScopes(user) {
  return {
    // Assigned assets / inventory cards — match Inventory page (custodian_id)
    inventoryScope: getInventoryAccessScope(user),
    // Pending transfer/maintenance/disposal — keep department operational scope
    operationalScope: getAccessScope(user),
    borrowScope: getBorrowListScope(user),
    user
  };
}

const DashboardController = {
  async getStats(req, res) {
    try {
      const scopes = getDashboardScopes(req.session.user);
      const stats = await DashboardModel.getStats(scopes);
      sendSuccess(res, stats);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getCharts(req, res) {
    try {
      const scopes = getDashboardScopes(req.session.user);
      const charts = await DashboardModel.getCharts(scopes);
      sendSuccess(res, charts);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getTables(req, res) {
    try {
      const scopes = getDashboardScopes(req.session.user);
      const tables = await DashboardModel.getTables(scopes);
      sendSuccess(res, tables);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getAll(req, res) {
    try {
      const scopes = getDashboardScopes(req.session.user);
      const dashboardModules = DashboardModel.getDashboardModules(scopes);
      const [stats, charts, tables] = await Promise.all([
        DashboardModel.getStats(scopes),
        DashboardModel.getCharts(scopes),
        DashboardModel.getTables(scopes)
      ]);
      sendSuccess(res, { stats, charts, tables, dashboardModules });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = DashboardController;
