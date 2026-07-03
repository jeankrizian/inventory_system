const SCHOOL_EMAIL_DOMAIN = '@caviteinstitute.edu.ph';

function isValidSchoolEmail(email) {
  if (!email || typeof email !== 'string') return false;
  const normalized = email.trim().toLowerCase();
  return normalized.endsWith(SCHOOL_EMAIL_DOMAIN) && normalized.length > SCHOOL_EMAIL_DOMAIN.length;
}

function normalizeSchoolEmail(email) {
  return email.trim().toLowerCase();
}

const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{4,30}$/;

function isValidUsername(username) {
  if (!username || typeof username !== 'string') return false;
  const trimmed = username.trim();
  if (trimmed.includes(' ')) return false;
  return USERNAME_PATTERN.test(trimmed);
}

function normalizeUsername(username) {
  return (username || '').trim();
}

module.exports = {
  SCHOOL_EMAIL_DOMAIN,
  isValidSchoolEmail,
  normalizeSchoolEmail,
  USERNAME_PATTERN,
  isValidUsername,
  normalizeUsername
};
