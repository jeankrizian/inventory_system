const NotificationModel = require('../models/NotificationModel');
const { checkDueDateReminders, checkMaintenanceReminders } = require('../utils/notificationService');
const { sendSuccess, sendError } = require('../utils/response');

const NotificationController = {
  async getAll(req, res) {
    try {
      const userId = req.session.user.id;
      await checkDueDateReminders(userId);
      await checkMaintenanceReminders(userId);
      const notifications = await NotificationModel.getByUser(userId);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      sendSuccess(res, { notifications, unreadCount });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getUnreadCount(req, res) {
    try {
      const userId = req.session.user.id;
      await checkDueDateReminders(userId);
      await checkMaintenanceReminders(userId);
      const count = await NotificationModel.getUnreadCount(userId);
      sendSuccess(res, { count });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async markAsRead(req, res) {
    try {
      const userId = req.session.user.id;
      const updated = await NotificationModel.markAsRead(req.params.id, userId);
      if (!updated) return sendError(res, 'Notification not found', 404);
      const unreadCount = await NotificationModel.getUnreadCount(userId);
      sendSuccess(res, { unreadCount }, 'Notification marked as read');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async markAllAsRead(req, res) {
    try {
      const userId = req.session.user.id;
      await NotificationModel.markAllAsRead(userId);
      sendSuccess(res, { unreadCount: 0 }, 'All notifications marked as read');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = NotificationController;
