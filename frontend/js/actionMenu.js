/**
 * Shared row action dropdown menu (⋮).
 */

let actionMenuListenersBound = false;

function closeAllActionMenus() {
  document.querySelectorAll('.action-menu.show').forEach((menu) => {
    menu.classList.remove('show', 'is-fixed');
    menu.style.top = '';
    menu.style.left = '';
  });
  document.querySelectorAll('.action-menu-trigger[aria-expanded="true"]').forEach((btn) => {
    btn.setAttribute('aria-expanded', 'false');
  });
}

function positionActionMenu(wrap) {
  const menu = wrap.querySelector('.action-menu');
  const trigger = wrap.querySelector('.action-menu-trigger');
  if (!menu || !trigger) return;

  menu.classList.add('is-fixed');
  const triggerRect = trigger.getBoundingClientRect();
  const menuWidth = menu.offsetWidth || 200;
  const menuHeight = menu.offsetHeight || 160;
  const margin = 8;

  let left = triggerRect.right - menuWidth;
  left = Math.max(margin, Math.min(left, window.innerWidth - menuWidth - margin));

  let top = triggerRect.bottom + 4;
  if (top + menuHeight > window.innerHeight - margin && triggerRect.top > menuHeight + margin) {
    top = triggerRect.top - menuHeight - 4;
  }

  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function toggleActionMenu(menuId, event) {
  event.preventDefault();
  event.stopPropagation();

  const wrap = document.getElementById(menuId);
  const menu = wrap?.querySelector('.action-menu');
  const trigger = wrap?.querySelector('.action-menu-trigger');
  if (!menu || !trigger) return;

  const wasOpen = menu.classList.contains('show');
  closeAllActionMenus();
  if (wasOpen) return;

  requestAnimationFrame(() => {
    menu.classList.add('show');
    trigger.setAttribute('aria-expanded', 'true');
    positionActionMenu(wrap);
  });
}

function runActionMenuItem(event, callback) {
  event.preventDefault();
  event.stopPropagation();
  closeAllActionMenus();
  callback();
}

function handleDocumentClickForActionMenus(event) {
  if (event.target.closest('.action-menu-wrap')) return;
  closeAllActionMenus();
}

function initActionMenus() {
  if (actionMenuListenersBound) return;
  actionMenuListenersBound = true;

  document.addEventListener('click', handleDocumentClickForActionMenus);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllActionMenus();
  });
  window.addEventListener('resize', closeAllActionMenus);
  if (typeof bindAllTableScrollListeners === 'function') {
    bindAllTableScrollListeners();
  } else {
    document.querySelectorAll('.table-responsive, .table-scroll-container').forEach((el) => {
      el.addEventListener('scroll', closeAllActionMenus, true);
    });
  }
}

function escapeActionMenuAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function renderActionMenuItem(item) {
  const icon = item.icon ? `<i class="bi ${item.icon}"></i>` : '';
  const label = escapeActionMenuAttr(item.label);
  const dangerClass = item.danger ? ' danger' : '';
  const disabledAttr = item.disabled ? ' disabled' : '';

  if (item.href) {
    return `<a class="${dangerClass.trim()}" role="menuitem" href="${item.href}" title="${label}">${icon}${item.label}</a>`;
  }

  const handler = item.handler || 'void 0';
  return `<button type="button" class="${dangerClass.trim()}" role="menuitem"${disabledAttr} onclick="runActionMenuItem(event, () => { ${handler} })">${icon}${item.label}</button>`;
}

function renderActionMenuCell(menuId, items, options = {}) {
  const visibleItems = (items || []).filter(Boolean);
  if (!visibleItems.length) return '';

  const title = options.title || 'Actions';
  const menuItems = visibleItems.map(renderActionMenuItem).join('');

  return `
    <div class="action-menu-cell">
      <div class="action-menu-wrap" id="${menuId}">
        <button type="button" class="btn-icon action-menu-trigger"
          onclick="toggleActionMenu('${menuId}', event)"
          title="${escapeActionMenuAttr(title)}" aria-label="${escapeActionMenuAttr(title)}"
          aria-haspopup="true" aria-expanded="false">
          <i class="bi bi-three-dots-vertical"></i>
        </button>
        <div class="action-menu" role="menu" onclick="event.stopPropagation()">
          ${menuItems}
        </div>
      </div>
    </div>
  `;
}
