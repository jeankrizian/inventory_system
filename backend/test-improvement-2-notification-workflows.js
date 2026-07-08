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
  if (res.status !== 200) throw new Error(`Login failed for ${username}`);
  return { Cookie: res.cookies };
}

function hasType(notifications, type) {
  return (notifications || []).some((n) => n.type === type);
}

function findByType(notifications, type) {
  return (notifications || []).find((n) => n.type === type);
}

(async () => {
  const employee = await login('staff', 'staff123');
  const pm = await login('pm_test', 'pm123456');
  const admin = await login('admin', 'admin123');
  const deptCust = await login('deptcust_test', 'dept123456');

  const borrowableRes = await request('/borrow/borrowable-items', { headers: employee });
  const borrowable = (borrowableRes.body?.data || []).filter((item) => item.is_borrowable !== false);
  if (!borrowable.length) throw new Error('No borrowable items for workflow test');

  const createBorrow = await request('/borrow', {
    method: 'POST',
    headers: employee,
    body: JSON.stringify({
      borrow_date: new Date().toISOString().split('T')[0],
      purpose: 'Improvement 2 notification workflow test',
      items: [{ inventory_item_id: borrowable[0].id, quantity: 1 }]
    })
  });
  if (createBorrow.status !== 201) {
    throw new Error(`Borrow create failed: ${createBorrow.status}`);
  }
  const borrowId = createBorrow.body.data.id;

  const pmNotes = await request('/notifications', { headers: pm });
  const pmBorrow = (pmNotes.body?.data?.notifications || []).find(
    (n) => n.type === 'borrow_request' && Number(n.reference_id) === Number(borrowId)
  );
  if (!pmBorrow) throw new Error('PM should receive borrow_request for created borrow');
  if (!pmBorrow.message.includes('submitted by')) {
    throw new Error('PM borrow_request message should mention submitter');
  }
  if (!pmBorrow.link_url.includes(`id=${borrowId}`)) {
    throw new Error('Borrow notification should deep-link to record');
  }

  const approve = await request(`/borrow/${borrowId}/approve`, { method: 'PUT', headers: pm });
  if (approve.status !== 200) throw new Error(`Borrow approve failed: ${approve.status}`);

  const employeeNotes = await request('/notifications', { headers: employee });
  const approvedNote = (employeeNotes.body?.data?.notifications || []).find(
    (n) => n.type === 'borrow_approved' && Number(n.reference_id) === Number(borrowId)
  );
  if (!approvedNote) throw new Error('Borrower should receive borrow_approved for approved borrow');
  if (!approvedNote.message.includes('approved')) {
    throw new Error('Borrow approved message should confirm approval');
  }

  const inventoryRes = await request('/inventory', { headers: deptCust });
  const maintainable = (inventoryRes.body?.data || []).find((item) =>
    item.asset_classification === 'Non-Consumable (Fixed Asset)'
  );
  if (maintainable) {
    const maintenanceCreate = await request('/maintenance', {
      method: 'POST',
      headers: deptCust,
      body: JSON.stringify({
        inventory_item_id: maintainable.id,
        maintenance_type: 'Corrective',
        scheduled_date: new Date().toISOString().split('T')[0],
        reported_problem: 'Workflow notification test'
      })
    });
    if (maintenanceCreate.status === 201) {
      const maintenanceId = maintenanceCreate.body.data.id;
      const pmMaintNotes = await request('/notifications', { headers: pm });
      if (!hasType(pmMaintNotes.body?.data?.notifications, 'maintenance_request')) {
        throw new Error('PM should receive maintenance_request');
      }

      const approveMaint = await request(`/maintenance/${maintenanceId}/approve`, {
        method: 'PUT',
        headers: pm,
        body: JSON.stringify({ scheduled_date: new Date().toISOString().split('T')[0] })
      });
      if (approveMaint.status === 200) {
        const startMaint = await request(`/maintenance/${maintenanceId}/start`, {
          method: 'PUT',
          headers: pm,
          body: JSON.stringify({})
        });
        if (startMaint.status === 200) {
          const custNotes = await request('/notifications', { headers: deptCust });
          if (!hasType(custNotes.body?.data?.notifications, 'maintenance_started')) {
            throw new Error('Requester should receive maintenance_started');
          }
        }
      }
    }
  }

  console.log('Improvement 2 notification workflow API tests OK');
})().catch((err) => {
  console.error('Improvement 2 notification workflow test failed:', err.message);
  process.exit(1);
});
