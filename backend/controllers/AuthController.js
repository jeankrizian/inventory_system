const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');
const { sendSuccess, sendError } = require('../utils/response');
const { logActivity } = require('../utils/activityLogger');
const { isValidSchoolEmail, normalizeSchoolEmail, isValidUsername, normalizeUsername } = require('../utils/authValidation');
const { buildSessionUser } = require('../utils/roleHelpers');
const { requestPasswordReset } = require('../utils/passwordResetService');

const REGISTRATION_ROLES = ['staff'];
const REGISTRATION_ROLE = 'staff';

const AuthController = {
  async login(req, res) {
    try {
      const { username, password } = req.body;
      const trimmedUsername = (username || '').trim();

      if (!trimmedUsername || !password) {
        return sendError(res, 'Username and password are required', 400);
      }

      const user = await UserModel.findByLogin(trimmedUsername);

      if (!user) {
        return sendError(res, 'Invalid username or password', 401);
      }

      const valid = await bcrypt.compare(password, user.password_hash);
      if (!valid) {
        return sendError(res, 'Invalid username or password', 401);
      }

      await UserModel.updateLastLogin(user.id);

      req.session.user = buildSessionUser(user);

      await logActivity(user.id, 'LOGIN', 'Auth', `${user.full_name} logged in`, req.ip);

      sendSuccess(res, {
        id: user.id,
        username: user.username,
        full_name: user.full_name,
        email: user.email,
        role: user.role_name,
        role_name: user.role_name,
        profile_image: user.profile_image,
        assigned_department_id: user.assigned_department_id ?? null,
        assigned_location_id: user.assigned_location_id ?? null
      }, 'Login successful');
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async logout(req, res) {
    try {
      if (req.session.user) {
        await logActivity(req.session.user.id, 'LOGOUT', 'Auth', `${req.session.user.full_name} logged out`, req.ip);
      }
      req.session.destroy((err) => {
        if (err) return sendError(res, 'Logout failed', 500);
        res.clearCookie('cavite.sid');
        sendSuccess(res, null, 'Logout successful');
      });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async me(req, res) {
    try {
      if (!req.session.user) {
        return sendError(res, 'Not authenticated', 401);
      }
      const user = await UserModel.findById(req.session.user.id);
      if (!user) {
        return sendError(res, 'Not authenticated', 401);
      }
      req.session.user = buildSessionUser(user);
      sendSuccess(res, {
        id: user.id,
        username: user.username,
        email: user.email,
        full_name: user.full_name,
        role: user.role_name,
        role_name: user.role_name,
        profile_image: user.profile_image,
        assigned_department_id: user.assigned_department_id ?? null,
        assigned_location_id: user.assigned_location_id ?? null,
        assigned_department_name: user.assigned_department_name ?? null,
        assigned_location_name: user.assigned_location_name ?? null
      });
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async register(req, res) {
    try {
      const { username, email, password, confirm_password, full_name } = req.body;
      const normalizedEmail = normalizeSchoolEmail(email || '');
      const normalizedUsername = normalizeUsername(username || '');
      const trimmedFullName = (full_name || '').trim();

      if (!trimmedFullName) {
        return sendError(res, 'Full name is required', 400);
      }
      if (!normalizedUsername) {
        return sendError(res, 'Username is required', 400);
      }
      if (!isValidUsername(normalizedUsername)) {
        return sendError(res, 'Username must be 4–30 characters and may only contain letters, numbers, underscores, and periods', 400);
      }
      if (await UserModel.isUsernameTaken(normalizedUsername)) {
        return sendError(res, 'This username is already taken. Please choose another one.', 409);
      }
      if (!isValidSchoolEmail(normalizedEmail)) {
        return sendError(res, 'Only @caviteinstitute.edu.ph email addresses are allowed', 400);
      }
      if (!password || password.length < 8) {
        return sendError(res, 'Password must be at least 8 characters', 400);
      }
      if (password !== confirm_password) {
        return sendError(res, 'Passwords do not match', 400);
      }
      if (await UserModel.isEmailTaken(normalizedEmail)) {
        return sendError(res, 'An account with this email already exists', 409);
      }

      const roleRecord = await UserModel.findRoleByName(REGISTRATION_ROLE);
      if (!roleRecord) {
        return sendError(res, 'Employee registration is not available', 400);
      }

      const passwordHash = await bcrypt.hash(password, 10);
      const userId = await UserModel.create({
        role_id: roleRecord.id,
        username: normalizedUsername,
        email: normalizedEmail,
        password_hash: passwordHash,
        full_name: trimmedFullName
      });

      await logActivity(userId, 'CREATE', 'Auth', `New account registered: ${normalizedUsername}`, req.ip);

      sendSuccess(res, { username: normalizedUsername, email: normalizedEmail }, 'Account created successfully. You may now log in.', 201);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  async forgotPassword(req, res) {
    try {
      const { email } = req.body;
      const normalizedEmail = normalizeSchoolEmail(email || '');

      if (!isValidSchoolEmail(normalizedEmail)) {
        return sendError(res, 'Only @caviteinstitute.edu.ph email addresses are allowed', 400);
      }

      const result = await requestPasswordReset(normalizedEmail);
      if (!result.success) {
        return sendError(res, result.message, result.code === 'not_found' ? 404 : 400);
      }

      sendSuccess(res, null, result.message);
    } catch (err) {
      sendError(res, err.message, 500);
    }
  },

  getRegistrationRoles(req, res) {
    sendSuccess(res, REGISTRATION_ROLES);
  }
};

module.exports = AuthController;
