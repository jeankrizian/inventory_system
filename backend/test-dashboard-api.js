/**
 * Dashboard widgets: status counts, pending workflow, activities (no low stock).
 * Run: node test-dashboard-api.js
 */
const BASE = 'http://localhost:3000/api';

let cookie = '';

async function request(method, path, body, expectError = false) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(cookie ? { Cookie: cookie } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });
  const setCookie = res.headers.get('set-cookie');
  if (setCookie) cookie = setCookie.split(';')[0];
  const json = await res.json().catch(() => ({}));
  if (!res.ok && !expectError) {
    throw new Error(json.message || `HTTP ${res.status} ${path}`);
  }
  return { res, json, ok: res.ok, status: res.status };
}

async function login(username, password) {
  cookie = '';
  await request('POST', '/auth/login', { username, password });
}

async function asUser(username, password, fn) {
  const saved = cookie;
  await login(username, password);
  try {
    return await fn();
  } finally {
    cookie = saved;
  }
}

async function main() {
  const results = [];
  const run = async (name, fn) => {
    try {
      await fn();
      results.push({ name, ok: true });
      console.log(`✓ ${name}`);
    } catch (err) {
      results.push({ name, ok: false, error: err.message });
      console.error(`✗ ${name}: ${err.message}`);
    }
  };

  await run('Admin dashboard stats include workflow status counts', async () => {
    await login('admin', 'admin123');
    const stats = (await request('GET', '/dashboard/stats')).json.data || {};
    for (const key of ['available_items', 'borrowed_items', 'under_maintenance', 'disposed']) {
      if (stats[key] === undefined) throw new Error(`missing ${key}`);
    }
    if ('low_stock' in stats) throw new Error('low_stock should not be in stats');
  });

  await run('PM dashboard modules include pending approvals', async () => {
    await asUser('pm_test', 'pm123456', async () => {
      const dash = (await request('GET', '/dashboard')).json.data || {};
      if (!dash.dashboardModules?.pendingApprovals) {
        throw new Error('PM missing pendingApprovals module');
      }
      if (dash.dashboardModules?.lowStock) {
        throw new Error('lowStock module should be removed');
      }
      const stats = dash.stats || {};
      for (const key of ['pending_borrows', 'pending_transfers', 'pending_maintenance', 'pending_disposals']) {
        if (stats[key] === undefined) throw new Error(`PM stats missing ${key}`);
      }
    });
  });

  await run('Custodian dashboard modules exclude low stock and include pending workflow', async () => {
    await asUser('ict_custodian', 'cust123456', async () => {
      const dash = (await request('GET', '/dashboard')).json.data || {};
      if (dash.dashboardModules?.lowStock) throw new Error('custodian should not have lowStock');
      if (dash.dashboardModules?.assetsNeedingAttention) {
        throw new Error('assetsNeedingAttention should be removed');
      }
      if (!dash.dashboardModules?.pendingWorkflow) {
        throw new Error('custodian missing pendingWorkflow module');
      }
      if (dash.dashboardModules?.pendingApprovals) {
        throw new Error('custodian should not have pendingApprovals');
      }
      if (dash.dashboardModules?.usersStats) {
        throw new Error('custodian should not have usersStats');
      }
      if (dash.dashboardModules?.charts) {
        throw new Error('custodian should not have school-wide charts');
      }
      const stats = dash.stats || {};
      if (stats.available_items === undefined) throw new Error('missing available_items');
      if (stats.disposed === undefined) throw new Error('missing disposed count');
      if (Number(stats.total_users) !== 0) throw new Error('custodian should not see total_users');
      if (Number(stats.departments) !== 0) throw new Error('custodian should not see departments');
      const charts = dash.charts || {};
      if ((charts.departmentDistribution || []).length) {
        throw new Error('custodian charts should be empty');
      }
    });
  });

  await run('Admin dashboard modules include users stats and school-wide charts', async () => {
    await asUser('admin', 'admin123', async () => {
      const dash = (await request('GET', '/dashboard')).json.data || {};
      if (!dash.dashboardModules?.usersStats) throw new Error('admin missing usersStats');
      if (!dash.dashboardModules?.charts) throw new Error('admin missing charts');
      if (dash.dashboardModules?.pendingApprovals) {
        throw new Error('admin should not have pendingApprovals');
      }
      const stats = dash.stats || {};
      if (Number(stats.total_users) <= 0) throw new Error('admin should see total_users');
      if (Number(stats.departments) <= 0) throw new Error('admin should see departments');
    });
  });

  await run('Dashboard tables include recent activities without low stock', async () => {
    await login('admin', 'admin123');
    const tables = (await request('GET', '/dashboard/tables')).json.data || {};
    if ('lowStock' in tables) throw new Error('tables should not include lowStock');
    if (!Array.isArray(tables.recentActivities)) {
      throw new Error('recentActivities should be an array');
    }
  });

  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} passed`);
  if (failed.length) process.exitCode = 1;
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
