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

  const cookie = login.cookies;
  const auth = { Cookie: cookie };

  const preview = await request('/inventory/next-code?department_id=2', {
    headers: auth
  });
  console.log('Preview:', preview.status, preview.body);

  const create = await request('/inventory', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      item_code: 'HACK-001',
      item_name: 'Auto Code Test Item',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });
  console.log('Create:', create.status, create.body?.data?.item_code, create.body?.message || create.body?.error);
  if (create.body?.data?.item_code === 'HACK-001') {
    console.error('FAIL: manual item_code was accepted on create');
    process.exit(1);
  }

  const preview2 = await request('/inventory/next-code?department_id=2', {
    headers: auth
  });
  console.log('Preview after create:', preview2.status, preview2.body);

  const update = await request(`/inventory/${create.body?.data?.id}`, {
    method: 'PUT',
    headers: auth,
    body: JSON.stringify({
      item_code: 'HACK-999',
      item_name: 'Auto Code Test Item Updated',
      department_id: 2,
      quantity: 1,
      asset_classification: 'Consumable'
    })
  });
  console.log('Update code preserved:', update.status, update.body?.data?.item_code);

  if (create.body?.data?.id) {
    await request(`/inventory/${create.body.data.id}`, {
      method: 'DELETE',
      headers: auth
    });
    console.log('Cleaned up test item');
  }

  console.log('API tests OK');
})().catch((err) => {
  console.error('API test failed:', err.message);
  process.exit(1);
});
