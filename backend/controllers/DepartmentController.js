const DepartmentModel = require('../models/DepartmentModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');

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
      await logActivity(req.session.user.id, 'CREATE', 'Department', `Added department ${req.body.name}`, req.ip);
      const department = await DepartmentModel.findById(id);
      await notifyAdministrators({
        title: 'Department Added',
        message: `Department ${department.name} was created.`,
        type: 'department_created',
        reference_id: id,
        link_url: '/pages/manage-departments.html'
      });
      sendSuccess(res, department, 'Department created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Department name or code already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const updated = await DepartmentModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Department not found', 404);
      await logActivity(req.session.user.id, 'UPDATE', 'Department', `Updated department ${req.body.name}`, req.ip);
      const department = await DepartmentModel.findById(req.params.id);
      await notifyAdministrators({
        title: 'Department Updated',
        message: `Department ${department.name} was updated.`,
        type: 'department_updated',
        reference_id: department.id,
        link_url: '/pages/manage-departments.html'
      });
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
      await logActivity(req.session.user.id, 'ARCHIVE', 'Department', `Archived department ${department.name}`, req.ip);
      await notifyAdministrators({
        title: 'Department Archived',
        message: `Department ${department.name} was archived.`,
        type: 'department_archived',
        reference_id: department.id,
        link_url: '/pages/archive.html'
      });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = DepartmentController;
