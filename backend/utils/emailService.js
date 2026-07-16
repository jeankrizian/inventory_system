const path = require('path');
const nodemailer = require('nodemailer');

// Ensure backend/.env is loaded even if process was started from another folder
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

/**
 * Gmail SMTP email service (Nodemailer).
 * Env: EMAIL_HOST, EMAIL_PORT, EMAIL_SECURE, EMAIL_USER, EMAIL_PASS, EMAIL_FROM
 */

function getEmailConfig() {
  const host = (process.env.EMAIL_HOST || 'smtp.gmail.com').trim();
  const user = (process.env.EMAIL_USER || '').trim();
  // App Passwords are often copied with spaces — strip them
  const pass = (process.env.EMAIL_PASS || '').replace(/\s+/g, '').trim();
  const port = parseInt(process.env.EMAIL_PORT, 10) || 587;
  const secure = String(process.env.EMAIL_SECURE || 'false').toLowerCase() === 'true' || port === 465;
  let from = (process.env.EMAIL_FROM || '').trim();
  // Strip wrapping quotes if present
  if ((from.startsWith('"') && from.endsWith('"')) || (from.startsWith("'") && from.endsWith("'"))) {
    from = from.slice(1, -1).trim();
  }
  if (!from && user) {
    from = `"Cavite Institute Property Management System" <${user}>`;
  }
  return { host, port, secure, user, pass, from };
}

function isEmailConfigured() {
  const { host, user, pass } = getEmailConfig();
  return Boolean(host && user && pass);
}

function createTransporter() {
  const { host, port, secure, user, pass } = getEmailConfig();
  if (!host || !user || !pass) {
    const err = new Error(
      'Email is not configured. Set EMAIL_HOST, EMAIL_USER, and EMAIL_PASS in backend/.env.'
    );
    err.code = 'EMAIL_NOT_CONFIGURED';
    throw err;
  }

  // Standard Gmail SMTP (STARTTLS on 587). Do not mix service:'gmail' with custom host.
  return nodemailer.createTransport({
    host,
    port,
    secure,
    requireTLS: !secure && port === 587,
    auth: {
      user,
      pass
    },
    tls: {
      minVersion: 'TLSv1.2'
    }
  });
}

async function sendEmail({ to, subject, text, html }) {
  const { from, user, host, port } = getEmailConfig();
  const transporter = createTransporter();

  console.log('[email] config loaded:', {
    host,
    port,
    user,
    from,
    passConfigured: true
  });

  try {
    const verified = await transporter.verify();
    console.log('[email] transporter.verify() OK:', verified);
  } catch (err) {
    console.error('[email] transporter.verify() FAILED:', {
      message: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode,
      command: err.command
    });
    const verifyErr = new Error(
      `SMTP connection failed: ${err.response || err.message}`
    );
    verifyErr.code = err.code || 'SMTP_VERIFY_FAILED';
    throw verifyErr;
  }

  try {
    const info = await transporter.sendMail({
      from,
      to,
      subject,
      text,
      html
    });

    console.log('[email] sendMail() full response:', {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      envelope: info.envelope,
      messageId: info.messageId
    });

    return {
      sent: true,
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
      envelope: info.envelope
    };
  } catch (err) {
    console.error('[email] sendMail() FAILED:', {
      message: err.message,
      code: err.code,
      response: err.response,
      responseCode: err.responseCode
    });
    const sendErr = new Error(`Failed to send email: ${err.response || err.message}`);
    sendErr.code = err.code || 'SMTP_SEND_FAILED';
    throw sendErr;
  }
}

module.exports = {
  getEmailConfig,
  isEmailConfigured,
  createTransporter,
  sendEmail
};
