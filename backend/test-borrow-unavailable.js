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

  const itemsRes = await request('/borrow/borrowable-items', { headers: auth });
  const items = itemsRes.body?.data || [];
  const unavailable = items.find((item) => item.is_borrowable === false);
  const available = items.find((item) => item.is_borrowable !== false);

  if (!unavailable) {
    console.log('No unavailable borrow catalog item found; skipping blocked borrow API test');
  } else {
    const blocked = await request('/borrow', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify({
        borrow_date: new Date().toISOString().split('T')[0],
        purpose: 'Should be blocked',
        items: [{ inventory_item_id: unavailable.id, quantity: 1 }]
      })
    });
    console.log('Blocked unavailable item:', blocked.status, blocked.body?.error || blocked.body?.message);
    if (blocked.status !== 400) {
      console.error('FAIL: unavailable item borrow was not blocked');
      process.exit(1);
    }
  }

  if (!available) {
    console.error('No borrowable item available for positive test');
    process.exit(1);
  }

  const allowed = await request('/borrow', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      purpose: 'Availability test borrow',
      items: [{ inventory_item_id: available.id, quantity: 1 }]
    })
  });
  console.log('Allowed borrow:', allowed.status, allowed.body?.message || allowed.body?.error);

  if (allowed.status !== 201) {
    console.error('FAIL: borrowable item was rejected');
    process.exit(1);
  }

  console.log('Borrow unavailable tests OK');
})().catch((err) => {
  console.error('Borrow unavailable test failed:', err.message);
  process.exit(1);
});
