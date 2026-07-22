/**
 * Prevents double-clicks and duplicate API requests on async actions.
 */

function preserveButtonWidth(button) {
  if (!button) return;
  const width = button.offsetWidth;
  if (width > 0) button.style.minWidth = `${width}px`;
}

function setButtonLoading(button, loadingText) {
  if (!button) return;
  preserveButtonWidth(button);
  if (!button.dataset.submitGuardOriginal) {
    button.dataset.submitGuardOriginal = button.innerHTML;
  }
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  button.innerHTML = loadingText;
}

function restoreButton(button) {
  if (!button) return;
  button.disabled = false;
  button.removeAttribute('aria-busy');
  if (button.dataset.submitGuardOriginal) {
    button.innerHTML = button.dataset.submitGuardOriginal;
    delete button.dataset.submitGuardOriginal;
  }
}

async function withSubmitGuard(button, asyncFn, options = {}) {
  const { loadingText = 'Processing...' } = options;
  if (!button) return guardAsyncAction(asyncFn, { loadingText });

  if (button.disabled || button.dataset.submitGuardActive === 'true') return;

  button.dataset.submitGuardActive = 'true';
  setButtonLoading(button, loadingText);
  try {
    return await asyncFn();
  } finally {
    delete button.dataset.submitGuardActive;
    restoreButton(button);
  }
}

const guardLocks = new Map();

/** Clear a named async-action lock (e.g. after modal reset so Validate cannot stay stuck). */
function clearGuardLock(lockKey) {
  if (!lockKey) return;
  guardLocks.delete(lockKey);
}

function isGuardLocked(lockKey) {
  if (!lockKey) return false;
  return guardLocks.get(lockKey) === true;
}

async function guardAsyncAction(asyncFn, options = {}) {
  const { button, loadingText = 'Processing...', lockKey } = options;
  if (button) return withSubmitGuard(button, asyncFn, { loadingText });

  const key = lockKey || 'global';
  if (guardLocks.get(key)) {
    return { skipped: true, reason: 'locked' };
  }

  guardLocks.set(key, true);
  try {
    return await asyncFn();
  } finally {
    guardLocks.delete(key);
  }
}

function guardClick(event, asyncFn, loadingText = 'Processing...') {
  if (event) {
    event.preventDefault();
    event.stopPropagation();
  }
  const button = event?.currentTarget;
  return withSubmitGuard(button, asyncFn, { loadingText });
}

function bindGuardedFormSubmit(formEl, handler, options = {}) {
  if (!formEl) return;
  const { loadingText = 'Saving...' } = options;
  formEl.addEventListener('submit', (e) => {
    e.preventDefault();
    const button = e.submitter || formEl.querySelector('[type="submit"]');
    withSubmitGuard(button, () => handler(e), { loadingText });
  });
}
