/**
 * Registration page logic — public registration is disabled.
 */
const SCHOOL_EMAIL_DOMAIN = '@caviteinstitute.edu.ph';
const USERNAME_PATTERN = /^[a-zA-Z0-9_.]{4,30}$/;

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();

  const form = document.getElementById('registerForm');

  form.addEventListener('submit', handleRegister);

  ['fullName', 'username', 'email', 'password', 'confirmPassword'].forEach(id => {
    document.getElementById(id)?.addEventListener('input', () => clearFieldError(id));
    document.getElementById(id)?.addEventListener('change', () => clearFieldError(id));
  });
});

function isValidSchoolEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  return normalized.endsWith(SCHOOL_EMAIL_DOMAIN) && normalized.length > SCHOOL_EMAIL_DOMAIN.length;
}

function isValidUsername(username) {
  const trimmed = (username || '').trim();
  if (!trimmed || trimmed.includes(' ')) return false;
  return USERNAME_PATTERN.test(trimmed);
}

function showFieldError(fieldId, message) {
  const map = {
    fullName: 'fullNameError',
    username: 'usernameError',
    email: 'emailError',
    password: 'passwordError',
    confirmPassword: 'confirmPasswordError'
  };
  const errorEl = document.getElementById(map[fieldId]);
  const inputEl = document.getElementById(fieldId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = message ? 'block' : 'none';
  }
  inputEl?.classList.toggle('input-error', !!message);
}

function clearFieldError(fieldId) {
  showFieldError(fieldId, '');
  document.getElementById('registerError').style.display = 'none';
}

function validateForm() {
  let valid = true;
  const fullName = document.getElementById('fullName').value.trim();
  const username = document.getElementById('username').value.trim();
  const email = document.getElementById('email').value.trim();
  const password = document.getElementById('password').value;
  const confirmPassword = document.getElementById('confirmPassword').value;

  if (!fullName) {
    showFieldError('fullName', 'Full name is required.');
    valid = false;
  } else {
    showFieldError('fullName', '');
  }

  if (!username) {
    showFieldError('username', 'Username is required.');
    valid = false;
  } else if (username.includes(' ')) {
    showFieldError('username', 'Username cannot contain spaces.');
    valid = false;
  } else if (username.length < 4 || username.length > 30) {
    showFieldError('username', 'Username must be between 4 and 30 characters.');
    valid = false;
  } else if (!USERNAME_PATTERN.test(username)) {
    showFieldError('username', 'Username may only contain letters, numbers, underscores, and periods.');
    valid = false;
  } else {
    showFieldError('username', '');
  }

  if (!email) {
    showFieldError('email', 'Email address is required.');
    valid = false;
  } else if (!isValidSchoolEmail(email)) {
    showFieldError('email', 'Only @caviteinstitute.edu.ph email addresses are allowed.');
    valid = false;
  } else {
    showFieldError('email', '');
  }

  if (!password) {
    showFieldError('password', 'Password is required.');
    valid = false;
  } else if (password.length < 8) {
    showFieldError('password', 'Password must be at least 8 characters.');
    valid = false;
  } else {
    showFieldError('password', '');
  }

  if (!confirmPassword) {
    showFieldError('confirmPassword', 'Please confirm your password.');
    valid = false;
  } else if (password !== confirmPassword) {
    showFieldError('confirmPassword', 'Passwords do not match.');
    valid = false;
  } else {
    showFieldError('confirmPassword', '');
  }

  return valid;
}

async function handleRegister(e) {
  e.preventDefault();

  const form = document.getElementById('registerForm');
  const errorEl = document.getElementById('registerError');
  const successEl = document.getElementById('registerSuccess');
  const btn = document.getElementById('registerBtn');

  errorEl.style.display = 'none';
  successEl.style.display = 'none';

  if (!validateForm()) return;

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Creating account...';

  try {
    const res = await API.register({
      full_name: document.getElementById('fullName').value.trim(),
      username: document.getElementById('username').value.trim(),
      email: document.getElementById('email').value.trim(),
      password: document.getElementById('password').value,
      confirm_password: document.getElementById('confirmPassword').value
    });

    if (res?.success) {
      successEl.textContent = res.message || 'Account created successfully. You may now log in.';
      successEl.style.display = 'block';
      form.reset();
      setTimeout(() => {
        window.location.href = '/index.html';
      }, 1800);
      return;
    }

    errorEl.textContent = res?.message || 'Registration failed. Please try again.';
    errorEl.style.display = 'block';
  } catch (err) {
    const message = err.message || 'Registration failed. Please try again.';
    if (message.includes('username') && message.toLowerCase().includes('taken')) {
      showFieldError('username', 'This username is already taken. Please choose another one.');
    } else if (message.toLowerCase().includes('email') && message.toLowerCase().includes('exists')) {
      showFieldError('email', message);
    }
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-person-plus"></i> Create Account';
  }
}
