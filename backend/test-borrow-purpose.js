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
  if (!items.length) {
    console.error('No borrowable items available for test');
    process.exit(1);
  }

  const item = items.find((entry) => entry.is_borrowable !== false) || items[0];

  const missingPurpose = await request('/borrow', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      items: [{ inventory_item_id: item.id, quantity: 1 }]
    })
  });
  console.log('Missing purpose:', missingPurpose.status, missingPurpose.body?.error || missingPurpose.body?.message);

  const emptyPurpose = await request('/borrow', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      purpose: '   ',
      items: [{ inventory_item_id: item.id, quantity: 1 }]
    })
  });
  console.log('Empty purpose:', emptyPurpose.status, emptyPurpose.body?.error || emptyPurpose.body?.message);

  const withPurpose = await request('/borrow', {
    method: 'POST',
    headers: auth,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      purpose: 'Test borrow purpose',
      items: [{ inventory_item_id: item.id, quantity: 1 }]
    })
  });
  console.log('With purpose:', withPurpose.status, withPurpose.body?.data?.purpose, withPurpose.body?.message || withPurpose.body?.error);

  if (missingPurpose.status !== 400 || emptyPurpose.status !== 400) {
    console.error('FAIL: purpose validation not enforced');
    process.exit(1);
  }

  if (withPurpose.status !== 201 || withPurpose.body?.data?.purpose !== 'Test borrow purpose') {
    console.error('FAIL: valid borrow with purpose was rejected');
    process.exit(1);
  }

  console.log('Borrow purpose tests OK');
})().catch((err) => {
  console.error('Test failed:', err.message);
  process.exit(1);
});
