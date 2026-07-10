const BackupModel = require('../models/BackupModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const {
  generateDatabaseSql,
  restoreDatabaseSql,
  buildBackupFileName,
  writeBackupFile,
  readBackupFile,
  deleteBackupFile,
  validateBackupSql,
  resolveBackupPath
} = require('../utils/backupService');

const BackupController = {
  async list(req, res) {
    try {
      const backups = await BackupModel.getAll();
      sendSuccess(res, backups);
    } catch (err) {
      sendError(res, 'Unable to load backup history.', err.statusCode || 500);
    }
  },

  async create(req, res) {
    try {
      const sql = await generateDatabaseSql();
      const fileName = buildBackupFileName();
      writeBackupFile(fileName, sql);
      const fileSize = Buffer.byteLength(sql, 'utf8');
      const backup = await BackupModel.create({
        fileName,
        fileSize,
        createdBy: req.session.user.id
      });

      await logActivity(
        req.session.user.id,
        'BACKUP_CREATE',
        'Backup',
        `Database backup created: ${fileName}`,
        req.ip
      );

      sendSuccess(res, backup, 'Backup created successfully.');
    } catch (err) {
      sendError(res, 'Unable to create backup.', err.statusCode || 500);
    }
  },

  async download(req, res) {
    try {
      const backup = await BackupModel.findById(req.params.id);
      if (!backup) {
        return sendError(res, 'Backup not found.', 404);
      }

      const filePath = resolveBackupPath(backup.file_name);
      res.download(filePath, backup.file_name);
    } catch (err) {
      sendError(res, 'Unable to download backup.', err.statusCode || 500);
    }
  },

  async remove(req, res) {
    try {
      const backup = await BackupModel.findById(req.params.id);
      if (!backup) {
        return sendError(res, 'Backup not found.', 404);
      }

      deleteBackupFile(backup.file_name);
      await BackupModel.delete(backup.id);

      await logActivity(
        req.session.user.id,
        'BACKUP_DELETE',
        'Backup',
        `Database backup deleted: ${backup.file_name}`,
        req.ip
      );

      sendSuccess(res, null, 'Backup deleted successfully.');
    } catch (err) {
      sendError(res, 'Unable to delete backup.', err.statusCode || 500);
    }
  },

  async restoreById(req, res) {
    try {
      const backup = await BackupModel.findById(req.params.id);
      if (!backup) {
        return sendError(res, 'Backup not found.', 404);
      }

      const sql = readBackupFile(backup.file_name);
      await restoreDatabaseSql(sql);

      await logActivity(
        req.session.user.id,
        'BACKUP_RESTORE',
        'Backup',
        `Database restored from backup: ${backup.file_name}`,
        req.ip
      );

      sendSuccess(res, null, 'Database restored successfully.');
    } catch (err) {
      const message = err.statusCode === 400 ? err.message : 'Unable to restore backup.';
      sendError(res, message, err.statusCode || 500);
    }
  },

  async restoreUpload(req, res) {
    try {
      const { content } = req.body || {};
      const validationError = validateBackupSql(content);
      if (validationError) {
        return sendError(res, validationError, 400);
      }

      await restoreDatabaseSql(content);

      await logActivity(
        req.session.user.id,
        'BACKUP_RESTORE',
        'Backup',
        'Database restored from uploaded backup file',
        req.ip
      );

      sendSuccess(res, null, 'Database restored successfully.');
    } catch (err) {
      const message = err.statusCode === 400 ? err.message : 'Unable to restore backup.';
      sendError(res, message, err.statusCode || 500);
    }
  }
};

module.exports = BackupController;
