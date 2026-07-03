const { sendError } = require('../utils/response');
const { isAdminRole } = require('../utils/roleHelpers');

/** Require authenticated session */
const requireAuth = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return sendError(res, 'Authentication required', 401);
  }
  next();
};

/** Require admin role */
const requireAdmin = (req, res, next) => {
  if (!req.session || !req.session.user) {
    return sendError(res, 'Authentication required', 401);
  }
  if (!isAdminRole(req.session.user.role)) {
    return sendError(res, 'Admin access required', 403);
  }
  next();
};

/** Handle express-validator errors */
const validate = (req, res, next) => {
  const { validationResult } = require('express-validator');
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 'Validation failed', 400, errors.array());
  }
  next();
};

module.exports = { requireAuth, requireAdmin, validate };
