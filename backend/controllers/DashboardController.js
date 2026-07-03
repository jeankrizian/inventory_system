const DashboardModel = require('../models/DashboardModel');
const { sendSuccess, sendError } = require('../utils/response');

const DashboardController = {
  async getStats(req, res) {
    try {
      const stats = await DashboardModel.getStats();
      sendSuccess(res, stats);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getCharts(req, res) {
    try {
      const charts = await DashboardModel.getCharts();
      sendSuccess(res, charts);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getTables(req, res) {
    try {
      const tables = await DashboardModel.getTables();
      sendSuccess(res, tables);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getAll(req, res) {
    try {
      const [stats, charts, tables] = await Promise.all([
        DashboardModel.getStats(),
        DashboardModel.getCharts(),
        DashboardModel.getTables()
      ]);
      sendSuccess(res, { stats, charts, tables });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = DashboardController;
