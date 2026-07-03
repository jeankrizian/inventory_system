/**
 * Forgot password page logic
 */
const SCHOOL_EMAIL_DOMAIN = '@caviteinstitute.edu.ph';

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();

  const form = document.getElementById('forgotPasswordForm');
  const emailInput = document.getElementById('email');

  form.addEventListener('submit', handleForgotPassword);
  emailInput.addEventListener('input', () => {
    document.getElementById('emailError').style.display = 'none';
    document.getElementById('forgotError').style.display = 'none';
    emailInput.classList.remove('input-error');
  });
});

function isValidSchoolEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  return normalized.endsWith(SCHOOL_EMAIL_DOMAIN) && normalized.length > SCHOOL_EMAIL_DOMAIN.length;
}

async function handleForgotPassword(e) {
  e.preventDefault();

  const emailInput = document.getElementById('email');
  const email = emailInput.value.trim();
  const emailError = document.getElementById('emailError');
  const errorEl = document.getElementById('forgotError');
  const successEl = document.getElementById('forgotSuccess');
  const btn = document.getElementById('forgotBtn');

  errorEl.style.display = 'none';
  successEl.style.display = 'none';
  emailError.style.display = 'none';
  emailInput.classList.remove('input-error');

  if (!email) {
    emailError.textContent = 'School email is required.';
    emailError.style.display = 'block';
    emailInput.classList.add('input-error');
    emailInput.focus();
    return;
  }

  if (!isValidSchoolEmail(email)) {
    emailError.textContent = 'Only @caviteinstitute.edu.ph email addresses are allowed.';
    emailError.style.display = 'block';
    emailInput.classList.add('input-error');
    emailInput.focus();
    return;
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm"></span> Verifying...';

  try {
    const res = await API.forgotPassword({ email });
    if (res?.success) {
      successEl.textContent = res.message || 'Password reset functionality is currently under development.';
      successEl.style.display = 'block';
      form.reset();
      return;
    }
    errorEl.textContent = res?.message || 'Unable to process request.';
    errorEl.style.display = 'block';
  } catch (err) {
    errorEl.textContent = err.message || 'Unable to process request.';
    errorEl.style.display = 'block';
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-envelope"></i> Continue';
  }
}
