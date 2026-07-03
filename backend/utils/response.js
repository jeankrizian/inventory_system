/**
 * Standard API response helpers
 */
const sendSuccess = (res, data, message = 'Success', statusCode = 200) => {
  res.status(statusCode).json({ success: true, message, data });
};

const sendError = (res, message = 'An error occurred', statusCode = 500, errors = null) => {
  res.status(statusCode).json({ success: false, message, errors });
};

module.exports = { sendSuccess, sendError };
