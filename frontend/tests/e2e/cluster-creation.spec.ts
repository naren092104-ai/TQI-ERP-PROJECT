import { test, expect } from '@playwright/test';

test('cluster creation displays existing duplicate conflict and prevents repeated submissions while pending', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const token = `header.${payload}.signature`;
  let createCalls = 0;
  let releaseCreateRequest: () => void = () => undefined;
  const pendingCreateResponse = new Promise<void>((resolve) => { releaseCreateRequest = resolve; });

  await page.addInitScript((authToken) => {
    localStorage.setItem('tqi_auth_session', JSON.stringify({
      token: authToken,
      id: 'admin-id',
      name: 'Super Admin',
      email: 'admin@example.org',
      role: 'Super Admin',
      clusterId: 'all',
      clusterName: 'All Clusters',
      designation: 'Statewide Super Admin',
      avatarText: 'SA',
    }));
    localStorage.setItem('tqi_selected_academic_year_id', 'year-2026');
  }, token);

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/auth/me')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, user: { id: 'admin-id', name: 'Super Admin', email: 'admin@example.org', role: 'Super Admin', clusterId: 'all', clusterName: 'All Clusters', mustChangePassword: false } }) });
      return;
    }
    if (pathname.endsWith('/system/maintenance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, maintenance: null }) });
      return;
    }
    if (pathname.endsWith('/academic-years')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, academicYears: [{ id: 'year-2026', name: '2026-2027', status: 'ACTIVE', isActive: true }] }) });
      return;
    }
    if (pathname.endsWith('/clusters') && route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clusters: [] }) });
      return;
    }
    if (pathname.endsWith('/clusters') && route.request().method() === 'POST') {
      createCalls += 1;
      await pendingCreateResponse;
      await route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'A cluster for this college and district already exists in the selected academic year.' }) });
      return;
    }
    if (route.request().method() === 'GET') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, clusters: [], users: [], academicYears: [], panchayats: [], students: [], volunteers: [] }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });

  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Super Admin Dashboard', exact: true })).toBeVisible({ timeout: 15_000 });
  await page.getByRole('button', { name: 'Clusters', exact: true }).click();
  await page.getByRole('button', { name: /Create cluster/i }).click();
  const districtSelect = page.locator('form [role="combobox"]').first();
  await districtSelect.click();
  await expect(page.getByRole('option')).toHaveCount(38);
  await page.getByRole('option', { name: 'Dharmapuri', exact: true }).click();
  await page.getByRole('textbox', { name: 'College / Institution *' }).fill('Test College');
  await expect(page.getByText('Sub-District / Taluk', { exact: true })).toHaveCount(0);
  await page.getByRole('textbox', { name: 'SPOC Name *' }).fill('Test Admin');
  await page.getByRole('textbox', { name: 'SPOC Phone *' }).fill('9876543210');
  await page.getByRole('textbox', { name: 'SPOC Email *' }).fill('admin.test@gmail.com');

  const submit = page.locator('form button[type="submit"]');
  const submitRequest = submit.click();
  await expect(submit).toBeDisabled({ timeout: 5000 });
  expect(createCalls).toBe(1);
  releaseCreateRequest();
  await submitRequest;
  await expect(page.getByText('A cluster for this college and district already exists in the selected academic year.')).toBeVisible();
});
