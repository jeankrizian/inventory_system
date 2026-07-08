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
      item_name: 'Description Test Item',
      description: 'Test item description for Feature 4',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });

  console.log('Create:', create.status, create.body?.data?.description, create.body?.message || create.body?.error);

  if (create.status !== 201 || create.body?.data?.description !== 'Test item description for Feature 4') {
    console.error('FAIL: description not saved on create');
    process.exit(1);
  }

  const id = create.body.data.id;
  const get = await request(`/inventory/${id}`, { headers: auth });
  console.log('Get:', get.status, get.body?.data?.description);

  if (get.body?.data?.description !== 'Test item description for Feature 4') {
    console.error('FAIL: description not returned on get');
    process.exit(1);
  }

  const update = await request(`/inventory/${id}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      item_name: 'Description Test Item',
      description: 'Updated description',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });
  console.log('Update:', update.status, update.body?.data?.description);

  if (update.body?.data?.description !== 'Updated description') {
    console.error('FAIL: description not updated');
    process.exit(1);
  }

  await request(`/inventory/${id}`, { method: 'DELETE', headers: auth });
  console.log('Item description tests OK');
})().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
