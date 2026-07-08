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

  if (login.status !== 200) {
    console.error('Login failed', login.status, login.body);
    process.exit(1);
  }

  const auth = { Cookie: login.cookies };

  const create = await request('/inventory', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Material Test Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable',
      material: 'Metal'
    })
  });

  console.log('Create:', create.status, create.body?.data?.material, create.body?.message || create.body?.error);

  if (create.status !== 201 || create.body?.data?.material !== 'Metal') {
    console.error('FAIL: material not saved on create');
    process.exit(1);
  }

  const id = create.body.data.id;
  const get = await request(`/inventory/${id}`, { headers: auth });
  if (get.body?.data?.material !== 'Metal') {
    console.error('FAIL: material not returned on get');
    process.exit(1);
  }

  const invalid = await request('/inventory', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Invalid Material Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable',
      material: 'Ceramic'
    })
  });
  if (invalid.status !== 400) {
    console.error('FAIL: invalid material should be rejected');
    process.exit(1);
  }

  const update = await request(`/inventory/${id}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Material Test Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable',
      material: 'Plastic'
    })
  });
  if (update.body?.data?.material !== 'Plastic') {
    console.error('FAIL: material not updated');
    process.exit(1);
  }

  await request(`/inventory/${id}`, { method: 'DELETE', headers: auth });
  console.log('Material API tests OK');
})().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
