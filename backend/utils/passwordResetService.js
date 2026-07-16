const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const UserModel = require('../models/UserModel');
const PasswordResetOtpModel = require('../models/PasswordResetOtpModel');
const { normalizeSchoolEmail } = require('./authValidation');
const { sendEmail, isEmailConfigured } = require('./emailService');

const SYSTEM_NAME = 'Cavite Institute Property Management System';
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = parseInt(process.env.OTP_EXPIRY_MINUTES, 10) || 5;
const OTP_MAX_ATTEMPTS = parseInt(process.env.OTP_MAX_ATTEMPTS, 10) || 5;
const OTP_REQUEST_WINDOW_MINUTES = parseInt(process.env.OTP_REQUEST_WINDOW_MINUTES, 10) || 15;
const OTP_MAX_REQUESTS_PER_WINDOW = parseInt(process.env.OTP_MAX_REQUESTS_PER_WINDOW, 10) || 3;
const RESET_SESSION_MINUTES = parseInt(process.env.RESET_SESSION_MINUTES, 10) || 10;

function generateOtp() {
  return crypto.randomInt(0, 10 ** OTP_LENGTH).toString().padStart(OTP_LENGTH, '0');
}

function buildOtpEmailContent(user, otp) {
  const greetingName = user.full_name || user.username || 'User';
  const text = [
    `Hello ${greetingName},`,
    '',
    `You requested a password reset for your ${SYSTEM_NAME} account.`,
    '',
    'Your verification code is:',
    otp,
    '',
    `This code will expire in ${OTP_EXPIRY_MINUTES} minutes.`,
    '',
    'For your security, do not share this OTP with anyone.',
    'If you did not request this password reset, you can safely ignore this email.',
    '',
    `— ${SYSTEM_NAME}`
  ].join('\n');

  const html = `
    <div style="font-family: Arial, Helvetica, sans-serif; color: #1a1a1a; line-height: 1.6; max-width: 560px; margin: 0 auto;">
      <h2 style="margin: 0 0 16px; font-size: 18px; color: #0f3d2e;">${SYSTEM_NAME}</h2>
      <p>Hello ${greetingName},</p>
      <p>You requested a password reset for your account. Use the verification code below to continue:</p>
      <p style="margin: 24px 0; text-align: center;">
        <span style="display: inline-block; font-size: 32px; font-weight: 700; letter-spacing: 8px; padding: 12px 20px; background: #f4f6f5; border-radius: 8px;">
          ${otp}
        </span>
      </p>
      <p>This code will expire in <strong>${OTP_EXPIRY_MINUTES} minutes</strong>.</p>
      <p style="color: #555;">For your security, do not share this OTP with anyone. If you did not request this password reset, you can safely ignore this email.</p>
      <p style="margin-top: 28px; color: #777;">— ${SYSTEM_NAME}</p>
    </div>
  `;

  return { text, html };
}

async function sendOtpEmail(user, otp) {
  if (!isEmailConfigured()) {
    return {
      sent: false,
      code: 'email_not_configured',
      message: 'Email is not configured. Set EMAIL_USER and EMAIL_PASS in backend/.env (Gmail App Password).'
    };
  }

  try {
    const { text, html } = buildOtpEmailContent(user, otp);
    const result = await sendEmail({
      to: user.email,
      subject: `${SYSTEM_NAME} — Password Reset Verification Code`,
      text,
      html
    });
    return { sent: true, ...result };
  } catch (err) {
    return {
      sent: false,
      code: err.code || 'email_failed',
      message: err.message || 'Failed to send verification email.'
    };
  }
}

async function requestPasswordReset(email) {
  const normalizedEmail = normalizeSchoolEmail(email);
  const user = await UserModel.findByEmail(normalizedEmail);

  if (!user) {
    return {
      success: false,
      code: 'not_found',
      message: 'No account is associated with this email address.'
    };
  }

  if (!user.is_active) {
    return {
      success: false,
      code: 'inactive',
      message: 'This account is inactive. Please contact the administrator.'
    };
  }

  const recentRequests = await PasswordResetOtpModel.countRecentRequests(
    user.id,
    OTP_REQUEST_WINDOW_MINUTES
  );
  if (recentRequests >= OTP_MAX_REQUESTS_PER_WINDOW) {
    return {
      success: false,
      code: 'rate_limited',
      message: 'Too many reset requests. Please wait a few minutes before trying again.'
    };
  }

  const otp = generateOtp();
  const otpHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);
  await PasswordResetOtpModel.create(user.id, otpHash, expiresAt);

  const emailResult = await sendOtpEmail(user, otp);
  if (!emailResult.sent) {
    return {
      success: false,
      code: emailResult.code || 'email_failed',
      message: emailResult.message || 'Unable to send verification email.'
    };
  }

  return {
    success: true,
    code: 'otp_sent',
    message: `A verification code has been sent to ${normalizedEmail}. It will expire in ${OTP_EXPIRY_MINUTES} minutes.`
  };
}

async function verifyOtp(email, otp, session) {
  const normalizedEmail = normalizeSchoolEmail(email);
  const user = await UserModel.findByEmail(normalizedEmail);

  if (!user || !user.is_active) {
    return { success: false, code: 'invalid', message: 'Invalid or expired verification code.' };
  }

  const otpRecord = await PasswordResetOtpModel.findLatestActive(user.id);
  if (!otpRecord) {
    return {
      success: false,
      code: 'expired',
      message: 'This verification code has expired. Please request a new one.'
    };
  }

  if (otpRecord.attempts >= OTP_MAX_ATTEMPTS) {
    await PasswordResetOtpModel.markUsed(otpRecord.id);
    return {
      success: false,
      code: 'locked',
      message: 'Too many incorrect attempts. Please request a new verification code.'
    };
  }

  const normalizedOtp = (otp || '').trim();
  if (!/^\d{6}$/.test(normalizedOtp)) {
    await PasswordResetOtpModel.incrementAttempts(otpRecord.id);
    return {
      success: false,
      code: 'invalid',
      message: 'Please enter a valid 6-digit verification code.'
    };
  }

  const isMatch = await bcrypt.compare(normalizedOtp, otpRecord.otp_hash);
  if (!isMatch) {
    await PasswordResetOtpModel.incrementAttempts(otpRecord.id);
    const updated = await PasswordResetOtpModel.findById(otpRecord.id);
    const remaining = Math.max(0, OTP_MAX_ATTEMPTS - updated.attempts);
    if (remaining === 0) {
      await PasswordResetOtpModel.markUsed(otpRecord.id);
      return {
        success: false,
        code: 'locked',
        message: 'Too many incorrect attempts. Please request a new verification code.'
      };
    }
    return {
      success: false,
      code: 'invalid',
      message: `Incorrect verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
    };
  }

  if (session) {
    session.passwordReset = {
      userId: user.id,
      email: normalizedEmail,
      otpId: otpRecord.id,
      verifiedAt: Date.now(),
      expiresAt: Date.now() + RESET_SESSION_MINUTES * 60 * 1000
    };
  }

  return {
    success: true,
    code: 'verified',
    message: 'Verification code accepted. You may now set a new password.'
  };
}

function getVerifiedResetSession(session, email) {
  const normalizedEmail = normalizeSchoolEmail(email || '');
  const resetSession = session?.passwordReset;
  if (!resetSession) return null;
  if (resetSession.email !== normalizedEmail) return null;
  if (Date.now() > resetSession.expiresAt) return null;
  return resetSession;
}

async function resetPassword(email, password, confirmPassword, session) {
  const normalizedEmail = normalizeSchoolEmail(email);
  const resetSession = getVerifiedResetSession(session, normalizedEmail);

  if (!resetSession) {
    return {
      success: false,
      code: 'unverified',
      message: 'Please verify your email with the OTP code before resetting your password.'
    };
  }

  if (!password || password.length < 8) {
    return { success: false, code: 'validation', message: 'Password must be at least 8 characters' };
  }
  if (password !== confirmPassword) {
    return { success: false, code: 'validation', message: 'Passwords do not match' };
  }

  const otpRecord = await PasswordResetOtpModel.findById(resetSession.otpId);
  if (!otpRecord || otpRecord.used_at || new Date(otpRecord.expires_at) <= new Date()) {
    delete session.passwordReset;
    return {
      success: false,
      code: 'expired',
      message: 'This verification code has expired. Please request a new one.'
    };
  }

  const user = await UserModel.findById(resetSession.userId);
  if (!user || !user.is_active || user.email.toLowerCase() !== normalizedEmail) {
    delete session.passwordReset;
    return { success: false, code: 'invalid', message: 'Unable to reset password for this account.' };
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const updated = await UserModel.update(user.id, { password_hash: passwordHash });
  if (!updated) {
    return { success: false, code: 'update_failed', message: 'Unable to update password. Please try again.' };
  }

  await PasswordResetOtpModel.markUsed(otpRecord.id);
  delete session.passwordReset;

  return {
    success: true,
    code: 'reset_complete',
    message: 'Your password has been reset successfully.'
  };
}

function clearPasswordResetSession(session) {
  if (session?.passwordReset) delete session.passwordReset;
}

module.exports = {
  requestPasswordReset,
  verifyOtp,
  resetPassword,
  clearPasswordResetSession
};
