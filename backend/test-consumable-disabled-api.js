require('dotenv').config();
const pool = require('./config/database');

const base = 'http://localhost:3000/api';

async function request(path, options = {}) {
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });
  const body = await res.json().catch(() => ({}));
  return { status: res.status, body, cookies: res.headers.get('set-cookie') };
}

(async () => {
  const login = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username: 'admin', password: 'admin123' })
  });
  if (login.status !== 200) throw new Error('Login failed');
  const auth = { Cookie: login.cookies };

  const blocked = await request('/inventory', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Blocked Consumable Test',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });
  if (blocked.status !== 400) {
    throw new Error('Creating consumable item should be rejected');
  }

  const allowed = await request('/inventory', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Semi-Durable Test Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Semi-Durable'
    })
  });
  if (allowed.status !== 201) {
    throw new Error(`Semi-Durable create failed: ${allowed.status}`);
  }

  const newId = allowed.body.data.id;
  const changeToConsumable = await request(`/inventory/${newId}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Semi-Durable Test Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });
  if (changeToConsumable.status !== 400) {
    throw new Error('Changing item to consumable should be rejected');
  }

  const [rows] = await pool.query(
    `SELECT id FROM inventory_items
     WHERE asset_classification = 'Consumable' AND is_archived = 0
     LIMIT 1`
  );

  if (rows.length) {
    const existingId = rows[0].id;
    const get = await request(`/inventory/${existingId}`, { headers: auth });
    if (get.status !== 200 || get.body?.data?.asset_classification !== 'Consumable') {
      throw new Error('Existing consumable item should remain readable');
    }

    const keepConsumable = await request(`/inventory/${existingId}`, {
      method: 'PUT',
      headers: auth,
      body: JSON.stringify({
        item_name: get.body.data.item_name,
        department_id: get.body.data.department_id,
        quantity: get.body.data.quantity,
        asset_classification: 'Consumable'
      })
    });
    if (keepConsumable.status !== 200) {
      throw new Error('Existing consumable item should remain editable');
    }
  } else {
    console.log('No existing consumable items in DB; skipped existing-item update test');
  }

  await request(`/inventory/${newId}`, { method: 'DELETE', headers: auth });
  console.log('Consumable disabled API tests OK');
  process.exit(0);
})().catch((err) => {
  console.error('Consumable disabled API test failed:', err.message);
  process.exit(1);
});
