/**
 * Phase 8: role-based notifications with standardized messages and actor exclusion.
 * Run: node test-phase8-notifications-api.js
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
  return { res, json };
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

async function getNotifications() {
  return (await request('GET', '/notifications')).json.data?.notifications || [];
}

function hasRecentType(notifications, type) {
  return notifications.some((row) => row.type === type);
}

function findRecentType(notifications, type) {
  return notifications.find((row) => row.type === type);
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

  const stamp = Date.now();

  await run('Admin does not receive governance notification for own department create', async () => {
    await login('admin', 'admin123');
    const before = await getNotifications();
    await request('POST', '/departments', {
      name: `Phase8 Dept ${stamp}`,
      code: `P8${String(stamp).slice(-4)}`,
      status: 'Active'
    });
    const after = await getNotifications();
    const newRows = after.filter((row) => !before.some((prev) => prev.id === row.id));
    if (newRows.some((row) => row.type === 'department_created')) {
      throw new Error('admin received department_created for own action');
    }
  });

  await run('Property Manager receives inventory notification with property tag and link', async () => {
    await login('admin', 'admin123');
    const depts = (await request('GET', '/departments')).json.data || [];
    const deptId = depts.find((d) => /information technology|ict/i.test(d.name))?.id || depts[0]?.id;
    const users = (await request('GET', '/users')).json.data || [];
    const custodianId = users.find((u) => u.username === 'ict_custodian')?.id
      || users.find((u) => u.role === 'Custodian')?.id;

    const created = await request('POST', '/inventory', {
      item_name: `Phase8 Notify ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const propertyTag = created.json.data?.property_tag;

    await asUser('pm_test', 'pm123456', async () => {
      const notifications = await getNotifications();
      const note = findRecentType(notifications, 'inventory_added');
      if (!note) throw new Error('PM missing inventory_added notification');
      if (!note.link_url) throw new Error('notification missing link_url');
      if (!/Action:/i.test(note.message) || !/Item:/i.test(note.message) || !/Time:/i.test(note.message)) {
        throw new Error('notification missing standardized fields');
      }
      if (propertyTag && !note.message.includes(propertyTag)) {
        throw new Error('notification missing property tag');
      }
    });
  });

  await run('Custodian maintenance request notifies Property Manager with asset details', async () => {
    await login('admin', 'admin123');
    const created = await request('POST', '/inventory', {
      item_name: `Phase8 Maint ${stamp}`,
      department_id: (await request('GET', '/departments')).json.data.find((d) => /ict/i.test(d.name))?.id,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: (await request('GET', '/users')).json.data.find((u) => u.username === 'ict_custodian')?.id
    });
    const assetId = created.json.data?.created_ids?.[0] || created.json.data?.id;
    const propertyTag = created.json.data?.property_tag;

    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);

    await asUser('ict_custodian', 'cust123456', async () => {
      await request('POST', '/maintenance', {
        inventory_item_id: assetId,
        reported_problem: 'Phase 8 notification test',
        maintenance_type: 'Corrective',
        scheduled_date: tomorrow.toISOString().split('T')[0]
      });
    });

    await asUser('pm_test', 'pm123456', async () => {
      const notifications = await getNotifications();
      const note = findRecentType(notifications, 'maintenance_request');
      if (!note) throw new Error('PM missing maintenance_request notification');
      if (!note.message.includes('Property Tag:')) throw new Error('missing property tag label');
      if (propertyTag && !note.message.includes(propertyTag)) throw new Error('missing property tag value');
      if (!note.link_url) throw new Error('missing link_url');
    });
  });

  await run('Borrow submit notifies PM only; actor is not notified', async () => {
    await login('admin', 'admin123');
    const depts = (await request('GET', '/departments')).json.data || [];
    const deptId = depts.find((d) => /ict/i.test(d.name))?.id || depts[0]?.id;
    const users = (await request('GET', '/users')).json.data || [];
    const custodianId = users.find((u) => u.username === 'ict_custodian')?.id;

    const inv = await request('POST', '/inventory', {
      item_name: `Phase8 Borrow ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const itemCode = inv.json.data.item_code;

    const beforeAdmin = await getNotifications();
    await request('POST', '/borrow', {
      borrower_department: 'ICT',
      purpose: 'Phase 8 notification routing',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1 }]
    });
    const afterAdmin = await getNotifications();
    const newAdmin = afterAdmin.filter((row) => !beforeAdmin.some((prev) => prev.id === row.id));
    if (newAdmin.some((row) => row.type === 'borrow_submitted')) {
      throw new Error('actor incorrectly received borrow_submitted notification');
    }
    if (newAdmin.some((row) => row.type === 'borrow_request')) {
      throw new Error('admin incorrectly received borrow_request notification');
    }

    await asUser('pm_test', 'pm123456', async () => {
      const notifications = await getNotifications();
      const note = findRecentType(notifications, 'borrow_request');
      if (!note) throw new Error('PM missing borrow_request notification');
      if (!/Action:/i.test(note.message) || !/Time:/i.test(note.message)) {
        throw new Error('borrow_request missing standardized message');
      }
    });
  });

  await run('Custodian submit does not notify self for maintenance request', async () => {
    await login('admin', 'admin123');
    const created = await request('POST', '/inventory', {
      item_name: `Phase8 Maint Self ${stamp}`,
      department_id: (await request('GET', '/departments')).json.data.find((d) => /ict/i.test(d.name))?.id,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: (await request('GET', '/users')).json.data.find((u) => u.username === 'ict_custodian')?.id
    });
    const assetId = created.json.data?.created_ids?.[0] || created.json.data?.id;
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 3);

    await asUser('ict_custodian', 'cust123456', async () => {
      const before = await getNotifications();
      await request('POST', '/maintenance', {
        inventory_item_id: assetId,
        reported_problem: 'Phase 8 actor exclusion test',
        maintenance_type: 'Corrective',
        scheduled_date: tomorrow.toISOString().split('T')[0]
      });
      const after = await getNotifications();
      const newRows = after.filter((row) => !before.some((prev) => prev.id === row.id));
      if (newRows.some((row) => row.type === 'maintenance_request')) {
        throw new Error('custodian actor received maintenance_request notification');
      }
    });
  });

  await run('PM approve borrow notifies borrower and custodian, not approving PM', async () => {
    await login('admin', 'admin123');
    const depts = (await request('GET', '/departments')).json.data || [];
    const deptId = depts.find((d) => /ict/i.test(d.name))?.id || depts[0]?.id;
    const users = (await request('GET', '/users')).json.data || [];
    const custodianId = users.find((u) => u.username === 'ict_custodian')?.id;

    const inv = await request('POST', '/inventory', {
      item_name: `Phase8 Approve ${stamp}`,
      department_id: deptId,
      asset_count: 1,
      asset_classification: 'Non-Consumable (Fixed Asset)',
      custodian_id: custodianId
    });
    const itemCode = inv.json.data.item_code;

    const borrow = await request('POST', '/borrow', {
      borrower_department: 'ICT',
      purpose: 'Phase 8 approve routing',
      borrow_date: new Date().toISOString().split('T')[0],
      expected_return_date: new Date(Date.now() + 5 * 86400000).toISOString().split('T')[0],
      items: [{ item_code: itemCode, quantity: 1 }]
    });
    const borrowId = borrow.json.data?.id;

    await asUser('pm_test', 'pm123456', async () => {
      const before = await getNotifications();
      await request('PUT', `/borrow/${borrowId}/approve`, {});
      const after = await getNotifications();
      const newRows = after.filter((row) => !before.some((prev) => prev.id === row.id));
      if (newRows.some((row) => row.type === 'borrow_approved')) {
        throw new Error('approving PM incorrectly received borrow_approved notification');
      }
    });

    await asUser('ict_custodian', 'cust123456', async () => {
      const notifications = await getNotifications();
      if (!findRecentType(notifications, 'assigned_asset_borrowed')) {
        throw new Error('custodian missing assigned_asset_borrowed notification');
      }
    });
  });

  await run('Administrator does not receive maintenance due reminders on notification fetch', async () => {
    await login('admin', 'admin123');
    const notifications = await getNotifications();
    if (hasRecentType(notifications, 'maintenance_due')) {
      throw new Error('admin should not receive maintenance_due reminders');
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
