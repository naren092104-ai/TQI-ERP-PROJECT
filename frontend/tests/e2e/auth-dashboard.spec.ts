import { test, expect } from '@playwright/test';

test('does not call auth/me when there is no stored token', async ({ page }) => {
  const authMeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/me')) authMeRequests.push(request.url());
  });

  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#login-email')).toBeVisible();
  await page.waitForTimeout(100);
  expect(authMeRequests).toHaveLength(0);
});

test('a legacy session object without a token is treated as logged out', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tqi_auth_session', JSON.stringify({ id: 'legacy-user', role: 'Super Admin' }));
  });
  const authMeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/me')) authMeRequests.push(request.url());
  });

  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#login-email')).toBeVisible();
  expect(authMeRequests).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('tqi_auth_session'))).toBeNull();
});

test('expired saved token is cleared before calling auth/me', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tqi_auth_session', JSON.stringify({
      token: 'header.eyJleHAiOjF9.signature',
      id: 'expired-user',
      role: 'Super Admin',
    }));
  });

  const authMeRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/auth/me')) authMeRequests.push(request.url());
  });

  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#login-email')).toBeVisible();
  expect(authMeRequests).toHaveLength(0);
  expect(await page.evaluate(() => localStorage.getItem('tqi_auth_session'))).toBeNull();
});

test('maintenance polling waits until a saved token is validated', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('tqi_auth_session', JSON.stringify({
      token: 'header.eyJleHAiOjk5OTk5OTk5OTl9.signature',
      id: 'revoked-user',
      role: 'Super Admin',
    }));
  });
  const authMeRequests: string[] = [];
  await page.route('**/api/auth/me', async (route) => {
    authMeRequests.push(route.request().headers().authorization || '');
    await route.fulfill({ status: 401, contentType: 'application/json', body: '{"success":false}' });
  });

  const maintenanceRequests: string[] = [];
  page.on('request', (request) => {
    if (request.url().includes('/api/system/maintenance')) maintenanceRequests.push(request.url());
  });

  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#login-email')).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem('tqi_auth_session'))).toBeNull();
  expect(authMeRequests).toHaveLength(1);
  expect(authMeRequests[0]).toMatch(/^Bearer header\./);
  await page.waitForTimeout(100);
  expect(authMeRequests).toHaveLength(1);
  expect(maintenanceRequests).toHaveLength(0);
});

test('login stores the JWT, validates once, refresh revalidates, and logout does not recheck', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const token = `header.${payload}.signature`;
  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(pathname.endsWith('/system/maintenance')
        ? { success: true, maintenance: null }
        : { success: true, data: [] }),
    });
  });

  await page.route('**/api/auth/login', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        token,
        user: {
          id: 'valid-user',
          name: 'Test User',
          email: 'test@example.org',
          role: 'Super Admin',
          clusterId: 'all',
          clusterName: 'All Clusters',
          mustChangePassword: false,
        },
      }),
    });
  });

  const authMeRequests: string[] = [];
  await page.route('**/api/auth/me', async (route) => {
    authMeRequests.push(route.request().headers().authorization || '');
    await new Promise((resolve) => setTimeout(resolve, 300));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, user: { id: 'valid-user', mustChangePassword: false } }),
    });
  });

  await page.goto('http://127.0.0.1:5173');
  await expect(page.locator('#login-email')).toBeVisible();
  expect(authMeRequests).toHaveLength(0);
  await page.fill('#login-email', 'test@example.org');
  await page.fill('input[type="password"]', 'AnyTestPassword!');
  await page.getByRole('button', { name: /sign in/i }).click();
  await expect(page.getByRole('status')).toHaveText('Checking your session…');
  await expect.poll(() => authMeRequests.length).toBe(1);
  expect(authMeRequests[0]).toBe(`Bearer ${token}`);
  await expect(page.getByText('Sign Out', { exact: true })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('tqi_auth_session') || '{}').token)).toBe(token);

  await page.reload();
  await expect.poll(() => authMeRequests.length).toBe(2);
  expect(authMeRequests[1]).toBe(`Bearer ${token}`);
  await page.getByText('Sign Out', { exact: true }).click();
  await expect(page.locator('#login-email')).toBeVisible();
  await page.waitForTimeout(100);
  expect(authMeRequests).toHaveLength(2);
  expect(await page.evaluate(() => localStorage.getItem('tqi_auth_session'))).toBeNull();
});

test('dashboard loads academic setup using an authenticated request', async ({ page }) => {
  page.on('console', msg => console.log('BROWSER LOG:', msg.text()));
  page.on('pageerror', err => console.log('BROWSER ERROR:', err.message));
  page.on('requestfailed', req => console.log('REQ FAILED:', req.url(), req.failure()?.errorText));

  await page.addInitScript(() => {
    try { localStorage.clear(); } catch {}
  });
  await page.goto('http://127.0.0.1:5173');
  console.log('Page URL:', page.url());
  console.log('Body HTML:', (await page.locator('body').innerHTML()).slice(0, 300));
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 20000 });

  await page.fill('#login-email', 'admin@tqi.org');
  await page.fill('input[type="password"]', 'admin123');

  const responsePromise = page.waitForResponse((res) => {
    return res.url().includes('/api/academic-setup') && res.request().method() === 'GET';
  }, { timeout: 20000 });

  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: /super admin dashboard/i })).toBeVisible({ timeout: 20000 });

  const response = await responsePromise;
  expect(response.status()).toBe(200);
  expect(response.request().headers()['authorization']).toContain('Bearer ');

  const viewportWidths = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440];
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(scrollWidths.document, `dashboard overflow at ${width}px`).toBeLessThanOrEqual(scrollWidths.viewport);
    expect(scrollWidths.body, `dashboard body overflow at ${width}px`).toBeLessThanOrEqual(scrollWidths.viewport);
  }

  await page.setViewportSize({ width: 375, height: 812 });
  await page.getByRole('button', { name: 'Toggle navigation' }).click();
  await page.getByRole('button', { name: 'Session Scheduling' }).click();
  await expect(page.getByRole('heading', { name: /cluster sessions schedule overview/i })).toBeVisible();
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    const scrollWidths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));
    expect(scrollWidths.document, `session schedule overflow at ${width}px`).toBeLessThanOrEqual(scrollWidths.viewport);
    expect(scrollWidths.body, `session schedule body overflow at ${width}px`).toBeLessThanOrEqual(scrollWidths.viewport);
  }
});
