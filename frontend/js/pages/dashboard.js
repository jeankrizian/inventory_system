const chartInstances = {};

const CHART_COLORS = ['#800000', '#556B2F', '#993333', '#6B7F4A', '#b0b0b0', '#d0d0d0', '#660000', '#445525'];

const MAX_RECENT_ACTIVITIES = 8;

function destroyChart(key) {
  if (chartInstances[key]) {
    chartInstances[key].destroy();
    delete chartInstances[key];
  }
}

function destroyAllCharts() {
  Object.keys(chartInstances).forEach(destroyChart);
}

function statValue(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function getGreetingName(user) {
  const name = (user?.full_name || '').trim();
  if (!name) return 'there';
  return name.split(/\s+/)[0];
}

function renderSkeletonCards(count, type = 'summary') {
  return Array.from({ length: count }, () => `
    <div class="skeleton-card skeleton-card--${type}" aria-hidden="true">
      <div class="skeleton skeleton-icon"></div>
      <div class="skeleton skeleton-line skeleton-line--sm"></div>
      <div class="skeleton skeleton-line skeleton-line--lg"></div>
      <div class="skeleton skeleton-line skeleton-line--md"></div>
    </div>
  `).join('');
}

const EMPTY_SECTION_MESSAGE = 'No data available yet.';

function renderDashboardEmpty() {
  return `
    <div class="dashboard-empty-chart dashboard-empty-chart--inline">
      <i class="bi bi-inbox"></i>
      <p>${EMPTY_SECTION_MESSAGE}</p>
    </div>
  `;
}

function removeDashboardNode(id) {
  document.getElementById(id)?.remove();
}

function getDashboardSectionOrder(user) {
  if (isAdministrator(user)) {
    return ['schoolOverview', 'assetOverview', 'analytics', 'activities'];
  }
  if (isPropertyManager(user)) {
    return ['pendingApprovals', 'assetOverview', 'analytics', 'activities'];
  }
  if (isCustodian(user)) {
    return ['pendingApprovals', 'assetOverview', 'activities'];
  }
  return ['assetOverview', 'activities'];
}

const CHART_DEFINITIONS = {
  borrowReturn: {
    id: 'borrowReturnCard',
    canvasId: 'borrowReturnChart',
    module: 'borrowTrendsChart',
    title: 'Borrowing Trends'
  },
  departmentDist: {
    id: 'departmentDistCard',
    canvasId: 'departmentChart',
    module: 'departmentChart',
    title: 'Assets by Department'
  },
  statusPie: {
    id: 'statusPieCard',
    canvasId: 'statusPieChart',
    module: 'assetStatusChart',
    title: 'Asset Status'
  },
  maintenanceTrend: {
    id: 'maintenanceTrendCard',
    canvasId: 'maintenanceTrendChart',
    module: 'maintenanceTrendChart',
    title: 'Maintenance Trend'
  }
};

function getVisibleChartKeys(user) {
  return Object.entries(CHART_DEFINITIONS)
    .filter(([, def]) => canViewDashboardModule(user, def.module))
    .map(([key]) => key);
}

function renderChartCard(def) {
  return `
    <div class="chart-card" id="${def.id}">
      <div class="chart-card-header">
        <h3>${def.title}</h3>
      </div>
      <div class="chart-container chart-container--compact">
        <canvas id="${def.canvasId}"></canvas>
      </div>
    </div>
  `;
}

function renderSectionHeader(title) {
  return `
    <div class="dashboard-section-header">
      <h2>${title}</h2>
    </div>
  `;
}

function renderSummaryCard({ icon, accent = 'primary', title, value, href = null }) {
  const content = `
    <div class="summary-card-accent summary-card-accent--${accent}"></div>
    <div class="summary-card-body">
      <div class="summary-card-icon summary-card-icon--${accent}">
        <i class="bi ${icon}"></i>
      </div>
      <div class="summary-card-content">
        <span class="summary-card-title">${title}</span>
        <span class="summary-card-value">${statValue(value)}</span>
      </div>
    </div>
  `;

  if (href) {
    return `<a class="summary-card summary-card--link" href="${href}">${content}</a>`;
  }
  return `<div class="summary-card">${content}</div>`;
}

function renderPendingCard({ icon, accent, title, value, href }) {
  return `
    <a class="pending-card pending-card--${accent}" href="${href}">
      <div class="pending-card-icon"><i class="bi ${icon}"></i></div>
      <div class="pending-card-content">
        <span class="pending-card-value">${statValue(value)}</span>
        <span class="pending-card-label">${title}</span>
      </div>
      <i class="bi bi-chevron-right pending-card-arrow"></i>
    </a>
  `;
}

function buildWelcomeSection(user) {
  const subtitle = getDashboardSubtitle(user);
  return `
    <section class="dashboard-welcome">
      <div class="dashboard-welcome-text">
        <p class="dashboard-welcome-eyebrow">${subtitle}</p>
        <h1>Welcome back, ${getGreetingName(user)}</h1>
      </div>
    </section>
  `;
}

function buildPendingApprovalsSection(user) {
  const showApprovals = canViewDashboardModule(user, 'pendingApprovals');
  const showWorkflow = canViewDashboardModule(user, 'pendingWorkflow');
  if (!showApprovals && !showWorkflow) return '';

  const title = showApprovals ? 'Pending Approvals' : 'Pending Submissions';

  return `
    <section class="dashboard-section dashboard-section--priority" id="pendingApprovalsSection">
      ${renderSectionHeader(title)}
      <div class="pending-cards-grid" id="pendingApprovalsCards">
        ${renderSkeletonCards(4, 'pending')}
      </div>
    </section>
  `;
}

function buildSchoolOverviewSection(user) {
  if (!canViewDashboardModule(user, 'usersStats')) return '';

  return `
    <section class="dashboard-section" id="schoolOverviewSection">
      ${renderSectionHeader('School Overview')}
      <div class="summary-cards-grid" id="schoolOverviewCards">
        ${renderSkeletonCards(4)}
      </div>
    </section>
  `;
}

function buildAssetOverviewSection(user) {
  if (!canViewDashboardModule(user, 'inventoryStats')) return '';

  const title = isAdministrator(user) ? 'Inventory Summary' : getDashboardStatTitle(user, 'inventoryStats');

  return `
    <section class="dashboard-section" id="assetOverviewSection">
      ${renderSectionHeader(title)}
      <div class="summary-cards-grid summary-cards-grid--asset-overview" id="assetOverviewCards">
        ${renderSkeletonCards(5)}
      </div>
    </section>
  `;
}

function buildAnalyticsSection(user) {
  const chartKeys = getVisibleChartKeys(user);
  if (!chartKeys.length) return '';

  const cards = chartKeys.map((key) => renderChartCard(CHART_DEFINITIONS[key])).join('');

  return `
    <section class="dashboard-section dashboard-section--analytics" id="analyticsSection">
      ${renderSectionHeader('Analytics')}
      <div class="charts-grid charts-grid--analytics" id="analyticsChartsGrid">
        ${cards}
      </div>
    </section>
  `;
}

function buildActivitiesSection(user) {
  if (!canViewDashboardModule(user, 'activities')) return '';

  return `
    <section class="dashboard-section dashboard-section--muted" id="activitiesSection">
      ${renderSectionHeader('Recent Operations')}
      <div class="activity-timeline-wrap" id="activityTimeline">
        <div class="activity-timeline-skeleton">
          ${renderSkeletonCards(3, 'activity')}
        </div>
      </div>
    </section>
  `;
}

const DASHBOARD_SECTION_BUILDERS = {
  pendingApprovals: buildPendingApprovalsSection,
  schoolOverview: buildSchoolOverviewSection,
  assetOverview: buildAssetOverviewSection,
  analytics: buildAnalyticsSection,
  activities: buildActivitiesSection
};

function buildDashboardHtml(user) {
  const sections = getDashboardSectionOrder(user)
    .map((key) => DASHBOARD_SECTION_BUILDERS[key](user))
    .filter(Boolean)
    .join('');

  return `
    <div class="dashboard-page">
      ${buildWelcomeSection(user)}
      <div class="dashboard-grid">
        ${sections}
      </div>
    </div>
  `;
}

function buildSchoolOverviewCards(stats) {
  return [
    renderSummaryCard({
      icon: 'bi-building',
      accent: 'teal',
      title: 'Departments',
      value: stats.departments,
      href: '/pages/manage-departments.html'
    }),
    renderSummaryCard({
      icon: 'bi-people',
      accent: 'primary',
      title: 'Total Users',
      value: stats.total_users,
      href: '/pages/manage-users.html'
    }),
    renderSummaryCard({
      icon: 'bi-person-check',
      accent: 'green',
      title: 'Active Users',
      value: stats.active_users,
      href: '/pages/manage-users.html'
    }),
    renderSummaryCard({
      icon: 'bi-truck',
      accent: 'purple',
      title: 'Suppliers',
      value: stats.suppliers,
      href: '/pages/suppliers.html'
    })
  ].join('');
}

function buildAssetOverviewCards(user, stats) {
  const totalLabel = isCustodian(user) ? 'Total Assigned' : 'Total Assets';

  return [
    renderSummaryCard({
      icon: 'bi-box-seam',
      accent: 'primary',
      title: totalLabel,
      value: stats.total_items
    }),
    renderSummaryCard({
      icon: 'bi-check-circle',
      accent: 'green',
      title: 'Available',
      value: stats.available_items
    }),
    renderSummaryCard({
      icon: 'bi-arrow-left-right',
      accent: 'purple',
      title: 'Borrowed',
      value: stats.borrowed_items
    }),
    renderSummaryCard({
      icon: 'bi-wrench-adjustable',
      accent: 'orange',
      title: 'Under Maintenance',
      value: stats.under_maintenance
    }),
    renderSummaryCard({
      icon: 'bi-archive',
      accent: 'red',
      title: 'Disposed',
      value: stats.disposed
    })
  ].join('');
}

function buildPendingCards(user, stats) {
  const items = [
    { key: 'borrow', module: 'pendingApprovals', icon: 'bi-hourglass-split', accent: 'orange', title: 'Borrow', value: stats.pending_borrows },
    { key: 'maintenance', module: 'maintenanceStats', icon: 'bi-wrench', accent: 'blue', title: 'Maintenance', value: stats.pending_maintenance },
    { key: 'transfer', module: 'transferStats', icon: 'bi-arrow-left-right', accent: 'purple', title: 'Transfer', value: stats.pending_transfers },
    { key: 'disposal', module: 'disposalStats', icon: 'bi-trash3', accent: 'red', title: 'Disposal', value: stats.pending_disposals }
  ];

  return items.filter((item) => canViewDashboardModule(user, item.module) || canViewDashboardModule(user, 'pendingWorkflow')).map((item) => {
    const href = getDashboardQuickLink(user, item.key);
    const label = canViewDashboardModule(user, 'pendingWorkflow') && item.key === 'borrow'
      ? 'My Borrows'
      : item.title;
    return renderPendingCard({ ...item, title: label, href });
  }).join('');
}

function hasChartData(data) {
  return Array.isArray(data) && data.some((d) => statValue(d.count) > 0);
}

function getMonthLabels(dataSets) {
  const monthEntries = new Map();
  dataSets.forEach((data) => {
    (data || []).forEach((d) => {
      if (d.month == null) return;
      const label = String(d.month);
      const yearNum = Number(d.year_num);
      const monthNum = Number(d.month_num);
      const sortKey = (Number.isFinite(yearNum) ? yearNum * 100 : 0)
        + (Number.isFinite(monthNum) ? monthNum : 0);
      const prev = monthEntries.get(label);
      if (!prev || sortKey >= prev.sortKey) {
        monthEntries.set(label, { label, sortKey });
      }
    });
  });
  const labels = [...monthEntries.values()]
    .sort((a, b) => a.sortKey - b.sortKey || a.label.localeCompare(b.label))
    .map((entry) => entry.label);
  if (labels.length) return labels;
  return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun'];
}

function baseChartOptions({ legend = true, horizontal = false } = {}) {
  const scales = horizontal
    ? {
        x: {
          beginAtZero: true,
          grid: { color: 'var(--border-color)' },
          ticks: { stepSize: 1, font: { size: 10 } }
        },
        y: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        }
      }
    : {
        y: {
          beginAtZero: true,
          grid: { color: 'var(--border-color)' },
          ticks: { stepSize: 1, font: { size: 10 } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 } }
        }
      };

  return {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: horizontal ? 'y' : 'x',
    plugins: {
      legend: legend ? {
        position: 'bottom',
        labels: { usePointStyle: true, padding: 10, font: { size: 11 }, boxWidth: 8 }
      } : { display: false }
    },
    scales
  };
}

function renderBorrowReturnChart(charts) {
  const borrowed = charts.monthlyBorrowed || [];
  const returned = charts.monthlyReturned || [];
  const hasBorrow = hasChartData(borrowed);
  const hasReturn = hasChartData(returned);
  const chartCard = document.getElementById('borrowReturnCard');

  destroyChart('borrowReturn');

  if (!hasBorrow && !hasReturn) {
    removeDashboardNode('borrowReturnCard');
    return false;
  }

  const labels = getMonthLabels([borrowed, returned]);
  const borrowedMap = {};
  const returnedMap = {};
  borrowed.forEach((d) => { borrowedMap[d.month] = statValue(d.count); });
  returned.forEach((d) => { returnedMap[d.month] = statValue(d.count); });

  const ctx = document.getElementById('borrowReturnChart');
  if (!ctx) return Boolean(chartCard);

  chartInstances.borrowReturn = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        {
          label: 'Borrowed',
          data: labels.map((l) => borrowedMap[l] || 0),
          borderColor: '#800000',
          backgroundColor: 'rgba(128, 0, 0, 0.06)',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#800000',
          borderWidth: 2
        },
        {
          label: 'Returned',
          data: labels.map((l) => returnedMap[l] || 0),
          borderColor: '#556B2F',
          backgroundColor: 'rgba(85, 107, 47, 0.06)',
          fill: false,
          tension: 0.3,
          pointRadius: 3,
          pointBackgroundColor: '#556B2F',
          borderWidth: 2
        }
      ]
    },
    options: baseChartOptions()
  });

  return true;
}

function renderDistributionCharts(charts, stats) {
  const deptData = charts.departmentDistribution || charts.categoryDistribution || [];
  const deptCard = document.getElementById('departmentDistCard');
  const statusCard = document.getElementById('statusPieCard');

  destroyChart('department');
  destroyChart('statusPie');

  const hasDept = hasChartData(deptData);
  const statusValues = [
    statValue(stats.available_items),
    statValue(stats.borrowed_items),
    statValue(stats.under_maintenance),
    statValue(stats.disposed)
  ];
  const hasStatus = statusValues.some((v) => v > 0);

  let visible = false;

  if (hasDept && deptCard) {
    visible = true;
    const ctx = document.getElementById('departmentChart');
    if (ctx) {
      const labels = deptData.map((d) => d.department || d.category);
      chartInstances.department = new Chart(ctx, {
        type: 'bar',
        data: {
          labels,
          datasets: [{
            data: deptData.map((d) => statValue(d.count)),
            backgroundColor: CHART_COLORS.slice(0, labels.length),
            borderRadius: 4,
            barPercentage: 0.7
          }]
        },
        options: baseChartOptions({ legend: false, horizontal: true })
      });
    }
  } else {
    removeDashboardNode('departmentDistCard');
  }

  if (hasStatus && statusCard) {
    visible = true;
    const ctx = document.getElementById('statusPieChart');
    if (ctx) {
      chartInstances.statusPie = new Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: ['Available', 'Borrowed', 'Under Maintenance', 'Disposed'],
          datasets: [{
            data: statusValues,
            backgroundColor: ['#556B2F', '#800000', '#7a6a4f', '#b0b0b0'],
            borderWidth: 2,
            borderColor: '#ffffff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: { usePointStyle: true, padding: 8, font: { size: 10 }, boxWidth: 8 }
            }
          },
          cutout: '58%'
        }
      });
    }
  } else {
    removeDashboardNode('statusPieCard');
  }

  return visible;
}

function renderMaintenanceTrendChart(stats, user) {
  if (!canViewDashboardModule(user, 'maintenanceTrendChart')) return false;

  const pending = statValue(stats.pending_maintenance);
  const ongoing = statValue(stats.ongoing_maintenance ?? stats.under_maintenance);
  const scheduled = statValue(stats.scheduled_maintenance);
  const card = document.getElementById('maintenanceTrendCard');

  destroyChart('maintenanceTrend');

  if (!pending && !ongoing && !scheduled) {
    removeDashboardNode('maintenanceTrendCard');
    return false;
  }

  const ctx = document.getElementById('maintenanceTrendChart');
  if (!ctx) return Boolean(card);

  chartInstances.maintenanceTrend = new Chart(ctx, {
    type: 'line',
    data: {
      labels: ['Pending', 'Ongoing', 'Scheduled'],
      datasets: [{
        data: [pending, ongoing, scheduled],
        borderColor: '#800000',
        backgroundColor: 'rgba(128, 0, 0, 0.12)',
        fill: true,
        tension: 0.3,
        pointRadius: 4,
        pointBackgroundColor: '#800000',
        borderWidth: 2
      }]
    },
    options: baseChartOptions({ legend: false })
  });

  return true;
}

function finalizeAnalyticsSection() {
  const grid = document.getElementById('analyticsChartsGrid');
  if (!grid) return;

  if (!grid.querySelector('.chart-card')) {
    grid.innerHTML = renderDashboardEmpty();
  }
}

function renderAnalyticsCharts(charts, stats, user) {
  const chartKeys = getVisibleChartKeys(user);
  if (!chartKeys.length) {
    removeDashboardNode('analyticsSection');
    return;
  }

  let hasBorrowReturn = false;
  let hasDistribution = false;
  let hasMaintenance = false;

  if (canViewDashboardModule(user, 'borrowTrendsChart')) {
    hasBorrowReturn = renderBorrowReturnChart(charts || {});
  }
  if (canViewDashboardModule(user, 'departmentChart') || canViewDashboardModule(user, 'assetStatusChart')) {
    hasDistribution = renderDistributionCharts(charts || {}, stats);
  }
  if (canViewDashboardModule(user, 'maintenanceTrendChart')) {
    hasMaintenance = renderMaintenanceTrendChart(stats, user);
  }

  if (!hasBorrowReturn && !hasDistribution && !hasMaintenance) {
    finalizeAnalyticsSection();
    return;
  }

  finalizeAnalyticsSection();
}

function isAuthSessionActivity(activity) {
  const action = String(activity?.action || '').toUpperCase();
  const module = String(activity?.module || '').toLowerCase();

  if (action === 'LOGIN' || action === 'LOGOUT') return true;
  if (module === 'auth') return true;
  if (action.includes('LOGIN') || action.includes('LOGOUT') || action.includes('AUTH')) return true;
  return false;
}

function filterOperationalActivities(activities) {
  return (activities || [])
    .filter((activity) => !isAuthSessionActivity(activity))
    .slice(0, MAX_RECENT_ACTIVITIES);
}

function getActivityIcon(module) {
  const key = (module || '').toLowerCase();
  if (key.includes('borrow')) return 'bi-arrow-left-right';
  if (key.includes('transfer')) return 'bi-shuffle';
  if (key.includes('maintenance')) return 'bi-wrench-adjustable';
  if (key.includes('disposal')) return 'bi-trash3';
  if (key.includes('inventory')) return 'bi-box-seam';
  if (key.includes('document')) return 'bi-file-earmark-text';
  return 'bi-activity';
}

function getActivityAccent(module) {
  const key = (module || '').toLowerCase();
  if (key.includes('borrow')) return 'primary';
  if (key.includes('transfer')) return 'purple';
  if (key.includes('maintenance')) return 'orange';
  if (key.includes('disposal')) return 'red';
  if (key.includes('inventory')) return 'secondary';
  if (key.includes('document')) return 'teal';
  return 'neutral';
}

function formatActivityTime(dateStr) {
  if (!dateStr) return '';
  const formatted = formatDate(dateStr);
  return formatted || '';
}

function renderActivityTimeline(activities) {
  const filtered = filterOperationalActivities(activities);

  if (!filtered.length) {
    return renderDashboardEmpty();
  }

  return `
    <ul class="activity-list-compact">
      ${filtered.map((a) => {
        const accent = getActivityAccent(a.module);
        const icon = getActivityIcon(a.module);
        const action = a.action || a.module || 'Activity';
        const detail = a.description || a.reference_code || '';
        return `
          <li class="activity-row">
            <span class="activity-row-icon activity-row-icon--${accent}">
              <i class="bi ${icon}"></i>
            </span>
            <div class="activity-row-body">
              <span class="activity-row-action">
                <strong>${a.user_name || 'System'}</strong> ${action}
                ${detail ? `<span class="activity-row-detail">${detail}</span>` : ''}
              </span>
              <span class="activity-row-meta">
                <time>${formatActivityTime(a.created_at)}</time>
                <span class="activity-row-module">${a.module || 'System'}</span>
              </span>
            </div>
          </li>
        `;
      }).join('')}
    </ul>
  `;
}

let dashboardUser = null;

async function initDashboard() {
  const user = await initLayout('dashboard');
  if (!user) return;

  dashboardUser = user;
  destroyAllCharts();
  document.getElementById('pageContent').innerHTML = buildDashboardHtml(user);
  loadDashboardData(user);
}

function showDashboardError(err) {
  showToast(err?.message || 'Unable to load dashboard.', 'error');

  const grid = document.querySelector('.dashboard-grid');
  if (!grid) return;

  destroyAllCharts();
  grid.innerHTML = `
    <div class="dashboard-error-state">
      <i class="bi bi-exclamation-circle dashboard-error-icon"></i>
      <p>Unable to load dashboard.</p>
      <p class="dashboard-error-hint">Please check your connection and try again.</p>
      <button class="btn-primary-custom" type="button" id="dashboardRetryBtn">Retry</button>
    </div>
  `;

  document.getElementById('dashboardRetryBtn')?.addEventListener('click', () => {
    if (!dashboardUser) return;
    destroyAllCharts();
    document.getElementById('pageContent').innerHTML = buildDashboardHtml(dashboardUser);
    loadDashboardData(dashboardUser);
  });
}

async function loadDashboardData(user) {
  try {
    const res = await API.getDashboard();
    if (!res?.data) return;

    const { stats: rawStats, charts, tables, dashboardModules } = res.data;
    const stats = rawStats || {};
    const modules = dashboardModules || {};
    const show = (key) => modules[key] !== false && canViewDashboardModule(user, key);

    if (show('usersStats') && document.getElementById('schoolOverviewCards')) {
      document.getElementById('schoolOverviewCards').innerHTML = buildSchoolOverviewCards(stats);
    }

    if (show('inventoryStats') && document.getElementById('assetOverviewCards')) {
      document.getElementById('assetOverviewCards').innerHTML = buildAssetOverviewCards(user, stats);
    }

    if (show('pendingApprovals') || show('pendingWorkflow')) {
      const pendingEl = document.getElementById('pendingApprovalsCards');
      if (pendingEl) {
        const cardsHtml = buildPendingCards(user, stats);
        if (cardsHtml) {
          pendingEl.innerHTML = cardsHtml;
        } else {
          pendingEl.innerHTML = renderDashboardEmpty();
        }
      }
    }

    const hasAnalytics = getVisibleChartKeys(user).length > 0;
    if (hasAnalytics) {
      renderAnalyticsCharts(charts || {}, stats, user);
    }

    if (show('activities') && document.getElementById('activityTimeline')) {
      document.getElementById('activityTimeline').innerHTML = renderActivityTimeline(tables.recentActivities || []);
    }
  } catch (err) {
    showDashboardError(err);
  }
}

document.addEventListener('DOMContentLoaded', initDashboard);
