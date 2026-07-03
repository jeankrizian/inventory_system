/**
 * Placeholder password reset service.
 * Replace sendResetEmail implementation when SMTP is configured.
 */
const UserModel = require('../models/UserModel');
const { normalizeSchoolEmail } = require('./authValidation');

async function sendResetEmail(_user, _token) {
  // TODO: integrate nodemailer or school SMTP when available
  return { sent: false, reason: 'email_not_configured' };
}

async function requestPasswordReset(email) {
  const normalizedEmail = normalizeSchoolEmail(email);
  const user = await UserModel.findByEmail(normalizedEmail);

  if (!user) {
    return { success: false, code: 'not_found', message: 'No account found with this school email address.' };
  }

  if (!user.is_active) {
    return { success: false, code: 'inactive', message: 'This account is inactive. Please contact the administrator.' };
  }

  // Reserved for future token-based reset flow
  await sendResetEmail(user, null);

  return {
    success: true,
    code: 'development',
    message: 'Password reset functionality is currently under development.'
  };
}

module.exports = { requestPasswordReset, sendResetEmail };
