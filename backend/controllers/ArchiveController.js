const ArchiveModel = require('../models/ArchiveModel');
const { restoreRecord, getModuleConfig } = require('../utils/archiveService');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');

const ArchiveController = {
  async getAll(req, res) {
    try {
      const data = await ArchiveModel.getAll({
        search: req.query.search,
        module: req.query.module,
        page: req.query.page,
        pageSize: req.query.pageSize
      });
      sendSuccess(res, data);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async restore(req, res) {
    try {
      const { module, id } = req.params;
      const cfg = getModuleConfig(module);
      if (!cfg) return sendError(res, 'Invalid module', 400);

      const restored = await restoreRecord(cfg.table, id);
      if (!restored) return sendError(res, 'Archived record not found', 404);

      await logActivity(req.session.user.id, 'RESTORE', cfg.module, `Restored ${cfg.module} record #${id}`, req.ip);
      sendSuccess(res, null, 'The record has been restored successfully.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = ArchiveController;
