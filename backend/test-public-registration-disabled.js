const fs = require('fs');
const path = require('path');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const indexHtml = fs.readFileSync(
  path.join(__dirname, '../frontend/index.html'),
  'utf8'
);
const authSrc = fs.readFileSync(
  path.join(__dirname, 'controllers/AuthController.js'),
  'utf8'
);
const serverSrc = fs.readFileSync(path.join(__dirname, 'server.js'), 'utf8');

assert(!indexHtml.includes('Create Account'), 'Login page should not link to Create Account');
assert(!indexHtml.includes('/register.html'), 'Login page should not link to register.html');
assert(indexHtml.includes('Forgot Password?'), 'Forgot password link preserved');
assert(authSrc.includes('PUBLIC_REGISTRATION_DISABLED = true'), 'Public registration disabled flag');
assert(authSrc.includes('Public registration is disabled'), 'Register endpoint blocked message');
assert(serverSrc.includes("res.redirect('/')"), 'register.html redirects to login');

console.log('Public registration disabled unit tests OK');
