const LocationModel = require('../models/LocationModel');
const { sendSuccess, sendError } = require('../utils/response');
const { ArchiveBlockedError } = require('../utils/archiveIntegrityService');
const { logActivity, logActivityWithChanges, collectChanges } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');
const { buildGovernanceNotificationMessage } = require('../utils/assetNotificationHelper');

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
      const name = (req.body.name || '').trim();
      if (!name) return sendError(res, 'Location name is required', 400);

      const id = await LocationModel.create({
        name,
        description: req.body.description
      });
      const location = await LocationModel.findById(id);
      await logActivity(req.session.user.id, 'CREATE', 'Location', `Added location ${location.name}`, req.ip, {
        entity_type: 'location',
        entity_id: id,
        reference_code: location.name
      });
      await notifyAdministrators({
        title: 'Location Added',
        message: buildGovernanceNotificationMessage({
          action: 'Location created',
          subject: location.name
        }),
        type: 'location_created',
        reference_id: id,
        link_url: '/pages/manage-locations.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, location, 'Location created successfully', 201);
    } catch (err) {
      if (err.code === 'ER_DUP_ENTRY') return sendError(res, 'Location name already exists', 400);
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const before = await LocationModel.findById(req.params.id);
      if (!before) return sendError(res, 'Location not found', 404);

      const name = (req.body.name || '').trim();
      if (!name) return sendError(res, 'Location name is required', 400);

      const updated = await LocationModel.update(req.params.id, {
        name,
        description: req.body.description
      });
      if (!updated) return sendError(res, 'Location not found', 404);
      const location = await LocationModel.findById(req.params.id);
      await logActivityWithChanges(
        req.session.user.id,
        'UPDATE',
        'Location',
        `Updated location ${location.name}`,
        req.ip,
        'location',
        location.id,
        location.name,
        collectChanges(before, location, ['name', 'description'])
      );
      await notifyAdministrators({
        title: 'Location Updated',
        message: buildGovernanceNotificationMessage({
          action: 'Location updated',
          subject: location.name
        }),
        type: 'location_updated',
        reference_id: location.id,
        link_url: '/pages/manage-locations.html'
      }, { excludeUserIds: [req.session.user.id] });
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
      await logActivity(req.session.user.id, 'ARCHIVE', 'Location', `Archived location ${location.name}`, req.ip, {
        entity_type: 'location',
        entity_id: location.id,
        reference_code: location.name,
        field_name: 'archived',
        old_value: 'false',
        new_value: 'true'
      });
      await notifyAdministrators({
        title: 'Location Archived',
        message: buildGovernanceNotificationMessage({
          action: 'Location archived',
          subject: location.name
        }),
        type: 'location_archived',
        reference_id: location.id,
        link_url: '/pages/archive.html'
      }, { excludeUserIds: [req.session.user.id] });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      if (err instanceof ArchiveBlockedError) return sendError(res, err.message, 400);
      sendError(res, err.message, 500);
    }
  }
};

module.exports = LocationController;
