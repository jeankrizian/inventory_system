const REPORTS = [
  { type: 'inventory', title: 'Inventory Report', desc: 'Complete list of all inventory assets with property tags and status', icon: 'bi-box-seam', hasFilters: true },
  { type: 'borrow', title: 'Borrow Report', desc: 'All borrow transactions with borrower details and status', icon: 'bi-cart3', hasFilters: true },
  { type: 'return', title: 'Process Return Report', desc: 'All process return transactions with condition and notes', icon: 'bi-arrow-return-left', hasFilters: true },
  { type: 'supplier', title: 'Supplier Report', desc: 'Complete supplier directory with contact information', icon: 'bi-truck', hasFilters: true },
  { type: 'transfers', title: 'Transfer Report', desc: 'Asset movement and transfer request history', icon: 'bi-arrow-left-right', hasFilters: true },
  { type: 'maintenance', title: 'Maintenance Report', desc: 'Preventive and corrective maintenance records', icon: 'bi-tools', hasFilters: true },
  { type: 'disposals', title: 'Disposal Report', desc: 'Disposal requests, inspections, and approvals', icon: 'bi-trash3', hasFilters: true },
  { type: 'departments', title: 'Department Report', desc: 'Departments with custodians and asset counts', icon: 'bi-building', hasFilters: true },
  { type: 'custodians', title: 'Custodian Report', desc: 'Custodian assignments and asset responsibilities', icon: 'bi-person-badge', hasFilters: true },
  { type: 'asset-status', title: 'Asset Status Report', desc: 'Full asset status overview with classifications', icon: 'bi-clipboard-data', hasFilters: true },
  { type: 'documents', title: 'Official Documents', desc: 'Document history for PAR, GRN, RDF, and other generated forms — preview, print, and download PDF', icon: 'bi-file-earmark-text', link: '/pages/documents.html' }
];

const REPORT_FILTER_FIELD_IDS = [
  'reportSearchInput',
  'reportFilterDepartment',
  'reportFilterLocation',
  'reportFilterClassification',
  'reportFilterStatus'
];

let activeReportType = null;
let currentUser = null;
let departments = [];
let locations = [];
let lastReportFilterParams = {};
let reportPage = 1;
let reportPagination = { total: 0, page: 1, limit: 25, totalPages: 1 };

const REPORT_PAGE_SIZE = 25;
const PAGINATED_REPORT_TYPES = new Set([
  'inventory',
  'asset-status',
  'borrow',
  'return',
  'supplier',
  'transfers',
  'maintenance',
  'disposals',
  'departments',
  'custodians'
]);

function getVisibleReports(user) {
  return REPORTS.filter((report) => canAccessReportType(user, report.type));
}

function denyReportAccess(type) {
  showToast('You do not have permission to access this report.', 'error');
}

function getReportConfig(type) {
  return REPORTS.find(r => r.type === type);
}

function getReportFilterParams() {
  const params = {};
  const search = document.getElementById('reportSearchInput')?.value?.trim();
  const department = document.getElementById('reportFilterDepartment')?.value;
  const location = document.getElementById('reportFilterLocation')?.value;
  const classification = document.getElementById('reportFilterClassification')?.value;
  const status = document.getElementById('reportFilterStatus')?.value;

  if (search) params.search = search;
  if (department) {
    const departmentId = parseInt(department, 10);
    if (!Number.isNaN(departmentId)) params.department_id = departmentId;
  }
  if (location) {
    const locationId = parseInt(location, 10);
    if (!Number.isNaN(locationId)) params.location_id = locationId;
  }
  if (classification) params.asset_classification = classification;
  if (status) params.status = status;

  return params;
}

function getExportParams(type) {
  const previewOpen = document.getElementById('reportPreview')?.style.display !== 'none';
  if (activeReportType === type && previewOpen) {
    return getReportFilterParams();
  }
  return lastReportFilterParams[type] || {};
}

function clearReportFilters() {
  REPORT_FILTER_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });

  if (typeof refreshSearchableSelects === 'function') {
    refreshSearchableSelects(
      REPORT_FILTER_FIELD_IDS
        .map((id) => document.getElementById(id))
        .filter((el) => el && el.tagName === 'SELECT')
    );
  }
}

async function loadReportFilterData() {
  const [deptRes, locRes] = await Promise.allSettled([
    API.getCategories(),
    API.getLocations()
  ]);

  if (deptRes.status === 'fulfilled' && Array.isArray(deptRes.value?.data)) {
    departments = deptRes.value.data;
  }
  if (locRes.status === 'fulfilled' && Array.isArray(locRes.value?.data)) {
    locations = locRes.value.data;
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

  if (!departments.length || !locations.length) {
    await loadReportFilterData();
  }

  const classificationOptions = (typeof getFilterClassifications === 'function'
    ? getFilterClassifications()
    : ['Semi-Durable', 'Durable']
  ).map((c) => `<option value="${c}">${c}</option>`).join('');

  const deptOptions = departments.map((d) => `<option value="${d.id}">${d.name}</option>`).join('');
  const locationOptions = locations.map((l) => `<option value="${l.id}">${l.name}</option>`).join('');

  // Match Inventory filters-bar layout and controls.
  bar.style.display = '';
  bar.style.gridTemplateColumns = '';
  bar.style.gap = '';
  bar.style.alignItems = '';

  bar.innerHTML = `
    <input type="text" class="form-control-custom" id="reportSearchInput" placeholder="Search items...">
    <select class="form-control-custom" id="reportFilterDepartment">
      <option value="">All Departments</option>
      ${deptOptions}
    </select>
    <select class="form-control-custom" id="reportFilterLocation">
      <option value="">All Locations</option>
      ${locationOptions}
    </select>
    <select class="form-control-custom" id="reportFilterClassification">
      <option value="">All Classifications</option>
      ${classificationOptions}
    </select>
    <select class="form-control-custom" id="reportFilterStatus">
      <option value="">All Status</option>
      <option>Available</option>
      <option>Borrowed</option>
      <option>Under Maintenance</option>
      <option>Disposed</option>
    </select>
    <button type="button" class="btn-outline-custom btn-sm-custom" id="reportClearFilters">Clear Filters</button>
  `;

  const reloadReport = () => loadReportData(type, { resetPage: true });
  const debouncedReload = debounce(reloadReport, 300);

  document.getElementById('reportClearFilters')?.addEventListener('click', () => {
    clearReportFilters();
    reloadReport();
  });

  document.getElementById('reportSearchInput')?.addEventListener('input', debouncedReload);
  document.getElementById('reportFilterDepartment')?.addEventListener('change', reloadReport);
  document.getElementById('reportFilterLocation')?.addEventListener('change', reloadReport);
  document.getElementById('reportFilterClassification')?.addEventListener('change', reloadReport);
  document.getElementById('reportFilterStatus')?.addEventListener('change', reloadReport);

  initSearchableSelects(bar);
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
    ? `<a class="btn-outline-custom btn-sm-custom" href="${r.link}"><i class="bi bi-folder2-open"></i> Document History</a>`
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
      <div id="reportSummary"></div>
      <div class="table-responsive" id="reportTable"></div>
      <div id="reportPaginationBar" class="filters-bar" style="display:none;justify-content:space-between;align-items:center;margin-top:16px;margin-bottom:0;">
        <span id="reportPageInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn-outline-custom btn-sm-custom" id="reportPrevPage">Previous</button>
          <button type="button" class="btn-outline-custom btn-sm-custom" id="reportNextPage">Next</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('reportPrevPage')?.addEventListener('click', () => {
    if (reportPage <= 1 || !activeReportType) return;
    reportPage -= 1;
    loadReportData(activeReportType);
  });
  document.getElementById('reportNextPage')?.addEventListener('click', () => {
    if (!activeReportType || reportPage >= reportPagination.totalPages) return;
    reportPage += 1;
    loadReportData(activeReportType);
  });
}

function ensureReportAccess(type) {
  if (!canAccessReportType(currentUser, type)) {
    denyReportAccess(type);
    return false;
  }
  return true;
}

function normalizeReportPayload(data) {
  if (Array.isArray(data)) {
    return { rows: data, summary: null };
  }
  return {
    rows: Array.isArray(data?.rows) ? data.rows : [],
    summary: data?.summary || null
  };
}

function formatReportSummaryDate(value) {
  if (!value) return '—';
  return formatDate(value) || value;
}

function renderBreakdownList(breakdown = {}) {
  const entries = Object.entries(breakdown);
  if (!entries.length) return '<span>—</span>';
  return entries.map(([label, count]) => `<span style="margin-right:12px;">${label}: <strong>${count}</strong></span>`).join('');
}

function renderReportSummary(summary) {
  const el = document.getElementById('reportSummary');
  if (!el) return;

  if (!summary) {
    el.innerHTML = '';
    el.style.display = 'none';
    return;
  }

  const dateRange = summary.date_range
    ? `${summary.date_range.from || '—'} to ${summary.date_range.to || '—'}`
    : 'All dates';

  el.style.display = 'block';
  el.innerHTML = `
    <div class="asset-detail-summary" style="margin-bottom:16px;">
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Generated</div>
        <div style="font-weight:500;">${formatReportSummaryDate(summary.generated_at)}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Total Records</div>
        <div style="font-weight:600;font-size:15px;">${summary.total_records ?? 0}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Department</div>
        <div style="font-weight:500;">${summary.department || 'All Departments'}</div>
      </div>
      <div>
        <div style="font-size:11px;text-transform:uppercase;letter-spacing:0.04em;color:var(--text-muted,#666);margin-bottom:4px;">Date Range</div>
        <div style="font-weight:500;">${dateRange}</div>
      </div>
    </div>
    <div style="margin-bottom:16px;padding:12px 16px;background:var(--gray-light,#f5f5f5);border-radius:8px;border:1px solid var(--border-color,#e5e5e5);">
      <div style="font-size:12px;font-weight:600;margin-bottom:6px;">Status Breakdown</div>
      <div style="font-size:13px;line-height:1.6;">${renderBreakdownList(summary.status_breakdown)}</div>
      <div style="font-size:12px;font-weight:600;margin:12px 0 6px;">Department Breakdown</div>
      <div style="font-size:13px;line-height:1.6;">${renderBreakdownList(summary.department_breakdown)}</div>
      ${summary.total_assigned_assets != null ? `<div style="font-size:12px;margin-top:10px;">Total Assigned Assets: <strong>${summary.total_assigned_assets}</strong></div>` : ''}
      ${summary.total_assets != null ? `<div style="font-size:12px;margin-top:10px;">Total Department Assets: <strong>${summary.total_assets}</strong></div>` : ''}
    </div>
  `;
}

async function loadReportData(type, options = {}) {
  if (!ensureReportAccess(type)) return;

  if (options.resetPage) reportPage = 1;

  document.getElementById('reportTable').innerHTML = '<div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>';
  document.getElementById('reportSummary').innerHTML = '';

  try {
    const params = getReportFilterParams();
    lastReportFilterParams[type] = { ...params };
    if (PAGINATED_REPORT_TYPES.has(type)) {
      params.page = reportPage;
      params.limit = REPORT_PAGE_SIZE;
    }

    const res = await API.getReport(type, params);
    const { rows, summary } = normalizeReportPayload(res?.data);

    if (PAGINATED_REPORT_TYPES.has(type)) {
      const pagination = res?.pagination || {};
      reportPagination = {
        total: Number(pagination.total ?? summary?.total_records ?? rows.length),
        page: Number(pagination.page ?? reportPage),
        limit: Number(pagination.limit ?? REPORT_PAGE_SIZE),
        totalPages: Number(pagination.totalPages ?? 1)
      };
      reportPage = reportPagination.page;

      if (!rows.length && reportPagination.total > 0 && reportPage > reportPagination.totalPages) {
        reportPage = reportPagination.totalPages;
        return loadReportData(type);
      }
    } else {
      reportPagination = { total: 0, page: 1, limit: REPORT_PAGE_SIZE, totalPages: 1 };
    }

    renderReportSummary(summary);
    renderReportTable(type, rows);
    renderReportPagination(type);
  } catch (err) {
    document.getElementById('reportSummary').innerHTML = '';
    document.getElementById('reportTable').innerHTML = `<div class="empty-state">${err.message}</div>`;
    const bar = document.getElementById('reportPaginationBar');
    if (bar) bar.style.display = 'none';
  }
}

function renderReportPagination(type) {
  const bar = document.getElementById('reportPaginationBar');
  const info = document.getElementById('reportPageInfo');
  const prevBtn = document.getElementById('reportPrevPage');
  const nextBtn = document.getElementById('reportNextPage');
  if (!bar || !info || !prevBtn || !nextBtn) return;

  if (!PAGINATED_REPORT_TYPES.has(type) || !reportPagination.total) {
    bar.style.display = 'none';
    return;
  }

  const { total, page, limit, totalPages } = reportPagination;
  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  info.textContent = `Showing ${start}–${end} of ${total}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  bar.style.display = 'flex';
}

async function viewReport(type) {
  if (!ensureReportAccess(type)) return;

  const report = getReportConfig(type);
  activeReportType = type;
  reportPage = 1;
  document.getElementById('reportPreviewTitle').textContent = report.title;
  document.getElementById('reportPreview').style.display = 'block';
  await renderReportFilters(type);
  await loadReportData(type, { resetPage: true });
  document.getElementById('reportPreview').scrollIntoView({ behavior: 'smooth' });
}

function exportReportPDF(type) {
  if (!ensureReportAccess(type)) return;
  API.exportPDF(type, getExportParams(type));
}

function exportReportExcel(type) {
  if (!ensureReportAccess(type)) return;
  API.exportExcel(type, getExportParams(type));
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
      headers = ['Code','Name','Property Tag','Batch ID','Department','Status','Location','Unit Cost'];
      rows = data.map(i => [i.item_code, i.item_name, i.property_tag, i.batch_id, i.department_name || i.category_name, i.status, i.location_name, i.unit_cost]);
      break;
    case 'borrow':
      headers = ['Code','Borrower','Department','Date','Status'];
      rows = data.map(b => [b.transaction_code, b.borrower_name, b.borrower_department, b.borrow_date, b.status]);
      break;
    case 'return':
      headers = ['Code','Borrow Code','Processed By','Process Return Date','Condition'];
      rows = data.map(r => [r.transaction_code, r.borrow_code, r.returned_by_name, r.return_date, r.condition]);
      break;
    case 'supplier':
      headers = ['Name','Contact','Phone','Email','Address'];
      rows = data.map(s => [s.name, s.contact_person, s.phone, s.email, s.address]);
      break;
    case 'transfers':
      headers = ['Code','Item','Property Tag','From Dept','To Dept','Status','Requested By'];
      rows = data.map(t => [t.transaction_code, t.item_name, t.property_tag, t.from_department_name, t.to_department_name, t.status, t.requested_by_name]);
      break;
    case 'maintenance':
      headers = ['Item','Property Tag','Type','Scheduled','Completed','Status','Provider'];
      rows = data.map(m => [m.item_name, m.property_tag, m.maintenance_type, m.scheduled_date, m.completed_date, m.status, m.service_provider]);
      break;
    case 'disposals':
      headers = ['Code','Item','Property Tag','Qty','Method','Status','Requested By'];
      rows = data.map(d => [d.transaction_code, d.item_name, d.property_tag, d.quantity, d.disposal_method, d.status, d.requested_by_name]);
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
  finishTableRender(el);
}

function printReport(type) {
  if (!ensureReportAccess(type)) return;
  viewReport(type).then(() => {
    setTimeout(() => {
      const summary = document.getElementById('reportSummary');
      const content = document.getElementById('printableReport');
      if (!content) return;
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Report</title><style>body{font-family:Inter,sans-serif;padding:20px;color:#2d2d2d;}h2{font-family:Poppins,Inter,sans-serif;font-weight:800;letter-spacing:0.08em;line-height:1.35;color:#800000;}table{width:100%;border-collapse:collapse;table-layout:fixed;}th,td{border:1px solid #e8e8e4;padding:8px;text-align:left;vertical-align:top;word-break:break-word;overflow-wrap:break-word;line-height:1.35;}th{background:#f7f7f5;color:#800000;}</style></head><body><h2>CAVITE INSTITUTE PROPERTY MANAGEMENT SYSTEM</h2>${summary ? summary.innerHTML : ''}${content.outerHTML}</body></html>`);
      win.document.close();
      win.print();
    }, 500);
  });
}

document.addEventListener('DOMContentLoaded', initReportsPage);
