/**
 * Forgot password — Email OTP reset flow
 */
const SCHOOL_EMAIL_DOMAIN = '@caviteinstitute.edu.ph';
let resetEmail = '';

document.addEventListener('DOMContentLoaded', () => {
  redirectIfAuthenticated();
  document.getElementById('forgotPasswordForm').addEventListener('submit', handleForgotPassword);
  document.getElementById('otpVerifyForm').addEventListener('submit', handleVerifyOtp);
  document.getElementById('resetPasswordForm').addEventListener('submit', handleResetPassword);
  document.getElementById('email').addEventListener('input', () => {
    clearFieldError('email');
    hideBanner('forgotError');
  });
  document.getElementById('otp').addEventListener('input', (e) => {
    e.target.value = e.target.value.replace(/\D/g, '').slice(0, 6);
    clearFieldError('otp');
    hideBanner('otpFormError');
  });
  ['newPassword', 'confirmNewPassword'].forEach((id) => {
    document.getElementById(id).addEventListener('input', () => {
      clearFieldError(id);
      hideBanner('resetFormError');
    });
  });
  document.getElementById('backToEmailLink').addEventListener('click', (e) => {
    e.preventDefault();
    resetEmail = '';
    showStep('email');
  });
});

function isValidSchoolEmail(email) {
  const normalized = (email || '').trim().toLowerCase();
  return normalized.endsWith(SCHOOL_EMAIL_DOMAIN) && normalized.length > SCHOOL_EMAIL_DOMAIN.length;
}

function showStep(step) {
  const forms = {
    email: document.getElementById('forgotPasswordForm'),
    otp: document.getElementById('otpVerifyForm'),
    reset: document.getElementById('resetPasswordForm'),
    success: document.getElementById('resetSuccessPanel')
  };
  Object.values(forms).forEach((el) => { el.style.display = 'none'; });
  const titles = {
    email: 'Reset your password',
    otp: 'Enter verification code',
    reset: 'Create a new password',
    success: 'Password reset complete'
  };
  if (step === 'success') forms.success.style.display = 'block';
  else forms[step].style.display = 'block';
  document.getElementById('forgotStepTitle').textContent = titles[step] || titles.email;
}

function hideBanner(id) {
  const el = document.getElementById(id);
  if (el) el.style.display = 'none';
}

function showBanner(id, message) {
  const el = document.getElementById(id);
  if (!el) return;
  el.textContent = message;
  el.style.display = 'block';
}

function clearFieldError(field) {
  const map = {
    email: { errorId: 'emailError', inputId: 'email' },
    otp: { errorId: 'otpError', inputId: 'otp' },
    newPassword: { errorId: 'newPasswordError', inputId: 'newPassword' },
    confirmNewPassword: { errorId: 'confirmNewPasswordError', inputId: 'confirmNewPassword' }
  };
  const config = map[field];
  if (!config) return;
  const errorEl = document.getElementById(config.errorId);
  const inputEl = document.getElementById(config.inputId);
  if (errorEl) errorEl.style.display = 'none';
  inputEl?.classList.remove('input-error');
}

function showFieldError(field, message) {
  const map = {
    email: { errorId: 'emailError', inputId: 'email' },
    otp: { errorId: 'otpError', inputId: 'otp' },
    newPassword: { errorId: 'newPasswordError', inputId: 'newPassword' },
    confirmNewPassword: { errorId: 'confirmNewPasswordError', inputId: 'confirmNewPassword' }
  };
  const config = map[field];
  if (!config) return;
  const errorEl = document.getElementById(config.errorId);
  const inputEl = document.getElementById(config.inputId);
  if (errorEl) {
    errorEl.textContent = message;
    errorEl.style.display = 'block';
  }
  inputEl?.classList.add('input-error');
  inputEl?.focus();
}

function setButtonLoading(btn, loading, defaultHtml) {
  btn.disabled = loading;
  btn.innerHTML = loading
    ? '<span class="spinner-border spinner-border-sm"></span> Please wait...'
    : defaultHtml;
}

async function handleForgotPassword(e) {
  e.preventDefault();
  const email = document.getElementById('email').value.trim();
  const btn = document.getElementById('forgotBtn');
  hideBanner('forgotError');
  hideBanner('forgotSuccess');
  clearFieldError('email');
  if (!email) { showFieldError('email', 'School email is required.'); return; }
  if (!isValidSchoolEmail(email)) {
    showFieldError('email', 'Only @caviteinstitute.edu.ph email addresses are allowed.');
    return;
  }
  setButtonLoading(btn, true, '<i class="bi bi-envelope"></i> Continue');
  try {
    const res = await API.forgotPassword({ email });
    if (res?.success) {
      resetEmail = email.toLowerCase();
      document.getElementById('otp').value = '';
      showStep('otp');
      showBanner('otpFormSuccess', res.message || 'A verification code has been sent to your email.');
      document.getElementById('otp').focus();
      return;
    }
    showBanner('forgotError', res?.message || 'Unable to process request.');
  } catch (err) {
    showBanner('forgotError', err.message || 'Unable to process request.');
  } finally {
    setButtonLoading(btn, false, '<i class="bi bi-envelope"></i> Continue');
  }
}

async function handleVerifyOtp(e) {
  e.preventDefault();
  const otp = document.getElementById('otp').value.trim();
  const btn = document.getElementById('otpBtn');
  hideBanner('otpFormError');
  hideBanner('otpFormSuccess');
  clearFieldError('otp');
  if (!resetEmail) { showStep('email'); return; }
  if (!/^\d{6}$/.test(otp)) {
    showFieldError('otp', 'Please enter a valid 6-digit verification code.');
    return;
  }
  setButtonLoading(btn, true, '<i class="bi bi-shield-check"></i> Verify Code');
  try {
    const res = await API.verifyResetOtp({ email: resetEmail, otp });
    if (res?.success) {
      document.getElementById('newPassword').value = '';
      document.getElementById('confirmNewPassword').value = '';
      showStep('reset');
      document.getElementById('newPassword').focus();
      return;
    }
    showBanner('otpFormError', res?.message || 'Unable to verify code.');
  } catch (err) {
    showBanner('otpFormError', err.message || 'Unable to verify code.');
  } finally {
    setButtonLoading(btn, false, '<i class="bi bi-shield-check"></i> Verify Code');
  }
}

async function handleResetPassword(e) {
  e.preventDefault();
  const password = document.getElementById('newPassword').value;
  const confirmPassword = document.getElementById('confirmNewPassword').value;
  const btn = document.getElementById('resetBtn');
  hideBanner('resetFormError');
  clearFieldError('newPassword');
  clearFieldError('confirmNewPassword');
  if (!resetEmail) { showStep('email'); return; }
  if (!password) { showFieldError('newPassword', 'New password is required.'); return; }
  if (password.length < 8) {
    showFieldError('newPassword', 'Password must be at least 8 characters.');
    return;
  }
  if (!confirmPassword) {
    showFieldError('confirmNewPassword', 'Please confirm your new password.');
    return;
  }
  if (password !== confirmPassword) {
    showFieldError('confirmNewPassword', 'Passwords do not match.');
    return;
  }
  setButtonLoading(btn, true, '<i class="bi bi-key"></i> Reset Password');
  try {
    const res = await API.resetPassword({
      email: resetEmail,
      password,
      confirm_password: confirmPassword
    });
    if (res?.success) {
      resetEmail = '';
      showStep('success');
      return;
    }
    showBanner('resetFormError', res?.message || 'Unable to reset password.');
  } catch (err) {
    showBanner('resetFormError', err.message || 'Unable to reset password.');
  } finally {
    setButtonLoading(btn, false, '<i class="bi bi-key"></i> Reset Password');
  }
}
