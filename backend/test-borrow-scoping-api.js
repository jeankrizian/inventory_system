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

async function login(username, password) {
  const res = await request('/auth/login', {
    method: 'POST',
    body: JSON.stringify({ username, password })
  });
  if (res.status !== 200) {
    throw new Error(`Login failed for ${username}: ${res.status}`);
  }
  return { Cookie: res.cookies };
}

(async () => {
  const admin = await login('admin', 'admin123');
  const deptCust = await login('deptcust_test', 'dept123456');
  const employee = await login('staff', 'staff123');

  const adminBorrows = await request('/borrow', { headers: admin });
  const deptBorrows = await request('/borrow', { headers: deptCust });
  const employeeBorrows = await request('/borrow', { headers: employee });

  console.log('Admin borrow count:', adminBorrows.body?.data?.length ?? 0);
  console.log('Custodian borrow count:', deptBorrows.body?.data?.length ?? 0);
  console.log('Employee borrow count:', employeeBorrows.body?.data?.length ?? 0);

  if (adminBorrows.status !== 200 || deptBorrows.status !== 200 || employeeBorrows.status !== 200) {
    throw new Error('Borrow list request failed');
  }

  const adminCount = (adminBorrows.body.data || []).length;
  const custodianCount = (deptBorrows.body.data || []).length;
  if (custodianCount > adminCount) {
    throw new Error('Custodian should not see more borrow requests than administrators');
  }

  const custodianUserRes = await request('/auth/me', { headers: deptCust });
  const custodianUserId = custodianUserRes.body?.data?.id;
  if (!custodianUserId) throw new Error('Could not resolve custodian user id');

  if ((deptBorrows.body.data || []).some((row) => row.borrower_id !== custodianUserId)) {
    throw new Error('Custodian borrow list should only include their own requests');
  }

  if ((employeeBorrows.body.data || []).length > adminCount) {
    throw new Error('Employee should not see more borrow requests than administrators');
  }

  const borrowableRes = await request('/borrow/borrowable-items', { headers: deptCust });
  const borrowable = borrowableRes.body?.data || [];
  const available = borrowable.filter((item) => item.is_borrowable !== false);
  if (!available.length) {
    console.log('No borrowable items found; skipping custodian borrow create test');
  } else {
    const target = available[0];
    const create = await request('/borrow', {
      method: 'POST',
      headers: deptCust,
      body: JSON.stringify({
        borrow_date: new Date().toISOString().split('T')[0],
        purpose: 'Custodian scoped borrow test',
        items: [{ inventory_item_id: target.id, quantity: 1 }]
      })
    });
    console.log('Custodian borrow create:', create.status, create.body?.message || create.body?.error);
    if (create.status !== 201) {
      throw new Error('Custodian should still be able to submit borrow requests');
    }
  }

  console.log('Borrow scoping API tests OK');
})().catch((err) => {
  console.error('Borrow scoping API test failed:', err.message);
  process.exit(1);
});
