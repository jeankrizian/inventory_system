const REPORTS = [
  { type: 'inventory', title: 'Inventory Report', desc: 'Complete list of all inventory items with stock levels and status', icon: 'bi-box-seam', hasFilters: true },
  { type: 'borrow', title: 'Borrow Report', desc: 'All borrow transactions with borrower details and status', icon: 'bi-cart3', hasFilters: true },
  { type: 'return', title: 'Process Return Report', desc: 'All process return transactions with condition and notes', icon: 'bi-arrow-return-left', hasFilters: true },
  { type: 'low-stock', title: 'Low Stock Report', desc: 'Items below their low stock threshold', icon: 'bi-exclamation-triangle', hasFilters: true },
  { type: 'supplier', title: 'Supplier Report', desc: 'Complete supplier directory with contact information', icon: 'bi-truck', hasFilters: true },
  { type: 'transfers', title: 'Transfer Report', desc: 'Asset movement and transfer request history', icon: 'bi-arrow-left-right', hasFilters: true },
  { type: 'maintenance', title: 'Maintenance Report', desc: 'Preventive and corrective maintenance records', icon: 'bi-tools', hasFilters: true },
  { type: 'disposals', title: 'Disposal Report', desc: 'Disposal requests, inspections, and approvals', icon: 'bi-trash3', hasFilters: true },
  { type: 'departments', title: 'Department Report', desc: 'Departments with custodians and asset counts', icon: 'bi-building', hasFilters: true },
  { type: 'custodians', title: 'Custodian Report', desc: 'Custodian assignments and asset responsibilities', icon: 'bi-person-badge', hasFilters: true },
  { type: 'asset-status', title: 'Asset Status Report', desc: 'Full asset status overview with classifications', icon: 'bi-clipboard-data', hasFilters: true },
  { type: 'documents', title: 'Official Documents', desc: 'PAR, GRN, and RDF document history with preview and PDF export', icon: 'bi-file-earmark-text', link: '/pages/documents.html' }
];

const REPORT_FILTER_FIELD_IDS = [
  'reportFilterItemCode',
  'reportFilterItemName',
  'reportFilterDepartment',
  'reportFilterStatus',
  'reportFilterCondition',
  'reportFilterQuantity',
  'reportFilterUnitCost',
  'reportFilterSupplier',
  'reportFilterMaterial',
  'reportFilterPurchaseDate'
];

let activeReportType = null;
let currentUser = null;
let departments = [];
let filterOptions = {
  materials: ['Metal', 'Plastic', 'Wood', 'Paper', 'Glass', 'Fabric', 'Rubber', 'Electronic', 'Composite', 'Other'],
  statuses: ['Available', 'Low Stock', 'Out of Stock', 'Under Maintenance'],
  conditions: ['New', 'Good', 'Fair', 'Poor', 'Damaged']
};

const REPORT_STATUS_LABELS = {
  'Under Maintenance': 'For Maintenance'
};

function getVisibleReports(user) {
  return REPORTS.filter((report) => {
    if (report.link) {
      return isAdministrator(user) || isPropertyManager(user);
    }
    return canAccessReportType(user, report.type);
  });
}

function denyReportAccess(type) {
  showToast('You do not have permission to access this report.', 'error');
}

function getReportConfig(type) {
  return REPORTS.find(r => r.type === type);
}

function getReportFilterParams() {
  const params = {};
  const itemCode = document.getElementById('reportFilterItemCode')?.value?.trim();
  const itemName = document.getElementById('reportFilterItemName')?.value?.trim();
  const department = document.getElementById('reportFilterDepartment')?.value;
  const status = document.getElementById('reportFilterStatus')?.value;
  const condition = document.getElementById('reportFilterCondition')?.value;
  const quantity = document.getElementById('reportFilterQuantity')?.value?.trim();
  const unitCost = document.getElementById('reportFilterUnitCost')?.value?.trim();
  const supplier = document.getElementById('reportFilterSupplier')?.value?.trim();
  const material = document.getElementById('reportFilterMaterial')?.value;
  const purchaseDate = document.getElementById('reportFilterPurchaseDate')?.value;

  if (itemCode) params.item_code = itemCode;
  if (itemName) params.item_name = itemName;
  if (department) {
    const departmentId = parseInt(department, 10);
    if (!Number.isNaN(departmentId)) params.department_id = departmentId;
  }
  if (status) params.status = status;
  if (condition) params.condition = condition;
  if (quantity) params.quantity = quantity;
  if (unitCost) params.unit_cost = unitCost;
  if (supplier) params.supplier_name = supplier;
  if (material) params.material = material;
  if (purchaseDate) params.purchase_date = purchaseDate;

  return params;
}

function clearReportFilters() {
  REPORT_FILTER_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

async function loadReportFilterData() {
  const [deptRes, filterRes] = await Promise.allSettled([
    API.getDepartments(),
    API.getReportFilterOptions()
  ]);

  if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value?.data)) {
    departments = deptRes.value.data;
  }

  if (filterRes.status === 'fulfilled' && filterRes.value?.data) {
    filterOptions = {
      materials: filterRes.value.data.materials || filterOptions.materials,
      statuses: filterRes.value.data.statuses || filterOptions.statuses,
      conditions: filterRes.value.data.conditions || filterOptions.conditions
    };
  }
}

async function renderReportFilters(type) {
  const config = getReportConfig(type);
  const bar = document.getElementById('reportFiltersBar');

  if (!config?.hasFilters) {
    bar.innerHTML = '';
    bar.style.display = 'none';
    return;
  }

  if (!departments.length) {
    await loadReportFilterData();
  }

  const deptOptions = departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  const statusOptions = filterOptions.statuses.map((s) => `<option value="${s}">${REPORT_STATUS_LABELS[s] || s}</option>`).join('');
  const conditionOptions = filterOptions.conditions.map((c) => `<option value="${c}">${c}</option>`).join('');
  const materialOptions = filterOptions.materials.map((m) => `<option value="${m}">${m}</option>`).join('');

  bar.style.display = 'grid';
  bar.style.gridTemplateColumns = 'repeat(auto-fill, minmax(150px, 1fr))';
  bar.style.gap = '8px';
  bar.style.alignItems = 'end';

  bar.innerHTML = `
    <input type="text" class="form-control-custom" id="reportFilterItemCode" placeholder="Item Code" title="Item Code">
    <input type="text" class="form-control-custom" id="reportFilterItemName" placeholder="Item Name" title="Item Name">
    <select class="form-control-custom" id="reportFilterDepartment" title="Department">
      <option value="">All Departments</option>
      ${deptOptions}
    </select>
    <select class="form-control-custom" id="reportFilterStatus" title="Status">
      <option value="">All Status</option>
      ${statusOptions}
    </select>
    <select class="form-control-custom" id="reportFilterCondition" title="Condition">
      <option value="">All Conditions</option>
      ${conditionOptions}
    </select>
    <input type="number" class="form-control-custom" id="reportFilterQuantity" placeholder="Quantity" title="Quantity" min="0" step="1">
    <input type="number" class="form-control-custom" id="reportFilterUnitCost" placeholder="Price / Cost" title="Price / Cost" min="0" step="0.01">
    <input type="text" class="form-control-custom" id="reportFilterSupplier" placeholder="Supplier" title="Supplier">
    <select class="form-control-custom" id="reportFilterMaterial" title="Material">
      <option value="">All Materials</option>
      ${materialOptions}
    </select>
    <input type="date" class="form-control-custom" id="reportFilterPurchaseDate" title="Purchase Date">
    <div style="display:flex;gap:8px;grid-column:1/-1;">
      <button class="btn-primary-custom btn-sm-custom" type="button" id="reportApplyFilters"><i class="bi bi-funnel"></i> Apply Filters</button>
      <button class="btn-outline-custom btn-sm-custom" type="button" id="reportClearFilters">Clear</button>
    </div>
  `;

  document.getElementById('reportApplyFilters')?.addEventListener('click', () => loadReportData(type));
  document.getElementById('reportClearFilters')?.addEventListener('click', () => {
    clearReportFilters();
    loadReportData(type);
  });

  bar.querySelectorAll('input').forEach((input) => {
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        loadReportData(type);
      }
    });
  });
}

async function initReportsPage() {
  const user = await initLayout('reports');
  if (!user) return;
  currentUser = user;

  await loadReportFilterData();

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Reports</h1>
      <p>Generate, view, and export inventory reports</p>
    </div>
    <div class="report-grid" id="reportGrid">
      ${getVisibleReports(user).map(r => `
        <div class="report-card">
          <h4><i class="bi ${r.icon}" style="color:var(--primary);margin-right:8px;"></i>${r.title}</h4>
          <p>${r.desc}</p>
          <div class="report-actions">
            ${r.link
    ? `<a class="btn-outline-custom btn-sm-custom" href="${r.link}"><i class="bi bi-eye"></i> Open</a>`
    : `<button class="btn-outline-custom btn-sm-custom" onclick="viewReport('${r.type}')"><i class="bi bi-eye"></i> View</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="exportReportPDF('${r.type}')"><i class="bi bi-file-pdf"></i> PDF</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="exportReportExcel('${r.type}')"><i class="bi bi-file-excel"></i> Excel</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="printReport('${r.type}')"><i class="bi bi-printer"></i> Print</button>`}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="content-card" id="reportPreview" style="display:none;">
      <div class="content-card-header">
        <h3 id="reportPreviewTitle">Report Preview</h3>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn-outline-custom btn-sm-custom" onclick="exportReportPDF(activeReportType)"><i class="bi bi-file-pdf"></i> PDF</button>
          <button class="btn-outline-custom btn-sm-custom" onclick="exportReportExcel(activeReportType)"><i class="bi bi-file-excel"></i> Excel</button>
          <button class="btn-outline-custom btn-sm-custom" onclick="printReport(activeReportType)"><i class="bi bi-printer"></i> Print</button>
          <button class="btn-outline-custom btn-sm-custom" onclick="document.getElementById('reportPreview').style.display='none'">
            <i class="bi bi-x"></i> Close
          </button>
        </div>
      </div>
      <div class="filters-bar" id="reportFiltersBar"></div>
      <div class="table-responsive" id="reportTable"></div>
    </div>
  `;
}

function ensureReportAccess(type) {
  if (!canAccessReportType(currentUser, type)) {
    denyReportAccess(type);
    return false;
  }
  return true;
}

async function loadReportData(type) {
  if (!ensureReportAccess(type)) return;

  document.getElementById('reportTable').innerHTML = '<div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>';

  try {
    const res = await API.getReport(type, getReportFilterParams());
    const data = res?.data || [];
    renderReportTable(type, data);
  } catch (err) {
    document.getElementById('reportTable').innerHTML = `<div class="empty-state">${err.message}</div>`;
  }
}

async function viewReport(type) {
  if (!ensureReportAccess(type)) return;

  const report = getReportConfig(type);
  activeReportType = type;
  document.getElementById('reportPreviewTitle').textContent = report.title;
  document.getElementById('reportPreview').style.display = 'block';
  await renderReportFilters(type);
  await loadReportData(type);
  document.getElementById('reportPreview').scrollIntoView({ behavior: 'smooth' });
}

function exportReportPDF(type) {
  if (!ensureReportAccess(type)) return;
  const params = activeReportType === type ? getReportFilterParams() : {};
  API.exportPDF(type, params);
}

function exportReportExcel(type) {
  if (!ensureReportAccess(type)) return;
  const params = activeReportType === type ? getReportFilterParams() : {};
  API.exportExcel(type, params);
}

function renderReportTable(type, data) {
  const el = document.getElementById('reportTable');
  if (!data.length) {
    el.innerHTML = '<div class="empty-state">No data available for the selected filters</div>';
    return;
  }

  let headers, rows;
  switch (type) {
    case 'inventory':
      headers = ['Code','Name','Department','Qty','Available','Status','Location'];
      rows = data.map(i => [i.item_code, i.item_name, i.department_name || i.category_name, i.quantity, i.available_quantity, i.status, i.location_name]);
      break;
    case 'borrow':
      headers = ['Code','Borrower','Department','Date','Status'];
      rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
      break;
    case 'return':
      headers = ['Code','Borrow Code','Processed By','Process Return Date','Condition'];
      rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition]);
      break;
    case 'low-stock':
      headers = ['Code','Name','Available','Threshold','Status'];
      rows = data.map(i => [i.item_code, i.item_name, i.available_quantity, i.low_stock_threshold, i.status]);
      break;
    case 'supplier':
      headers = ['Name','Contact','Phone','Email','Address'];
      rows = data.map(s => [s.name, s.contact_person, s.phone, s.email, s.address]);
      break;
    case 'transfers':
      headers = ['Code','Item','From Dept','To Dept','Status','Requested By'];
      rows = data.map(t => [t.transaction_code, t.item_name, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
      break;
    case 'maintenance':
      headers = ['Item','Type','Scheduled','Completed','Status','Provider'];
      rows = data.map(m => [m.item_name, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
      break;
    case 'disposals':
      headers = ['Code','Item','Qty','Method','Status','Requested By'];
      rows = data.map(d => [d.transaction_code, d.item_name, d.quantity, d.disposal_method, d.status, d.requested_by_name]);
      break;
    case 'departments':
      headers = ['Name','Code','Head','Custodian','Assets','Status'];
      rows = data.map(d => [d.name, d.code, d.department_head, d.custodian_name, d.asset_count, d.status]);
      break;
    case 'custodians':
      headers = ['Custodian', 'Email', 'Assigned Assets'];
      rows = data.map(c => [c.custodian_name, c.email, c.assigned_assets]);
      break;
    case 'asset-status':
      headers = ['Code','Name','Classification','Department','Status','Property Tag'];
      rows = data.map(i => [i.item_code, i.item_name, formatClassificationDisplay(i.asset_classification), i.department_name || i.category_name, i.status, i.property_tag]);
      break;
    default:
      el.innerHTML = '<div class="empty-state">Unsupported report type</div>';
      return;
  }

  el.innerHTML = `
    <table class="data-table" id="printableReport">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c || '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function printReport(type) {
  if (!ensureReportAccess(type)) return;
  viewReport(type).then(() => {
    setTimeout(() => {
      const content = document.getElementById('printableReport');
      if (!content) return;
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Report</title><style>body{font-family:Inter,sans-serif;padding:20px;color:#2d2d2d;}h2{font-family:Poppins,Inter,sans-serif;font-weight:800;letter-spacing:0.08em;line-height:1.35;color:#800000;}table{width:100%;border-collapse:collapse;table-layout:fixed;}th,td{border:1px solid #e8e8e4;padding:8px;text-align:left;vertical-align:top;word-break:break-word;overflow-wrap:break-word;line-height:1.35;}th{background:#f7f7f5;color:#800000;}</style></head><body><h2>CAVITE INSTITUTE PROPERTY MANAGEMENT SYSTEM</h2>${content.outerHTML}</body></html>`);
      win.document.close();
      win.print();
    }, 500);
  });
}

document.addEventListener('DOMContentLoaded', initReportsPage);
