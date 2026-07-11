function closeSearchableSelectDropdowns(except) {
  document.querySelectorAll('.searchable-select-dropdown.show').forEach((dropdown) => {
    const wrap = dropdown.closest('.searchable-select');
    if (!except || except !== wrap) dropdown.classList.remove('show');
  });
}

function getSearchableSelectOptions(selectEl) {
  return Array.from(selectEl.options)
    .filter((opt) => opt.value !== '')
    .map((opt) => ({ value: opt.value, label: opt.textContent }));
}

function syncSearchableSelectValue(selectEl) {
  if (!selectEl) return;
  const wrap = selectEl.closest('.searchable-select');
  if (!wrap) return;
  const input = wrap.querySelector('.searchable-select-input');
  if (!input) return;
  const selected = Array.from(selectEl.options).find((opt) => String(opt.value) === String(selectEl.value));
  input.value = selected && selected.value ? selected.textContent : '';
}

function enhanceSearchableSelect(selectEl) {
  if (!selectEl || selectEl.dataset.searchableEnhanced) return;
  selectEl.dataset.searchableEnhanced = '1';

  const wrapper = document.createElement('div');
  wrapper.className = 'searchable-select';
  selectEl.parentNode.insertBefore(wrapper, selectEl);
  wrapper.appendChild(selectEl);
  selectEl.classList.add('searchable-select-native');
  selectEl.tabIndex = -1;
  selectEl.setAttribute('aria-hidden', 'true');

  const placeholder = selectEl.options[0]?.value === ''
    ? selectEl.options[0].textContent
    : (selectEl.getAttribute('data-placeholder') || 'Select...');

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'form-control-custom searchable-select-input';
  input.autocomplete = 'off';
  input.placeholder = placeholder;
  if (selectEl.required) {
    input.required = true;
    selectEl.required = false;
  }

  const dropdown = document.createElement('div');
  dropdown.className = 'searchable-select-dropdown';
  wrapper.insertBefore(input, selectEl);
  wrapper.appendChild(dropdown);

  function selectOption(value, label) {
    selectEl.value = value;
    input.value = label;
    dropdown.classList.remove('show');
    selectEl.dispatchEvent(new Event('change', { bubbles: true }));
  }

  function renderDropdown(filter = '') {
    const term = filter.trim().toLowerCase();
    const options = getSearchableSelectOptions(selectEl).filter((opt) =>
      !term || opt.label.toLowerCase().includes(term)
    );

    if (!options.length) {
      dropdown.innerHTML = '<div class="searchable-select-option searchable-select-empty">No results found</div>';
      return;
    }

    dropdown.innerHTML = options.map((opt) =>
      `<div class="searchable-select-option" data-value="${opt.value}">${opt.label}</div>`
    ).join('');

    dropdown.querySelectorAll('.searchable-select-option:not(.searchable-select-empty)').forEach((opt) => {
      opt.addEventListener('mousedown', (e) => {
        e.preventDefault();
        selectOption(opt.dataset.value, opt.textContent);
      });
    });
  }

  function showDropdown() {
    closeSearchableSelectDropdowns(wrapper);
    renderDropdown(input.value);
    dropdown.classList.add('show');
  }

  input.addEventListener('focus', () => {
    input.select();
    showDropdown();
  });
  input.addEventListener('click', showDropdown);
  input.addEventListener('input', () => {
    selectEl.value = '';
    showDropdown();
  });
  input.addEventListener('blur', () => {
    setTimeout(() => {
      dropdown.classList.remove('show');
      if (!selectEl.value) {
        input.value = '';
      } else {
        syncSearchableSelectValue(selectEl);
      }
    }, 150);
  });

  input.addEventListener('keydown', (e) => {
    const options = dropdown.querySelectorAll('.searchable-select-option:not(.searchable-select-empty)');
    if (!options.length) return;

    const active = dropdown.querySelector('.searchable-select-option.active');
    let index = active ? Array.from(options).indexOf(active) : -1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (active) active.classList.remove('active');
      index = Math.min(index + 1, options.length - 1);
      options[index].classList.add('active');
      if (!dropdown.classList.contains('show')) showDropdown();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (active) active.classList.remove('active');
      index = Math.max(index - 1, 0);
      options[index].classList.add('active');
    } else if (e.key === 'Enter' && active) {
      e.preventDefault();
      selectOption(active.dataset.value, active.textContent);
    } else if (e.key === 'Escape') {
      dropdown.classList.remove('show');
    }
  });

  syncSearchableSelectValue(selectEl);
}

function initSearchableSelects(root = document) {
  const scope = root && root.querySelectorAll ? root : document;
  scope.querySelectorAll('select.form-control-custom').forEach((selectEl) => {
    enhanceSearchableSelect(selectEl);
  });
}

let searchableSelectObserver = null;

function startSearchableSelectObserver(root = document.body) {
  if (!root || searchableSelectObserver) return;

  searchableSelectObserver = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      mutation.addedNodes.forEach((node) => {
        if (node.nodeType !== 1) return;
        if (node.matches?.('select.form-control-custom')) {
          enhanceSearchableSelect(node);
        }
        node.querySelectorAll?.('select.form-control-custom').forEach((selectEl) => {
          enhanceSearchableSelect(selectEl);
        });
      });
    }
  });

  searchableSelectObserver.observe(root, { childList: true, subtree: true });
}

function bootstrapSearchableSelects() {
  initSearchableSelects(document);
  startSearchableSelectObserver(document.body);
}

function refreshSearchableSelects(root = document) {
  let selects;
  if (Array.isArray(root)) {
    selects = root.filter(Boolean);
  } else if (root?.tagName === 'SELECT' && root.classList?.contains('form-control-custom')) {
    selects = [root];
  } else if (root && root.querySelectorAll) {
    selects = root.querySelectorAll('select.form-control-custom');
  } else {
    selects = document.querySelectorAll('select.form-control-custom');
  }
  selects.forEach((selectEl) => {
    if (!selectEl.dataset.searchableEnhanced) {
      enhanceSearchableSelect(selectEl);
    } else {
      syncSearchableSelectValue(selectEl);
    }
  });
}

function initItemFormSearchableSelects() {
  const form = document.getElementById('itemForm');
  if (!form) return;
  [
    'itemCategory', 'itemSupplier', 'itemLocation', 'itemClassification',
    'itemMaterial', 'itemCondition', 'itemCustodian', 'itemMaintenanceSchedule',
    'transferDepartment', 'transferLocation', 'componentNewItem'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) enhanceSearchableSelect(el);
  });
  initSearchableSelects(form);
}

function syncItemFormSearchableSelects() {
  [
    'itemCategory', 'itemSupplier', 'itemLocation', 'itemClassification',
    'itemMaterial', 'itemCondition', 'itemCustodian', 'itemMaintenanceSchedule',
    'transferDepartment', 'transferLocation', 'componentNewItem'
  ].forEach((id) => {
    syncSearchableSelectValue(document.getElementById(id));
  });
}

document.addEventListener('click', (e) => {
  if (!e.target.closest('.searchable-select')) closeSearchableSelectDropdowns();
});

window.initSearchableSelects = initSearchableSelects;
window.refreshSearchableSelects = refreshSearchableSelects;
window.startSearchableSelectObserver = startSearchableSelectObserver;

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', bootstrapSearchableSelects);
} else {
  bootstrapSearchableSelects();
}
