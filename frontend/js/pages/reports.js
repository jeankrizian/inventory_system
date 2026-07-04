const REPORTS = [
  { type: 'inventory', title: 'Inventory Report', desc: 'Complete list of all inventory items with stock levels and status', icon: 'bi-box-seam' },
  { type: 'borrow', title: 'Borrow Report', desc: 'All borrow transactions with borrower details and status', icon: 'bi-cart3' },
  { type: 'return', title: 'Process Return Report', desc: 'All process return transactions with condition and notes', icon: 'bi-arrow-return-left' },
  { type: 'low-stock', title: 'Low Stock Report', desc: 'Items below their low stock threshold', icon: 'bi-exclamation-triangle' },
  { type: 'supplier', title: 'Supplier Report', desc: 'Complete supplier directory with contact information', icon: 'bi-truck' },
  { type: 'transfers', title: 'Transfer Report', desc: 'Asset movement and transfer request history', icon: 'bi-arrow-left-right' },
  { type: 'maintenance', title: 'Maintenance Report', desc: 'Preventive and corrective maintenance records', icon: 'bi-tools' },
  { type: 'disposals', title: 'Disposal Report', desc: 'Disposal requests, inspections, and approvals', icon: 'bi-trash3' },
  { type: 'departments', title: 'Department Report', desc: 'Departments with custodians and asset counts', icon: 'bi-building' },
  { type: 'custodians', title: 'Custodian Report', desc: 'Custodian assignments and asset responsibilities', icon: 'bi-person-badge' },
  { type: 'asset-status', title: 'Asset Status Report', desc: 'Full asset status overview with classifications', icon: 'bi-clipboard-data' },
  { type: 'documents', title: 'Official Documents', desc: 'PAR, GRN, and RDF document history with preview and PDF export', icon: 'bi-file-earmark-text', link: '/pages/documents.html' }
];

async function initReportsPage() {
  const user = await initLayout('reports');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Reports</h1>
      <p>Generate, view, and export inventory reports</p>
    </div>
    <div class="report-grid" id="reportGrid">
      ${REPORTS.map(r => `
        <div class="report-card">
          <h4><i class="bi ${r.icon}" style="color:var(--primary);margin-right:8px;"></i>${r.title}</h4>
          <p>${r.desc}</p>
          <div class="report-actions">
            ${r.link
    ? `<a class="btn-outline-custom btn-sm-custom" href="${r.link}"><i class="bi bi-eye"></i> Open</a>`
    : `<button class="btn-outline-custom btn-sm-custom" onclick="viewReport('${r.type}')"><i class="bi bi-eye"></i> View</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="API.exportPDF('${r.type}')"><i class="bi bi-file-pdf"></i> PDF</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="API.exportExcel('${r.type}')"><i class="bi bi-file-excel"></i> Excel</button>
            <button class="btn-outline-custom btn-sm-custom" onclick="printReport('${r.type}')"><i class="bi bi-printer"></i> Print</button>`}
          </div>
        </div>
      `).join('')}
    </div>
    <div class="content-card" id="reportPreview" style="display:none;">
      <div class="content-card-header">
        <h3 id="reportPreviewTitle">Report Preview</h3>
        <button class="btn-outline-custom btn-sm-custom" onclick="document.getElementById('reportPreview').style.display='none'">
          <i class="bi bi-x"></i> Close
        </button>
      </div>
      <div class="table-responsive" id="reportTable"></div>
    </div>
  `;
}

async function viewReport(type) {
  const report = REPORTS.find(r => r.type === type);
  document.getElementById('reportPreviewTitle').textContent = report.title;
  document.getElementById('reportPreview').style.display = 'block';
  document.getElementById('reportTable').innerHTML = '<div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>';

  try {
    const res = await API.getReport(type);
    const data = res?.data || [];
    renderReportTable(type, data);
    document.getElementById('reportPreview').scrollIntoView({ behavior: 'smooth' });
  } catch (err) { showToast(err.message, 'error'); }
}

function renderReportTable(type, data) {
  const el = document.getElementById('reportTable');
  if (!data.length) {
    el.innerHTML = '<div class="empty-state">No data available</div>';
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
      headers = ['Custodian','Email','Type','Assigned Assets'];
      rows = data.map(c => [c.custodian_name, c.email, c.custodian_type, c.assigned_assets]);
      break;
    case 'asset-status':
      headers = ['Code','Name','Classification','Department','Status','Property Tag'];
      rows = data.map(i => [i.item_code, i.item_name, normalizeAssetClassification(i.asset_classification), i.department_name || i.category_name, i.status, i.property_tag]);
      break;
  }

  el.innerHTML = `
    <table class="data-table" id="printableReport">
      <thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${r.map(c => `<td>${c || '-'}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function printReport(type) {
  viewReport(type).then(() => {
    setTimeout(() => {
      const content = document.getElementById('printableReport');
      if (!content) return;
      const win = window.open('', '_blank');
      win.document.write(`<html><head><title>Report</title><style>body{font-family:Inter,sans-serif;padding:20px;color:#2d2d2d;}h2{font-family:Poppins,Inter,sans-serif;font-weight:800;letter-spacing:0.08em;line-height:1.35;color:#800000;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #e8e8e4;padding:8px;text-align:left;}th{background:#f7f7f5;color:#800000;}</style></head><body><h2>CAVITE INSTITUTE PROPERTY MANAGEMENT SYSTEM</h2>${content.outerHTML}</body></html>`);
      win.document.close();
      win.print();
    }, 500);
  });
}

document.addEventListener('DOMContentLoaded', initReportsPage);
