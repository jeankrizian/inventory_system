const DepartmentModel = require('../models/DepartmentModel');
const { sendSuccess, sendError } = require('../utils/response');
const { ArchiveBlockedError } = require('../utils/archiveIntegrityService');
const { logActivity, logActivityWithChanges, collectChanges } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');
const { buildGovernanceNotificationMessage } = require('../utils/assetNotificationHelper');

const DepartmentController = {
  async getAll(req, res) {
    try {
      const departments = await DepartmentModel.getAll({
        search: req.query.search,
        active_only: req.query.active_only === 'true'
      });
      sendSuccess(res, departments);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const department = await DepartmentModel.findById(req.params.id);
      if (!department) return sendError(res, 'Department not found', 404);
      sendSuccess(res, department);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const id = await DepartmentModel.create(req.body);
      const department = await DepartmentModel.findById(id);
      await logActivity(req.session.user.id, 'CREATE', 'Department', `Added department ${req.body.name}`, req.ip, {
        entity_type: 'department',
        entity_id: id,
        reference_code: department.code || department.name
      });
      await notifyAdministrators({
        title: 'Department Added',
        message: buildGovernanceNotificationMessage({
          action: 'Department created',
          subject: department.name
        }),
        type: 'department_created',
        reference_id: id,
        link_url: '/pages/manage-departments.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, department, 'Department created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Department name or code already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const before = await DepartmentModel.findById(req.params.id);
      if (!before) return sendError(res, 'Department not found', 404);

      const updated = await DepartmentModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Department not found', 404);
      const department = await DepartmentModel.findById(req.params.id);
      await logActivityWithChanges(
        req.session.user.id,
        'UPDATE',
        'Department',
        `Updated department ${department.name}`,
        req.ip,
        'department',
        department.id,
        department.code || department.name,
        collectChanges(before, department, ['name', 'code', 'status', 'custodian_id'])
      );
      await notifyAdministrators({
        title: 'Department Updated',
        message: buildGovernanceNotificationMessage({
          action: 'Department updated',
          subject: department.name
        }),
        type: 'department_updated',
        reference_id: department.id,
        link_url: '/pages/manage-departments.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, department, 'Department updated successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Department name or code already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const department = await DepartmentModel.findById(req.params.id);
      if (!department) return sendError(res, 'Department not found', 404);
      const archived = await DepartmentModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Department could not be archived', 400);
      await logActivity(req.session.user.id, 'ARCHIVE', 'Department', `Archived department ${department.name}`, req.ip, {
        entity_type: 'department',
        entity_id: department.id,
        reference_code: department.code || department.name,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true'
      });
      await notifyAdministrators({
        title: 'Department Archived',
        message: buildGovernanceNotificationMessage({
          action: 'Department archived',
          subject: department.name
        }),
        type: 'department_archived',
        reference_id: department.id,
        link_url: '/pages/archive.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      if (err instanceof ArchiveBlockedError) return sendError(res, err.message, 400);
      sendError(res, err.message, 500);
    }
  }
};

module.exports = DepartmentController;
