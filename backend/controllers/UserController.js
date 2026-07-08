const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');
const CategoryModel = require('../models/CategoryModel');
const LocationModel = require('../models/LocationModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { notifyAdministrators } = require('../utils/notificationService');
const { isValidSchoolEmail, normalizeSchoolEmail, isValidUsername, normalizeUsername } = require('../utils/authValidation');
const {
  isCustodian,
  normalizeRoleName
} = require('../utils/roleHelpers');

function parseAssignmentId(value) {
  if (value === '' || value === undefined || value === null) return null;
  const parsed = parseInt(value, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

function resolveRoleAssignments(roleName, body) {
  const normalized = normalizeRoleName(roleName);
  const updates = {
    assigned_department_id: null,
    assigned_location_id: null
  };

  if (isCustodian(normalized)) {
    updates.assigned_department_id = parseAssignmentId(body.assigned_department_id);
    updates.assigned_location_id = parseAssignmentId(body.assigned_location_id);
  }

  return updates;
}

function computeEffectiveAssignments(user, role, body) {
  const effectiveRole = role !== undefined ? role : user.role_name;
  const assignments = {
    assigned_department_id: user.assigned_department_id ?? null,
    assigned_location_id: user.assigned_location_id ?? null
  };

  if (role !== undefined) {
    Object.assign(assignments, resolveRoleAssignments(role, body));
  } else {
    if (body.assigned_department_id !== undefined) {
      assignments.assigned_department_id = parseAssignmentId(body.assigned_department_id);
    }
    if (body.assigned_location_id !== undefined) {
      assignments.assigned_location_id = parseAssignmentId(body.assigned_location_id);
    }
  }

  return { effectiveRole, assignments };
}

async function validateCustodianAssignments(roleName, assignments) {
  const normalized = normalizeRoleName(roleName);

  if (!isCustodian(normalized)) {
    return null;
  }

  const hasDepartment = assignments.assigned_department_id != null;
  const hasLocation = assignments.assigned_location_id != null;

  if (isCustodian(normalized)) {
    if (hasDepartment === hasLocation) {
      return 'Custodian requires either an assigned department or an assigned laboratory, but not both.';
    }
    if (hasDepartment) {
      const dept = await CategoryModel.findById(assignments.assigned_department_id);
      if (!dept) return 'Selected department does not exist.';
      return null;
    }
    const loc = await LocationModel.findById(assignments.assigned_location_id);
    if (!loc) return 'Selected laboratory does not exist.';
    return null;
  }

  return null;
}

const UserController = {
  async getRoles(req, res) {
    try {
      const roles = await UserModel.getAllRoles();
      const legacyCustodianRoles = new Set(['Department Custodian', 'Laboratory Custodian']);
      const hasUnifiedCustodian = roles.some((role) => role.name === 'Custodian');
      const filteredRoles = hasUnifiedCustodian
        ? roles.filter((role) => !legacyCustodianRoles.has(role.name))
        : roles;
      sendSuccess(res, filteredRoles);
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

      const assignmentUpdates = resolveRoleAssignments(role, req.body);
      const assignmentError = await validateCustodianAssignments(role, assignmentUpdates);
      if (assignmentError) return sendError(res, assignmentError, 400);

      const passwordHash = await bcrypt.hash(password, 10);
      const id = await UserModel.create({
        role_id: roleRecord.id,
        username: normalizedUsername,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: full_name.trim()
      });

      await UserModel.update(id, assignmentUpdates);

      if (is_active === false || is_active === 0 || is_active === 'Inactive') {
        await UserModel.update(id, { is_active: 0 });
      }

      await logActivity(req.session.user.id, 'CREATE', 'User', `Added user ${normalizedUsername}`, req.ip);
      const user = await UserModel.findById(id);
      await notifyAdministrators({
        title: 'User Created',
        message: `User account ${user.full_name} (${user.username}) was created.`,
        type: 'user_created',
        reference_id: id,
        link_url: '/pages/manage-users.html'
      });
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
        Object.assign(updates, resolveRoleAssignments(role, req.body));
      } else if (req.body.assigned_department_id !== undefined || req.body.assigned_location_id !== undefined) {
        Object.assign(updates, resolveRoleAssignments(user.role_name, req.body));
      }
      if (is_active !== undefined) {
        updates.is_active = is_active === true || is_active === 1 || is_active === 'Active';
      }
      if (password) {
        if (password.length < 8) return sendError(res, 'Password must be at least 8 characters', 400);
        updates.password_hash = await bcrypt.hash(password, 10);
      }

      const { effectiveRole, assignments } = computeEffectiveAssignments(user, role, req.body);
      const assignmentError = await validateCustodianAssignments(effectiveRole, assignments);
      if (assignmentError) return sendError(res, assignmentError, 400);

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
      await notifyAdministrators({
        title: 'User Archived',
        message: `User account ${user.full_name} (${user.username}) was archived.`,
        type: 'user_archived',
        reference_id: user.id,
        link_url: '/pages/archive.html'
      });
      sendSuccess(res, null, 'The record has been archived successfully. It will remain in the Archive for 30 days before being permanently deleted.');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  }
};

module.exports = UserController;
