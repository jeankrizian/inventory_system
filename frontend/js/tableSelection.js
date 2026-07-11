/**
 * Reusable table row selection with bulk action toolbar.
 */

function escapeTableSelectionAttr(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/</g, '&lt;');
}

function resolveSelectionInput(event) {
  const target = event.target;
  if (!target) return null;
  if (target.classList?.contains('table-select-row') || target.classList?.contains('table-select-all')) {
    return target;
  }
  const label = target.closest?.('.table-select-label');
  return label?.querySelector('.table-select-row, .table-select-all') || null;
}

function exportRowsToCsv(filename, rows, columns) {
  if (!rows?.length || !columns?.length) return;

  const escapeCsv = (value) => {
    const text = value == null ? '' : String(value);
    if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
    return text;
  };

  const header = columns.map((col) => escapeCsv(col.label)).join(',');
  const body = rows.map((row) =>
    columns.map((col) => {
      const raw = typeof col.getValue === 'function' ? col.getValue(row) : row[col.key];
      return escapeCsv(raw);
    }).join(',')
  ).join('\n');

  const blob = new Blob([`${header}\n${body}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function createTableSelection(config = {}) {
  const {
    container,
    getRowId = (row) => row.id,
    getVisibleRows = () => [],
    bulkActions = [],
    enabled = true,
    isRowSelectable = () => true,
    toolbarParent
  } = config;

  const selectedIds = new Set();
  let lastClickedVisibleIndex = -1;
  let toolbarEl = null;
  let boundRoot = null;
  let containerListenersBound = false;
  let toolbarListenersBound = false;

  const resolveContainer = () => {
    if (!container) return null;
    return typeof container === 'string' ? document.getElementById(container) : container;
  };

  const resolveToolbarParent = () => {
    if (toolbarParent) {
      return typeof toolbarParent === 'string' ? document.getElementById(toolbarParent) : toolbarParent;
    }
    const tableContainer = resolveContainer();
    return tableContainer?.closest('.content-card') || tableContainer?.parentElement || null;
  };

  const normalizeId = (id) => String(id);

  const getSelectableVisibleRows = () =>
    getVisibleRows().filter((row) => isRowSelectable(row));

  const getVisibleRowIndex = (rowId) => {
    const rows = getSelectableVisibleRows();
    return rows.findIndex((row) => normalizeId(getRowId(row)) === normalizeId(rowId));
  };

  const updateRowHighlights = (root) => {
    if (!root) return;
    root.querySelectorAll('tbody tr[data-row-id]').forEach((tr) => {
      const id = tr.getAttribute('data-row-id');
      tr.classList.toggle('is-selected', selectedIds.has(id));
    });
  };

  const updateHeaderCheckbox = (root) => {
    const header = root?.querySelector('.table-select-all');
    if (!header) return;

    const visibleRows = getSelectableVisibleRows();
    const visibleIds = visibleRows.map((row) => normalizeId(getRowId(row)));
    const selectedVisibleCount = visibleIds.filter((id) => selectedIds.has(id)).length;

    if (!visibleIds.length) {
      header.checked = false;
      header.indeterminate = false;
      header.disabled = true;
      return;
    }

    header.disabled = false;
    header.checked = selectedVisibleCount > 0 && selectedVisibleCount === visibleIds.length;
    header.indeterminate = selectedVisibleCount > 0 && selectedVisibleCount < visibleIds.length;
  };

  const updateRowCheckboxes = (root) => {
    if (!root) return;
    root.querySelectorAll('.table-select-row').forEach((input) => {
      const id = input.getAttribute('data-row-id');
      input.checked = selectedIds.has(id);
    });
  };

  const renderToolbar = () => {
    const parent = resolveToolbarParent();
    if (!parent) return;

    if (!toolbarEl) {
      toolbarEl = document.createElement('div');
      toolbarEl.className = 'table-bulk-toolbar';
      toolbarEl.hidden = true;
      const tableContainer = resolveContainer();
      if (tableContainer) {
        parent.insertBefore(toolbarEl, tableContainer);
      } else {
        parent.prepend(toolbarEl);
      }
    }

    const count = selectedIds.size;
    if (!enabled || !count || !bulkActions.length) {
      toolbarEl.hidden = true;
      toolbarEl.innerHTML = '';
      return;
    }

    const actionButtons = bulkActions.map((action) => {
      const dangerClass = action.danger ? ' danger' : '';
      const icon = action.icon ? `<i class="bi ${action.icon}"></i>` : '';
      const label = escapeTableSelectionAttr(action.label);
      return `<button type="button" class="table-bulk-action${dangerClass}" data-bulk-action="${escapeTableSelectionAttr(action.id)}" title="${label}">${icon}${action.label}</button>`;
    }).join('');

    toolbarEl.hidden = false;
    toolbarEl.innerHTML = `
      <span class="table-bulk-count">${count} selected</span>
      <div class="table-bulk-actions">${actionButtons}</div>
      <button type="button" class="table-bulk-clear">Clear selection</button>
    `;
  };

  const updateUI = (root = boundRoot) => {
    renderToolbar();
    if (!root) return;
    updateHeaderCheckbox(root);
    updateRowCheckboxes(root);
    updateRowHighlights(root);
  };

  const setSelected = (rowId, selected) => {
    const id = normalizeId(rowId);
    if (selected) selectedIds.add(id);
    else selectedIds.delete(id);
    updateUI();
  };

  const selectRange = (fromIndex, toIndex) => {
    const rows = getSelectableVisibleRows();
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    for (let i = start; i <= end; i += 1) {
      selectedIds.add(normalizeId(getRowId(rows[i])));
    }
    updateUI();
  };

  const selectAllVisible = (selected) => {
    const rows = getSelectableVisibleRows();
    if (selected) {
      rows.forEach((row) => selectedIds.add(normalizeId(getRowId(row))));
    } else {
      rows.forEach((row) => selectedIds.delete(normalizeId(getRowId(row))));
    }
    updateUI();
  };

  const handleCheckboxClick = (event) => {
    const input = resolveSelectionInput(event);
    if (!input?.classList.contains('table-select-row')) return;

    event.stopPropagation();

    const rowId = input.getAttribute('data-row-id');
    const rowIndex = getVisibleRowIndex(rowId);

    if (event.shiftKey && lastClickedVisibleIndex >= 0 && rowIndex >= 0) {
      selectRange(lastClickedVisibleIndex, rowIndex);
      lastClickedVisibleIndex = rowIndex;
      return;
    }

    setSelected(rowId, input.checked);
    if (rowIndex >= 0) lastClickedVisibleIndex = rowIndex;
  };

  const handleHeaderClick = (event) => {
    const input = resolveSelectionInput(event);
    if (!input?.classList.contains('table-select-all')) return;

    event.stopPropagation();
    selectAllVisible(input.checked);
    lastClickedVisibleIndex = -1;
  };

  const handleToolbarClick = async (event) => {
    const clearBtn = event.target.closest('.table-bulk-clear');
    if (clearBtn) {
      clearSelection();
      return;
    }

    const actionBtn = event.target.closest('[data-bulk-action]');
    if (!actionBtn) return;

    const actionId = actionBtn.getAttribute('data-bulk-action');
    const action = bulkActions.find((item) => item.id === actionId);
    if (!action || typeof action.onClick !== 'function') return;

    const ids = getSelectedIds();
    const rows = getSelectedRows();
    if (!ids.length) return;

    await action.onClick(ids, rows);
  };

  const handleKeydown = (event) => {
    const input = event.target;
    if (!input.classList?.contains('table-select-row')) return;
    if (event.key !== ' ' && event.key !== 'Spacebar') return;

    event.preventDefault();
    input.checked = !input.checked;
    handleCheckboxClick(event);
  };

  const bindContainerListeners = (root) => {
    if (!root || containerListenersBound) return;
    root.addEventListener('click', (event) => {
      handleCheckboxClick(event);
      handleHeaderClick(event);
    });
    root.addEventListener('keydown', handleKeydown);
    containerListenersBound = true;
  };

  const bindToolbarListeners = () => {
    if (toolbarListenersBound) return;
    document.addEventListener('click', (event) => {
      if (!event.target.closest('.table-bulk-toolbar')) return;
      handleToolbarClick(event);
    });
    toolbarListenersBound = true;
  };

  const bindAfterRender = (root = resolveContainer()) => {
    if (!enabled || !root) return;
    boundRoot = root;
    bindToolbarListeners();
    bindContainerListeners(root);
    updateUI(root);
  };

  const pruneHiddenSelections = () => {
    const visibleIds = new Set(getVisibleRows().map((row) => normalizeId(getRowId(row))));
    let changed = false;
    for (const id of [...selectedIds]) {
      if (!visibleIds.has(id)) {
        selectedIds.delete(id);
        changed = true;
      }
    }
    if (changed) {
      lastClickedVisibleIndex = -1;
      updateUI();
    }
    return changed;
  };

  const clearSelection = () => {
    selectedIds.clear();
    lastClickedVisibleIndex = -1;
    updateUI();
  };

  const getSelectedIds = () => [...selectedIds];

  const getSelectedRows = () => {
    const ids = selectedIds;
    return getVisibleRows().filter((row) => ids.has(normalizeId(getRowId(row))));
  };

  const renderCheckboxHeader = () => {
    if (!enabled) return '';
    return `
      <th class="col-select" scope="col">
        <label class="table-select-label">
          <input type="checkbox" class="table-select-all" aria-label="Select all visible rows">
        </label>
      </th>
    `;
  };

  const renderCheckboxCell = (row) => {
    if (!enabled) return '';
    const id = normalizeId(getRowId(row));
    const selectable = isRowSelectable(row);
    const checked = selectedIds.has(id) ? ' checked' : '';
    const disabled = selectable ? '' : ' disabled';
    return `
      <td class="col-select">
        <label class="table-select-label">
          <input type="checkbox" class="table-select-row" data-row-id="${escapeTableSelectionAttr(id)}" aria-label="Select row"${checked}${disabled}>
        </label>
      </td>
    `;
  };

  const renderRowAttrs = (row) => {
    if (!enabled) return '';
    return ` data-row-id="${escapeTableSelectionAttr(normalizeId(getRowId(row)))}"`;
  };

  const destroy = () => {
    toolbarEl?.remove();
    toolbarEl = null;
    boundRoot = null;
    containerListenersBound = false;
    clearSelection();
  };

  return {
    renderCheckboxHeader,
    renderCheckboxCell,
    renderRowAttrs,
    bindAfterRender,
    pruneHiddenSelections,
    clearSelection,
    getSelectedIds,
    getSelectedRows,
    updateUI,
    destroy
  };
}
