import { test, expect } from '@playwright/test';

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
});
