/**
 * Login page logic
 */
document.addEventListener('DOMContentLoaded', () => {
  showPendingAuthExpiredToast();
  redirectIfAuthenticated();

  const form = document.getElementById('loginForm');
  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  form.addEventListener('submit', handleLogin);

  // Clear error when user starts typing
  [usernameInput, passwordInput].forEach(input => {
    input.addEventListener('input', () => {
      errorEl.style.display = 'none';
      input.classList.remove('input-error');
    });
  });

  async function handleLogin(e) {
    e.preventDefault();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    errorEl.style.display = 'none';
    usernameInput.classList.remove('input-error');
    passwordInput.classList.remove('input-error');

    if (!username) {
      showLoginError('Please enter your username.', usernameInput);
      return;
    }
    if (!password) {
      showLoginError('Please enter your password.', passwordInput);
      return;
    }

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Signing in...';

    try {
      const res = await API.login(username, password);
      if (res?.success) {
        cachedUser = res.data;
        window.location.href = '/pages/dashboard.html';
        return;
      }
      showLoginError('Invalid username or password.');
    } catch (err) {
      showLoginError(err.message || 'Login failed. Please try again.');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right"></i> Sign In';
    }
  }

  function showLoginError(message, focusInput) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
    if (focusInput) {
      focusInput.classList.add('input-error');
      focusInput.focus();
    }
  }
});
