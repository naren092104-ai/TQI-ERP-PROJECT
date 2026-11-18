import { test, expect } from '@playwright/test';

test('existing email and password login opens the existing role dashboard', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const token = `header.${payload}.signature`;

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/system/maintenance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, maintenance: null }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/auth/login', async (route) => {
    expect(route.request().postDataJSON()).toEqual({ email: 'user@example.org', password: 'StrongPass1!' });
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token,
        user: { id: 'cluster-user', name: 'Cluster User', email: 'user@example.org', role: 'Cluster Admin', clusterId: 'dharmapuri-ksr', clusterName: 'Dharmapuri', mustChangePassword: false },
      }),
    });
  });
  await page.route('**/api/auth/me', async (route) => route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify({
      success: true,
      user: { id: 'cluster-user', name: 'Cluster User', email: 'user@example.org', role: 'Cluster Admin', clusterId: 'dharmapuri-ksr', clusterName: 'Dharmapuri', mustChangePassword: false },
    }),
  }));

  await page.goto('/');
  await page.locator('#login-email').fill('user@example.org');
  await page.locator('#login-password').fill('StrongPass1!');
  await page.getByRole('button', { name: 'Sign in', exact: true }).click();
  await expect(page.getByText('Sign Out', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tqi_auth_session') || '{}').role)).toBe('Cluster Admin');
});
