/**
 * Notification panel — bell icon, badge, dropdown
 */

let notificationPollTimer = null;
let notificationBtnHandler = null;
let markAllHandler = null;
let notificationsLoaded = false;

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function formatNotificationTime(dateStr) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffSec = Math.floor((now - date) / 1000);

  if (diffSec < 60) return 'Just now';
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)} minute${Math.floor(diffSec / 60) === 1 ? '' : 's'} ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)} hour${Math.floor(diffSec / 3600) === 1 ? '' : 's'} ago`;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';

  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)} day${Math.floor(diffSec / 86400) === 1 ? '' : 's'} ago`;

  return date.toLocaleDateString('en-PH', { year: 'numeric', month: 'short', day: 'numeric' });
}

function updateNotificationBadge(count) {
  const badge = document.getElementById('notificationBadge');
  const dot = document.getElementById('notificationDot');
  if (!badge) return;

  const n = parseInt(count, 10) || 0;
  if (n > 0) {
    badge.textContent = n > 99 ? '99+' : String(n);
    badge.style.display = 'flex';
    if (dot) dot.style.display = 'none';
  } else {
    badge.style.display = 'none';
    if (dot) dot.style.display = 'none';
  }
}

function renderNotificationList(notifications) {
  const list = document.getElementById('notificationList');
  if (!list) return;

  if (!notifications || notifications.length === 0) {
    list.innerHTML = `
      <div class="notification-empty">
        <i class="bi bi-bell"></i>
        <p>No notifications yet</p>
      </div>
    `;
    return;
  }

  list.innerHTML = notifications.map(n => `
    <div class="notification-item ${n.is_read ? 'read' : 'unread'}" data-id="${n.id}" data-link="${escapeHtml(n.link_url || '')}">
      <div class="notification-item-content">
        <strong>${escapeHtml(n.title)}</strong>
        <p>${escapeHtml(n.message)}</p>
        <small>${formatNotificationTime(n.created_at)}</small>
      </div>
      ${!n.is_read ? '<span class="notification-unread-dot"></span>' : ''}
    </div>
  `).join('');

  list.querySelectorAll('.notification-item').forEach(el => {
    el.addEventListener('click', () => handleNotificationClick(el));
  });
}

async function handleNotificationClick(el) {
  const id = el.dataset.id;
  const link = el.dataset.link;

  if (!el.classList.contains('read')) {
    try {
      const res = await API.markNotificationRead(id);
      el.classList.remove('unread');
      el.classList.add('read');
      el.querySelector('.notification-unread-dot')?.remove();
      if (res?.data?.unreadCount !== undefined) {
        updateNotificationBadge(res.data.unreadCount);
      }
    } catch { /* continue navigation */ }
  }

  document.getElementById('notificationPanel')?.classList.remove('show');
  if (link) window.location.href = link;
}

async function loadNotifications(showLoading = false) {
  const list = document.getElementById('notificationList');
  if (showLoading && list) {
    list.innerHTML = '<div class="notification-loading"><span class="spinner-border spinner-border-sm"></span> Loading...</div>';
  }

  try {
    const res = await API.getNotifications();
    if (!res?.data) return;
    renderNotificationList(res.data.notifications);
    updateNotificationBadge(res.data.unreadCount);
    notificationsLoaded = true;
  } catch {
    if (list) {
      list.innerHTML = '<div class="notification-empty"><p>Unable to load notifications</p></div>';
    }
  }
}

async function refreshUnreadCount() {
  try {
    const res = await API.getUnreadNotificationCount();
    if (res?.data) updateNotificationBadge(res.data.count);
  } catch { /* silent */ }
}

function initNotifications() {
  const btn = document.getElementById('notificationBtn');
  const panel = document.getElementById('notificationPanel');
  const markAllBtn = document.getElementById('markAllReadBtn');

  if (!btn || !panel) return;

  if (notificationPollTimer) {
    clearInterval(notificationPollTimer);
    notificationPollTimer = null;
  }

  refreshUnreadCount();
  notificationPollTimer = setInterval(refreshUnreadCount, 60000);

  if (notificationBtnHandler) {
    btn.removeEventListener('click', notificationBtnHandler);
  }
  notificationBtnHandler = (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.contains('show');
    document.getElementById('profileDropdown')?.classList.remove('show');
    document.getElementById('searchResults')?.classList.remove('show');

    if (isOpen) {
      panel.classList.remove('show');
    } else {
      panel.classList.add('show');
      loadNotifications(true);
    }
  };
  btn.addEventListener('click', notificationBtnHandler);

  markAllBtn?.removeEventListener('click', markAllHandler);
  markAllHandler = async (e) => {
    e.stopPropagation();
    try {
      await API.markAllNotificationsRead();
      updateNotificationBadge(0);
      document.querySelectorAll('.notification-item').forEach(el => {
        el.classList.remove('unread');
        el.classList.add('read');
        el.querySelector('.notification-unread-dot')?.remove();
      });
    } catch { /* ignore */ }
  };
  markAllBtn?.addEventListener('click', markAllHandler);

  panel.addEventListener('click', (e) => e.stopPropagation());
}

function closeNotificationPanel() {
  document.getElementById('notificationPanel')?.classList.remove('show');
}
