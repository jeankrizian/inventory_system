/**
 * Shared scrollable table helpers — cell tooltips and scroll listeners for action menus.
 */

const TABLE_SCROLL_SELECTOR = '.table-scroll-container, .table-responsive';
const boundScrollContainers = new WeakSet();

function isEllipsisTargetCell(td) {
  if (!td || td.tagName !== 'TD') return false;
  if (td.classList.contains('col-actions')) return false;
  if (td.querySelector('.action-menu-cell')) return false;
  if (td.querySelector('button')) return false;
  return true;
}

function applyCellEllipsisTitles(root) {
  const scope = root?.querySelectorAll ? root : document;
  const cells = root?.matches?.('table.data-table')
    ? root.querySelectorAll('td')
    : scope.querySelectorAll(`${TABLE_SCROLL_SELECTOR} .data-table td, table.data-table td`);

  cells.forEach((td) => {
    if (!isEllipsisTargetCell(td)) {
      if (!td.hasAttribute('title') || td.getAttribute('title') === td.textContent.trim()) {
        td.removeAttribute('title');
      }
      return;
    }

    const text = td.textContent.trim();
    if (!text) {
      td.removeAttribute('title');
      return;
    }

    if (td.scrollWidth > td.clientWidth + 1) {
      td.title = text;
    } else {
      td.removeAttribute('title');
    }
  });
}

function bindTableScrollListeners(root = document) {
  const containers = root?.matches?.(TABLE_SCROLL_SELECTOR)
    ? [root]
    : [...(root?.querySelectorAll?.(TABLE_SCROLL_SELECTOR) || [])];

  containers.forEach((el) => {
    if (boundScrollContainers.has(el)) return;
    boundScrollContainers.add(el);
    if (typeof closeAllActionMenus === 'function') {
      el.addEventListener('scroll', closeAllActionMenus, true);
    }
  });
}

function bindAllTableScrollListeners() {
  bindTableScrollListeners(document);
}

function finishTableRender(container) {
  if (!container) return;
  applyCellEllipsisTitles(container);
  bindTableScrollListeners(container);
}
