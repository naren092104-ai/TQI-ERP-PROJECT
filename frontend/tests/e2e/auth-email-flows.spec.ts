import { test, expect } from '@playwright/test';

test('forgot password requests a generic OTP and resets with the email code', async ({ page }) => {
  const resetRequest: { email?: string; otp?: string; newPassword?: string } = {};
  await page.route('**/api/auth/forgot-password', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'If an account exists for that email, a five-minute password reset code will be sent.' }),
    });
  });
  await page.route('**/api/auth/reset-password', async (route) => {
    Object.assign(resetRequest, route.request().postDataJSON());
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, confirmationEmailSent: true }),
    });
  });

  await page.goto('/');
  await page.getByRole('button', { name: 'Forgot?' }).click();
  await page.getByRole('dialog').getByLabel('Work email').fill('user@example.org');
  await page.getByRole('button', { name: 'Send code' }).click();
  await expect(page.getByLabel('6-digit verification code')).toBeVisible();
  await page.getByLabel('6-digit verification code').fill('123456');
  await page.getByLabel('New password', { exact: true }).fill('StrongPass1!');
  await page.getByLabel('Confirm new password').fill('StrongPass1!');
  await page.getByRole('button', { name: 'Reset password', exact: true }).click();

  await expect(page.getByText('Password reset complete')).toBeVisible();
  expect(resetRequest).toEqual({ email: 'user@example.org', otp: '123456', newPassword: 'StrongPass1!' });
});

test('OTP login sends a code, verifies it, and continues through existing session validation', async ({ page }) => {
  const payload = Buffer.from(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).toString('base64url');
  const token = `header.${payload}.signature`;
  const requests: string[] = [];

  await page.route('**/api/**', async (route) => {
    const pathname = new URL(route.request().url()).pathname;
    if (pathname.endsWith('/system/maintenance')) {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, maintenance: null }) });
      return;
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) });
  });
  await page.route('**/api/auth/request-otp', async (route) => {
    requests.push('request-otp');
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, otpRequired: true }) });
  });
  await page.route('**/api/auth/login', async (route) => {
    requests.push('login-otp');
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
  await page.getByRole('tab', { name: 'OTP code' }).click();
  await page.locator('#login-email').fill('user@example.org');
  await page.getByRole('button', { name: 'Send code' }).click();
  await page.getByPlaceholder('000000').fill('123456');
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Sign Out', { exact: true })).toBeVisible();
  expect(requests).toEqual(['request-otp', 'login-otp']);
});
