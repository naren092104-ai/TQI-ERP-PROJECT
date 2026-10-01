import { test, expect } from '@playwright/test';

test('dashboard loads academic setup using an authenticated request', async ({ page }) => {
  await page.goto('http://localhost:5173');

  await page.fill('#login-email', 'admin@tqi.org');
  await page.fill('input[type="password"]', 'admin123');
  await page.getByRole('button', { name: /sign in/i }).click();

  await expect(page.getByRole('heading', { name: /super admin dashboard/i })).toBeVisible({ timeout: 20000 });

  const response = await page.waitForResponse((res) => {
    return res.url().includes('/api/academic-setup') && res.request().method() === 'GET';
  }, { timeout: 20000 });

  expect(response.status()).toBe(200);
  expect(response.request().headers()['authorization']).toContain('Bearer ');
});
