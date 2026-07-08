const base = 'http://localhost:3000/api';
const suffix = String(Date.now()).slice(-4);

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
  const createdIds = [];

  async function createItem(payload) {
    const res = await request('/inventory', {
      method: 'POST',
      headers: auth,
      body: JSON.stringify(payload)
    });
    if (res.body?.data?.id) createdIds.push(res.body.data.id);
    return res;
  }

  const hyphenTag = `2025-${suffix}`;
  const slashTag = `2025/${suffix}`;

  const semiDurableHyphen = await createItem({
    item_name: 'Property Tag Hyphen Test',
    department_id: 2,
    quantity: 1,
    asset_classification: 'Semi-Durable',
    property_tag: hyphenTag
  });
  console.log('Semi-Durable hyphen tag:', semiDurableHyphen.status, semiDurableHyphen.body?.data?.property_tag);
  if (semiDurableHyphen.status !== 201 || semiDurableHyphen.body?.data?.property_tag !== hyphenTag) {
    throw new Error('Failed to create item with 2025-0001 style property tag');
  }

  const semiDurableSlash = await createItem({
    item_name: 'Property Tag Slash Test',
    department_id: 2,
    quantity: 1,
    asset_classification: 'Semi-Durable',
    property_tag: slashTag
  });
  console.log('Semi-Durable slash tag:', semiDurableSlash.status, semiDurableSlash.body?.data?.property_tag);
  if (semiDurableSlash.status !== 201 || semiDurableSlash.body?.data?.property_tag !== slashTag) {
    throw new Error('Failed to create item with 2025/0001 style property tag');
  }

  const invalidFormat = await createItem({
    item_name: 'Property Tag Invalid Test',
    department_id: 2,
    quantity: 1,
    asset_classification: 'Semi-Durable',
    property_tag: 'bad tag'
  });
  console.log('Invalid format rejected:', invalidFormat.status, invalidFormat.body?.error || invalidFormat.body?.message);
  if (invalidFormat.status !== 400) {
    throw new Error('Invalid property tag format should be rejected');
  }

  const duplicate = await createItem({
    item_name: 'Property Tag Duplicate Test',
    department_id: 2,
    quantity: 1,
    asset_classification: 'Semi-Durable',
    property_tag: hyphenTag
  });
  console.log('Duplicate tag rejected:', duplicate.status, duplicate.body?.error || duplicate.body?.message);
  if (duplicate.status !== 400) {
    throw new Error('Duplicate property tag should be rejected');
  }

  const consumable = await createItem({
    item_name: 'Property Tag Consumable Test',
    department_id: 2,
    quantity: 1,
    asset_classification: 'Consumable',
    property_tag: '2025-9999'
  });
  console.log('Consumable ignores tag:', consumable.status, consumable.body?.data?.property_tag);
  if (consumable.status !== 201 || consumable.body?.data?.property_tag != null) {
    throw new Error('Consumable items should not keep property tag');
  }

  for (const id of createdIds) {
    await request(`/inventory/${id}`, { method: 'DELETE', headers: auth });
  }

  console.log('Property tag API tests OK');
})().catch((err) => {
  console.error('Property tag API test failed:', err.message);
  process.exit(1);
});
