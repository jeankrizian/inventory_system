let documents = [];
let documentsTableSelection = null;
let documentsPage = 1;
const DOCUMENTS_PAGE_SIZE = 25;
let documentsPagination = { total: 0, page: 1, limit: DOCUMENTS_PAGE_SIZE, totalPages: 1 };

async function initDocumentsPage() {
  const user = await initLayout('documents');
  if (!user) return;

  document.getElementById('pageContent').innerHTML = `
    <div class="page-header">
      <h1>Official Documents</h1>
      <p>Document history — preview, print, and download previously generated official documents</p>
      <p style="margin:8px 0 0;"><a href="/pages/reports.html" style="font-size:13px;color:var(--primary);text-decoration:none;"><i class="bi bi-arrow-left"></i> Back to Reports</a></p>
    </div>
    <div class="content-card">
      <div class="filters-bar">
        <input type="text" class="form-control-custom" id="searchInput" placeholder="Search by document number...">
        <select class="form-control-custom" id="filterType">
          <option value="">All Types</option>
          <option>PAR</option>
          <option>GRN</option>
          <option>RDF</option>
          <option>ABL</option>
          <option>RTF</option>
          <option>TRF</option>
        </select>
      </div>
      <div class="table-responsive" id="documentsTable">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
      <div id="documentsPaginationBar" class="filters-bar" style="display:none;justify-content:space-between;align-items:center;margin-top:16px;margin-bottom:0;">
        <span id="documentsPageInfo" style="font-size:13px;color:var(--text-muted);"></span>
        <div style="display:flex;gap:8px;align-items:center;">
          <button type="button" class="btn-outline-custom btn-sm-custom" id="documentsPrevPage">Previous</button>
          <button type="button" class="btn-outline-custom btn-sm-custom" id="documentsNextPage">Next</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('searchInput').addEventListener('input', debounce(() => {
    documentsPage = 1;
    loadDocuments();
  }, 300));
  document.getElementById('filterType').addEventListener('change', () => {
    documentsPage = 1;
    loadDocuments();
  });
  document.getElementById('documentsPrevPage')?.addEventListener('click', () => {
    if (documentsPage <= 1) return;
    documentsPage -= 1;
    loadDocuments();
  });
  document.getElementById('documentsNextPage')?.addEventListener('click', () => {
    if (documentsPage >= documentsPagination.totalPages) return;
    documentsPage += 1;
    loadDocuments();
  });
  initActionMenus();
  initDocumentsTableSelection();
  await loadDocuments();
  initSearchableSelects(document.getElementById('pageContent'));
}

async function loadDocuments() {
  const params = {
    page: documentsPage,
    limit: DOCUMENTS_PAGE_SIZE
  };
  const search = document.getElementById('searchInput')?.value;
  const type = document.getElementById('filterType')?.value;
  if (search) params.search = search;
  if (type) params.document_type = type;

  try {
    const res = await API.getDocuments(params);
    documents = res?.data || [];
    const pagination = res?.pagination || {};
    documentsPagination = {
      total: Number(pagination.total ?? documents.length),
      page: Number(pagination.page ?? documentsPage),
      limit: Number(pagination.limit ?? DOCUMENTS_PAGE_SIZE),
      totalPages: Number(pagination.totalPages ?? 1)
    };
    documentsPage = documentsPagination.page;

    if (!documents.length && documentsPagination.total > 0 && documentsPage > documentsPagination.totalPages) {
      documentsPage = documentsPagination.totalPages;
      return loadDocuments();
    }

    renderDocuments();
    renderDocumentsPagination();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderDocumentsPagination() {
  const bar = document.getElementById('documentsPaginationBar');
  const info = document.getElementById('documentsPageInfo');
  const prevBtn = document.getElementById('documentsPrevPage');
  const nextBtn = document.getElementById('documentsNextPage');
  if (!bar || !info || !prevBtn || !nextBtn) return;

  const { total, page, limit, totalPages } = documentsPagination;
  if (!total) {
    bar.style.display = 'none';
    return;
  }

  const start = (page - 1) * limit + 1;
  const end = Math.min(page * limit, total);
  info.textContent = `Showing ${start}–${end} of ${total}`;
  prevBtn.disabled = page <= 1;
  nextBtn.disabled = page >= totalPages;
  bar.style.display = 'flex';
}

function initDocumentsTableSelection() {
  documentsTableSelection = createTableSelection({
    container: 'documentsTable',
    getRowId: (doc) => doc.id,
    getVisibleRows: () => documents,
    bulkActions: [
      {
        id: 'download',
        label: 'Download Selected',
        icon: 'bi-file-pdf',
        onClick: bulkDownloadDocuments
      }
    ]
  });
}

function bulkDownloadDocuments(_ids, rows) {
  rows.forEach((doc) => API.downloadDocumentPdf(doc.id));
  showToast(`Started download for ${rows.length} document(s)`);
}

function renderDocumentActions(d) {
  return renderActionMenuCell(`document-actions-${d.id}`, [
    { label: 'View', icon: 'bi-eye', handler: `API.openDocumentPreview(${d.id})` },
    { label: 'Download PDF', icon: 'bi-file-pdf', handler: `API.downloadDocumentPdf(${d.id})` },
    { label: 'Print', icon: 'bi-printer', handler: `window.open('/pages/document-preview.html?id=${d.id}&print=1','_blank')` }
  ]);
}

function renderDocuments() {
  const el = document.getElementById('documentsTable');
  documentsTableSelection?.pruneHiddenSelections();

  if (!documents.length) {
    el.innerHTML = '<div class="empty-state"><i class="bi bi-file-earmark-text"></i>No documents found</div>';
    documentsTableSelection?.bindAfterRender(el);
    return;
  }

  el.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          ${documentsTableSelection?.renderCheckboxHeader() || ''}
          <th>Document No.</th><th>Type</th><th>Related Module</th><th>Generated By</th><th>Generated Date</th><th>Actions</th>
        </tr>
      </thead>
      <tbody>
        ${documents.map(d => `
          <tr${documentsTableSelection?.renderRowAttrs(d) || ''}>
            ${documentsTableSelection?.renderCheckboxCell(d) || ''}
            <td>${d.document_number}</td>
            <td>${d.document_type}</td>
            <td>${d.related_module || '-'} #${d.related_transaction_id || '-'}</td>
            <td>${d.generated_by_name || '-'}</td>
            <td>${formatDate(d.generated_at)}</td>
            <td>${renderDocumentActions(d)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
  finishTableRender(el);
  documentsTableSelection?.bindAfterRender(el);
}

document.addEventListener('DOMContentLoaded', initDocumentsPage);
