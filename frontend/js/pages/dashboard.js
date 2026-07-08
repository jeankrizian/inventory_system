let inventoryChart = null;
let categoryChart = null;

function renderStatsCard(id, title, cols = 4) {
  const colClass = cols === 2 ? 'cols-2' : '';
  return `
    <div class="stats-card">
      <div class="stats-card-title">${title}</div>
      <div class="stats-inner ${colClass}" id="${id}">
        <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
      </div>
    </div>`;
}

function chunkPairs(items) {
  const rows = [];
  for (let i = 0; i < items.length; i += 2) {
    rows.push(items.slice(i, i + 2));
  }
  return rows;
}

function buildStatsRows(user) {
  const statModules = [
    { key: 'personalBorrowStats', id: 'personalBorrowStats', title: getDashboardStatTitle(user, 'personalBorrowStats'), cols: 4 },
    { key: 'pendingApprovals', id: 'pendingApprovalsStats', title: getDashboardStatTitle(user, 'pendingApprovals'), cols: 4 },
    { key: 'inventoryStats', id: 'inventoryStats', title: getDashboardStatTitle(user, 'inventoryStats'), cols: 4 },
    { key: 'usersStats', id: 'usersStats', title: getDashboardStatTitle(user, 'usersStats'), cols: 2 },
    { key: 'transferStats', id: 'transferStats', title: getDashboardStatTitle(user, 'transferStats'), cols: 2 },
    { key: 'maintenanceStats', id: 'maintenanceStats', title: getDashboardStatTitle(user, 'maintenanceStats'), cols: 2 },
    { key: 'disposalStats', id: 'disposalStats', title: getDashboardStatTitle(user, 'disposalStats'), cols: 2 },
    { key: 'assetsNeedingAttention', id: 'attentionStats', title: getDashboardStatTitle(user, 'assetsNeedingAttention'), cols: 2 }
  ];

  const statCards = statModules
    .filter(({ key }) => canViewDashboardModule(user, key))
    .map(({ id, title, cols }) => renderStatsCard(id, title, cols));

  return chunkPairs(statCards).map(pair => `
    <div class="stats-row">
      ${pair.join('')}
    </div>`).join('');
}

function buildDashboardHtml(user) {
  const statsRows = buildStatsRows(user);

  const chartsHtml = canViewDashboardModule(user, 'charts') ? `
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
    </div>` : '';

  const tableCards = [];

  if (canViewDashboardModule(user, 'recentInventory')) {
    const inventoryTitle = isCustodian(user) ? 'Recent Assigned Assets' : 'Recent Inventory';
    tableCards.push(`
      <div class="table-card">
        <div class="table-card-header">
          <h3>${inventoryTitle}</h3>
          <a href="/pages/inventory.html" class="see-all-link">See All</a>
        </div>
        <div class="table-responsive" id="recentInventoryTable">
          <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
        </div>
      </div>`);
  }

  if (canViewDashboardModule(user, 'lowStock')) {
    tableCards.push(`
      <div class="table-card">
        <div class="table-card-header">
          <h3>Low Stock Items</h3>
          <a href="/pages/inventory.html?low_stock=true" class="see-all-link">See All</a>
        </div>
        <ul class="low-stock-list" id="lowStockList">
          <li class="loading-spinner"><i class="bi bi-arrow-repeat"></i></li>
        </ul>
      </div>`);
  }

  if (canViewDashboardModule(user, 'recentBorrows')) {
    const borrowTitle = isEmployee(user) ? 'My Borrow History' : 'Recent Borrow Transactions';
    tableCards.push(`
      <div class="table-card">
        <div class="table-card-header">
          <h3>${borrowTitle}</h3>
          <a href="/pages/orders.html" class="see-all-link">See All</a>
        </div>
        <div class="table-responsive" id="recentBorrowTable">
          <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
        </div>
      </div>`);
  }

  if (canViewDashboardModule(user, 'recentReturns')) {
    const returnTitle = isEmployee(user) ? 'My Returned Items' : 'Recent Process Return Transactions';
    const returnsSeeAllHref = canViewReturnHistory(user)
      ? '/pages/orders.html?tab=returns'
      : '/pages/orders.html';
    tableCards.push(`
      <div class="table-card">
        <div class="table-card-header">
          <h3>${returnTitle}</h3>
          <a href="${returnsSeeAllHref}" class="see-all-link">See All</a>
        </div>
        <div class="table-responsive" id="recentReturnTable">
          <div class="loading-spinner"><i class="bi bi-arrow-repeat"></i> Loading...</div>
        </div>
      </div>`);
  }

  const tablesRows = chunkPairs(tableCards).map(pair => `
    <div class="tables-row">
      ${pair.join('')}
    </div>`).join('');

  const activitiesHtml = canViewDashboardModule(user, 'activities') ? `
    <div class="table-card">
      <div class="table-card-header">
        <h3>${isCustodian(user) ? 'Recent Assigned Asset Activity' : isEmployee(user) ? 'My Recent Activity' : 'Recent Activities'}</h3>
      </div>
      <ul class="activity-list" id="activityList">
        <li class="loading-spinner"><i class="bi bi-arrow-repeat"></i></li>
      </ul>
    </div>` : '';

  return `
    <div class="page-header">
      <h1>Dashboard</h1>
      <p>${getDashboardSubtitle(user)}</p>
    </div>
    <div class="dashboard-grid">
      ${statsRows}
      ${chartsHtml}
      ${tablesRows}
      ${activitiesHtml}
    </div>
  `;
}

async function initDashboard() {
  const user = await initLayout('dashboard');
  if (!user) return;

  const pageContent = document.getElementById('pageContent');
  pageContent.innerHTML = buildDashboardHtml(user);

  loadDashboardData(user);
}

function statValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function renderStatItem(icon, iconClass, value, label) {
  return `
    <div class="stat-item">
      <div class="stat-icon ${iconClass}"><i class="bi ${icon}"></i></div>
      <div>
        <div class="stat-value">${statValue(value)}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>
  `;
}

async function loadDashboardData(user) {
  try {
    const res = await API.getDashboard();
    if (!res?.data) return;

    const { stats: rawStats, charts, tables, dashboardModules } = res.data;
    const stats = rawStats || {};
    const modules = dashboardModules || {};

    const show = (key) => modules[key] !== false && canViewDashboardModule(user, key);

    if (show('personalBorrowStats') && document.getElementById('personalBorrowStats')) {
      document.getElementById('personalBorrowStats').innerHTML = `
        ${renderStatItem('bi-journal-text', 'blue', stats.total_borrow_requests, 'Total Borrow Requests')}
        ${renderStatItem('bi-box-arrow-in-right', 'blue', stats.current_borrowed, 'Currently Borrowed')}
        ${renderStatItem('bi-hourglass-split', 'orange', stats.pending_borrows, 'Pending')}
        ${renderStatItem('bi-check-circle', 'green', stats.approved_borrows, 'Approved')}
        ${renderStatItem('bi-arrow-return-left', 'purple', stats.returned_items, 'Returned')}
        ${renderStatItem('bi-alarm', 'teal', stats.due_soon_borrows, 'Due Soon')}
        ${renderStatItem('bi-exclamation-triangle', 'red', stats.overdue_borrows, 'Overdue')}
      `;
    }

    if (show('pendingApprovals') && document.getElementById('pendingApprovalsStats')) {
      document.getElementById('pendingApprovalsStats').innerHTML = `
        ${renderStatItem('bi-hourglass-split', 'orange', stats.pending_borrows, 'Pending Borrows')}
        ${renderStatItem('bi-arrow-left-right', 'purple', stats.pending_transfers, 'Pending Transfers')}
        ${renderStatItem('bi-wrench', 'blue', stats.pending_maintenance, 'Pending Maintenance')}
        ${renderStatItem('bi-trash3', 'red', stats.pending_disposals, 'Pending Disposals')}
      `;
    }

    if (show('inventoryStats') && document.getElementById('inventoryStats')) {
      const assignedLabel = isCustodian(user) ? 'Assigned Assets' : 'Total Assets';
      const borrowedLabel = isCustodian(user) ? 'Borrowed Assets' : 'Borrowed';
      document.getElementById('inventoryStats').innerHTML = isCustodian(user) ? `
        ${renderStatItem('bi-box-seam', 'blue', stats.total_items, assignedLabel)}
        ${renderStatItem('bi-arrow-left-right', 'purple', stats.borrowed_items, borrowedLabel)}
        ${renderStatItem('bi-exclamation-triangle', 'red', stats.low_stock, 'Low Stock')}
        ${renderStatItem('bi-wrench-adjustable', 'orange', stats.under_maintenance, 'Under Maintenance')}
      ` : `
        ${renderStatItem('bi-box-seam', 'blue', stats.total_items, assignedLabel)}
        ${renderStatItem('bi-arrow-left-right', 'purple', stats.borrowed_items, borrowedLabel)}
        ${renderStatItem('bi-arrow-return-left', 'green', stats.returned_items, 'Returned')}
        ${renderStatItem('bi-exclamation-triangle', 'red', stats.low_stock, 'Low Stock')}
      `;
    }

    if (show('usersStats') && document.getElementById('usersStats')) {
      document.getElementById('usersStats').innerHTML = `
        ${renderStatItem('bi-people', 'blue', stats.total_users, 'Total Users')}
        ${renderStatItem('bi-person-check', 'green', stats.active_users, 'Active Users')}
      `;
    }

    if (show('transferStats') && document.getElementById('transferStats')) {
      const pendingLabel = isCustodian(user) ? 'Pending Transfers' : 'Pending Transfers';
      document.getElementById('transferStats').innerHTML = `
        ${renderStatItem('bi-truck', 'orange', stats.pending_transfers ?? 0, pendingLabel)}
        ${renderStatItem('bi-check-circle', 'green', stats.approved_transfers ?? 0, 'Approved Transfers')}
      `;
    }

    if (show('maintenanceStats') && document.getElementById('maintenanceStats')) {
      document.getElementById('maintenanceStats').innerHTML = `
        ${renderStatItem('bi-wrench', 'purple', stats.pending_maintenance ?? 0, 'Pending Maintenance')}
        ${renderStatItem('bi-tools', 'teal', stats.ongoing_maintenance ?? stats.under_maintenance ?? 0, 'Ongoing Maintenance')}
      `;
    }

    if (show('disposalStats') && document.getElementById('disposalStats')) {
      document.getElementById('disposalStats').innerHTML = `
        ${renderStatItem('bi-trash3', 'red', stats.pending_disposals ?? 0, 'Pending Disposal')}
        ${renderStatItem('bi-archive', 'orange', stats.disposed ?? 0, 'Disposed Assets')}
      `;
    }

    if (show('assetsNeedingAttention') && document.getElementById('attentionStats')) {
      document.getElementById('attentionStats').innerHTML = `
        ${renderStatItem('bi-wrench-adjustable', 'red', stats.maintenance_due ?? 0, 'Maintenance Due')}
        ${renderStatItem('bi-exclamation-triangle', 'orange', stats.low_stock ?? 0, 'Low Stock')}
      `;
    }

    if (show('charts')) {
      renderCharts(charts);
    }

    renderTables(tables, modules, user);
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
  if (!ctx1) return;

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
  if (!ctx2) return;

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

function renderTables(tables, modules = {}, user = null) {
  const show = (key) => modules[key] !== false && (!user || canViewDashboardModule(user, key));

  if (show('recentInventory') && document.getElementById('recentInventoryTable')) {
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
    ` : '<div class="empty-state"><i class="bi bi-box"></i>No inventory items found.</div>';
  }

  if (show('lowStock') && document.getElementById('lowStockList')) {
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
  }

  if (show('recentBorrows') && document.getElementById('recentBorrowTable')) {
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
    ` : '<div class="empty-state"><i class="bi bi-cart3"></i>No borrow requests found.</div>';
  }

  if (show('recentReturns') && document.getElementById('recentReturnTable')) {
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
    ` : '<div class="empty-state">No process return transactions</div>';
  }

  if (show('activities') && document.getElementById('activityList')) {
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
}

document.addEventListener('DOMContentLoaded', initDashboard);
