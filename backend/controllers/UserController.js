const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { isValidSchoolEmail, normalizeSchoolEmail, isValidUsername, normalizeUsername } = require('../utils/authValidation');

const UserController = {
  async getRoles(req, res) {
    try {
      const roles = await UserModel.getAllRoles();
      sendSuccess(res, roles);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getActive(req, res) {
    try {
      const users = await UserModel.getActiveList();
      sendSuccess(res, users);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getAll(req, res) {
    try {
      const users = await UserModel.getAll({
        search: req.query.search,
        status: req.query.status,
        role: req.query.role
      });
      sendSuccess(res, users);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async getById(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return sendError(res, 'User not found', 404);
      sendSuccess(res, user);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async create(req, res) {
    try {
      const { full_name, username, email, role, password, is_active } = req.body;
      const normalizedUsername = normalizeUsername(username || '');
      const normalizedEmail = normalizeSchoolEmail(email || '');

      if (!full_name?.trim()) return sendError(res, 'Full name is required', 400);
      if (!normalizedUsername) return sendError(res, 'Username is required', 400);
      if (!isValidUsername(normalizedUsername)) {
        return sendError(res, 'Username must be 4–30 characters and may only contain letters, numbers, underscores, and periods', 400);
      }
      if (!normalizedEmail) return sendError(res, 'Email is required', 400);
      if (!isValidSchoolEmail(normalizedEmail)) {
        return sendError(res, 'Only @caviteinstitute.edu.ph email addresses are allowed', 400);
      }
      if (!role) return sendError(res, 'Role is required', 400);
      if (!password || password.length < 8) {
        return sendError(res, 'Password must be at least 8 characters', 400);
      }
      if (await UserModel.isUsernameTaken(normalizedUsername)) {
        return sendError(res, 'This username is already taken', 409);
      }
      if (await UserModel.isEmailTaken(normalizedEmail)) {
        return sendError(res, 'An account with this email already exists', 409);
      }

      const roleRecord = await UserModel.findRoleByName(role);
      if (!roleRecord) return sendError(res, 'Selected role is not available', 400);

      const passwordHash = await bcrypt.hash(password, 10);
      const id = await UserModel.create({
        role_id: roleRecord.id,
        username: normalizedUsername,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: full_name.trim()
      });

      if (is_active === false || is_active === 0 || is_active === 'Inactive') {
        await UserModel.update(id, { is_active: 0 });
      }

      await logActivity(req.session.user.id, 'CREATE', 'User', `Added user ${normalizedUsername}`, req.ip);
      const user = await UserModel.findById(id);
      sendSuccess(res, user, 'User created successfully', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async update(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return sendError(res, 'User not found', 404);

      const { full_name, username, email, role, password, is_active } = req.body;
      const updates = {};

      if (full_name !== undefined) updates.full_name = full_name.trim();
      if (username !== undefined) {
        const normalizedUsername = normalizeUsername(username);
        if (!isValidUsername(normalizedUsername)) {
          return sendError(res, 'Username must be 4–30 characters and may only contain letters, numbers, underscores, and periods', 400);
        }
        if (normalizedUsername.toLowerCase() !== user.username.toLowerCase()
          && await UserModel.isUsernameTaken(normalizedUsername)) {
          return sendError(res, 'This username is already taken', 409);
        }
        updates.username = normalizedUsername;
      }
      if (email !== undefined) {
        const normalizedEmail = normalizeSchoolEmail(email);
        if (normalizedEmail.toLowerCase() !== user.email.toLowerCase()) {
          if (!isValidSchoolEmail(normalizedEmail)) {
            return sendError(res, 'Only @caviteinstitute.edu.ph email addresses are allowed', 400);
          }
          if (await UserModel.isEmailTaken(normalizedEmail)) {
            return sendError(res, 'An account with this email already exists', 409);
          }
        }
        updates.email = normalizedEmail;
      }
      if (role !== undefined) {
        const roleRecord = await UserModel.findRoleByName(role);
        if (!roleRecord) return sendError(res, 'Selected role is not available', 400);
        updates.role_id = roleRecord.id;
      }
      if (is_active !== undefined) {
        updates.is_active = is_active === true || is_active === 1 || is_active === 'Active';
      }
      if (password) {
        if (password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);
        updates.password_hash = await bcrypt.hash(password, 10);
      }

      const updated = await UserModel.update(req.params.id, updates);
      if (!updated && !Object.keys(updates).length) {
        return sendError(res, 'No changes to save', 400);
      }

      await logActivity(req.session.user.id, 'UPDATE', 'User', `Updated user ${user.username}`, req.ip);
      const record = await UserModel.findById(req.params.id);
      sendSuccess(res, record, 'User updated successfully');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async remove(req, res) {
    try {
      const user = await UserModel.findById(req.params.id);
      if (!user) return sendError(res, 'User not found', 404);
      if (parseInt(req.params.id, 10) === req.session.user.id) {
        return sendError(res, 'You cannot archive your own account', 400);
      }

      const archived = await UserModel.archive(req.params.id, req.session.user.id);
      if (!archived) return sendError(res, 'User could not be archived', 400);

      await logActivity(req.session.user.id, 'ARCHIVE', 'User', `Archived user ${user.username}`, req.ip);
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = UserController;
