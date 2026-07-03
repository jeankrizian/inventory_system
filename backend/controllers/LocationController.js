const LocationModel = require('../models/LocationModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');

const LocationController = {
  async getAll(req, res) {
    try {
      const locations = await LocationModel.getAll();
      sendSuccess(res, locations);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const location = await LocationModel.findById(req.params.id);
      if (!location) return sendError(res, 'Location not found', 404);
      sendSuccess(res, location);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const id = await LocationModel.create(req.body);
      await logActivity(req.session.user.id, 'CREATE', 'Location', `Added location ${req.body.name}`, req.ip);
      const location = await LocationModel.findById(id);
      sendSuccess(res, location, 'Location created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Location name already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const updated = await LocationModel.update(req.params.id, req.body);
      if (!updated) return sendError(res, 'Location not found', 404);
      await logActivity(req.session.user.id, 'UPDATE', 'Location', `Updated location ${req.body.name}`, req.ip);
      const location = await LocationModel.findById(req.params.id);
      sendSuccess(res, location, 'Location updated successfully');
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Location name already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const location = await LocationModel.findById(req.params.id);
      if (!location) return sendError(res, 'Location not found', 404);
      const archived = await LocationModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'Location could not be archived', 400);
      await logActivity(req.session.user.id, 'ARCHIVE', 'Location', `Archived location ${location.name}`, req.ip);
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = LocationController;
