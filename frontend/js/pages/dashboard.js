let inventoryChart = null;
let categoryChart = null;

async function initDashboard() {
  const user = await initLayout('dashboard');
  if (!user) return;

  const pageContent = document.getElementById('pageContent');
  pageContent.innerHTML = `
    <div class="dashboard-grid">
      <div class="stats-row">
        <div class="stats-card">
          <div class="stats-card-title">Inventory Summary</div>
          <div class="stats-inner" id="inventoryStats">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">Users Summary</div>
          <div class="stats-inner cols-2" id="usersStats">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i></div>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stats-card">
          <div class="stats-card-title">Supplier Summary</div>
          <div class="stats-inner cols-2" id="supplierStats">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i></div>
          </div>
        </div>
        <div class="stats-card">
          <div class="stats-card-title">Category Summary</div>
          <div class="stats-inner cols-2" id="categoryStats">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i></div>
          </div>
        </div>
      </div>

      <div class="charts-row">
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Inventory Overview</h3>
            <button class="chart-period-btn">Monthly</button>
          </div>
          <div class="chart-container">
            <canvas id="inventoryChart"></canvas>
          </div>
        </div>
        <div class="chart-card">
          <div class="chart-card-header">
            <h3>Category Distribution</h3>
          </div>
          <div class="chart-container small">
            <canvas id="categoryChart"></canvas>
          </div>
        </div>
      </div>

      <div class="tables-row">
        <div class="table-card">
          <div class="table-card-header">
            <h3>Recent Inventory</h3>
            <a href="/pages/inventory.html" class="see-all-link">See All</a>
          </div>
          <div class="table-responsive" id="recentInventoryTable">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
          </div>
        </div>
        <div class="table-card">
          <div class="table-card-header">
            <h3>Low Stock Items</h3>
            <a href="/pages/inventory.html?low_stock=true" class="see-all-link">See All</a>
          </div>
          <ul class="low-stock-list" id="lowStockList">
            <li class="loading-spinner"><i class="bi bi-arrow-repeat"></i></li>
          </ul>
        </div>
      </div>

      <div class="tables-row">
        <div class="table-card">
          <div class="table-card-header">
            <h3>Recent Borrow Transactions</h3>
            <a href="/pages/orders.html" class="see-all-link">See All</a>
          </div>
          <div class="table-responsive" id="recentBorrowTable">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i></div>
          </div>
        </div>
        <div class="table-card">
          <div class="table-card-header">
            <h3>Recent Return Transactions</h3>
            <a href="/pages/orders.html?tab=returns" class="see-all-link">See All</a>
          </div>
          <div class="table-responsive" id="recentReturnTable">
            <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i></div>
          </div>
        </div>
      </div>

      <div class="table-card">
        <div class="table-card-header">
          <h3>Recent Activities</h3>
        </div>
        <ul class="activity-list" id="activityList">
          <li class="loading-spinner"><i class="bi bi-arrow-repeat"></i></li>
        </ul>
      </div>
    </div>
  `;

  loadDashboardData();
}

function renderStatItem(icon, iconClass, value, label) {
  return `
    <div class="stat-item">
      <div class="stat-icon ${iconClass}"><i class="bi ${icon}"></i></div>
      <div>
        <div class="stat-value">${value}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

async function loadDashboardData() {
  try {
    const res = await API.getDashboard();
    if (!res?.data) return;

    const { stats, charts, tables } = res.data;

    document.getElementById('inventoryStats').innerHTML = `
      ${renderStatItem('bi-box-seam', 'blue', stats.total_items, 'Total Assets')}
      ${renderStatItem('bi-arrow-left-right', 'purple', stats.borrowed_items, 'Borrowed')}
      ${renderStatItem('bi-arrow-return-left', 'green', stats.returned_items, 'Returned')}
      ${renderStatItem('bi-exclamation-triangle', 'red', stats.low_stock, 'Low Stock')}
    `;

    document.getElementById('usersStats').innerHTML = `
      ${renderStatItem('bi-people', 'blue', stats.total_users, 'Total Users')}
      ${renderStatItem('bi-trash', 'orange', stats.disposed || 0, 'Disposed')}
    `;

    document.getElementById('supplierStats').innerHTML = `
      ${renderStatItem('bi-truck', 'orange', stats.pending_transfers ?? 0, 'Pending Transfers')}
      ${renderStatItem('bi-check-circle', 'green', stats.approved_transfers ?? 0, 'Approved Transfers')}
    `;

    document.getElementById('categoryStats').innerHTML = `
      ${renderStatItem('bi-wrench', 'purple', stats.pending_maintenance ?? 0, 'Pending Maintenance')}
      ${renderStatItem('bi-tools', 'teal', stats.ongoing_maintenance ?? stats.under_maintenance ?? 0, 'Ongoing Maintenance')}
    `;

    renderCharts(charts);
    renderTables(tables);
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function renderCharts(charts) {
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  const borrowedMap = {};
  const returnedMap = {};
  (charts.monthlyBorrowed || []).forEach(d => { borrowedMap[d.month] = d.count; });
  (charts.monthlyReturned || []).forEach(d => { returnedMap[d.month] = d.count; });

  const labels = [...new Set([...Object.keys(borrowedMap), ...Object.keys(returnedMap)])];
  if (labels.length === 0) labels.push(...months.slice(0, 6));

  const ctx1 = document.getElementById('inventoryChart');
  if (inventoryChart) inventoryChart.destroy();
  inventoryChart = new Chart(ctx1, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Borrowed', data: labels.map(l => borrowedMap[l] || 0), backgroundColor: '#800000', borderRadius: 6, barPercentage: 0.6 },
        { label: 'Returned', data: labels.map(l => returnedMap[l] || 0), backgroundColor: '#556B2F', borderRadius: 6, barPercentage: 0.6 }
      ]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20, font: { size: 12 } } } },
      scales: {
        y: { beginAtZero: true, grid: { color: '#e8e8e4' }, ticks: { stepSize: 1 } },
        x: { grid: { display: false } }
      }
    }
  });

  const catData = charts.categoryDistribution || charts.departmentDistribution || [];
  const ctx2 = document.getElementById('categoryChart');
  if (categoryChart) categoryChart.destroy();
  categoryChart = new Chart(ctx2, {
    type: 'doughnut',
    data: {
      labels: catData.map(c => c.category || c.department),
      datasets: [{
        data: catData.map(c => c.count),
        backgroundColor: ['#800000', '#556B2F', '#b0b0b0', '#993333', '#6B7F4A', '#d0d0d0'],
        borderWidth: 0
      }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'bottom', labels: { usePointStyle: true, padding: 12, font: { size: 11 } } } },
      cutout: '65%'
    }
  });
}

function renderTables(tables) {
  const invRows = (tables.recentInventory || []).map(i => `
    <tr>
      <td>${i.item_code}</td>
      <td>${i.item_name}</td>
      <td>${i.category || i.department || '-'}</td>
      <td>${i.quantity}</td>
      <td>${getStatusBadge(i.status)}</td>
    </tr>
  `).join('');

  document.getElementById('recentInventoryTable').innerHTML = invRows ? `
    <table class="data-table">
      <thead><tr><th>Item Code</th><th>Item Name</th><th>Category</th><th>Quantity</th><th>Status</th></tr></thead>
      <tbody>${invRows}</tbody>
    </table>
  ` : '<div class="empty-state">No inventory items yet</div>';

  const lowStock = tables.lowStock || [];
  document.getElementById('lowStockList').innerHTML = lowStock.length ? lowStock.map(item => `
    <li class="low-stock-item">
      <div class="low-stock-icon"><i class="bi bi-box"></i></div>
      <div class="low-stock-info">
        <div class="name">${item.item_name}</div>
        <div class="qty">Remaining Quantity: ${item.available_quantity} ${item.category ? '· ' + item.category : ''}</div>
      </div>
      <span class="badge-low">Low</span>
    </li>
  `).join('') : '<li class="empty-state">No low stock items</li>';

  const borrowRows = (tables.recentBorrows || []).map(b => `
    <tr>
      <td>${b.transaction_code}</td>
      <td>${b.borrower_name}</td>
      <td>${formatDate(b.borrow_date)}</td>
      <td>${getStatusBadge(b.status)}</td>
    </tr>
  `).join('');

  document.getElementById('recentBorrowTable').innerHTML = borrowRows ? `
    <table class="data-table">
      <thead><tr><th>Code</th><th>Borrower</th><th>Date</th><th>Status</th></tr></thead>
      <tbody>${borrowRows}</tbody>
    </table>
  ` : '<div class="empty-state">No borrow transactions</div>';

  const returnRows = (tables.recentReturns || []).map(r => `
    <tr>
      <td>${r.transaction_code}</td>
      <td>${r.borrower_name}</td>
      <td>${formatDate(r.return_date)}</td>
      <td>${getStatusBadge(r.condition)}</td>
    </tr>
  `).join('');

  document.getElementById('recentReturnTable').innerHTML = returnRows ? `
    <table class="data-table">
      <thead><tr><th>Code</th><th>Borrower</th><th>Date</th><th>Condition</th></tr></thead>
      <tbody>${returnRows}</tbody>
    </table>
  ` : '<div class="empty-state">No return transactions</div>';

  const activities = tables.recentActivities || [];
  document.getElementById('activityList').innerHTML = activities.length ? activities.map(a => `
    <li class="activity-item">
      <span class="activity-dot"></span>
      <div>
        <strong>${a.user_name || 'System'}</strong> — ${a.description}
        <div style="font-size:11px;color:#8a8a8a;margin-top:2px;">${formatDate(a.created_at)} · ${a.module}</div>
      </div>
    </li>
  `).join('') : '<li class="empty-state">No recent activities</li>';
}

document.addEventListener('DOMContentLoaded', initDashboard);
