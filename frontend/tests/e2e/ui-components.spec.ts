import { test, expect } from '@playwright/test';

test.describe('TQI ERP - UI & Visual Components Verification Suite', () => {

  test('UI Visual Verification Flow: Auth -> Navigation -> Comboboxes -> Modals & Drawers', async ({ page }) => {
    test.setTimeout(90000);

    // ============================================================
    // STEP 1: AUTHENTICATION VIEW & VALIDATION FEEDBACK
    // ============================================================
    console.log('[UI TEST] Step 1: Testing Login Page & Error Handling');
    page.on('console', msg => console.log('PW BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('PW BROWSER ERROR:', err.message));
    page.on('requestfailed', req => console.log('PW REQ FAILED:', req.url(), req.failure()?.errorText));

    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
    });
    await page.goto('http://127.0.0.1:5173');
    console.log('Current page URL after goto:', page.url());
    console.log('Body HTML snippet:', (await page.locator('body').innerHTML()).slice(0, 200));
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 20000 });

    // Validate Bad Credentials feedback
    await page.fill('#login-email', 'wrong.admin@tqi.org');
    await page.fill('input[type="password"]', 'invalidpassword');
    await page.click('button[type="submit"]');
    await expect(page.locator('text=Invalid email or password').or(page.locator('text=Invalid credentials'))).toBeVisible({ timeout: 10000 });

    // Login with Super Admin
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await expect(page.locator('h1:has-text("Super Admin Dashboard")')).toBeVisible({ timeout: 20000 });
    console.log('✓ Login and error states verified');

    // ============================================================
    // STEP 2: SIDEBAR NAVIGATION & VIEW RENDERING
    // ============================================================
    console.log('[UI TEST] Step 2: Testing Sidebar Navigation across all tabs');
    const navItems = [
      { name: 'Academic Term (8-day)', header: 'Academic' },
      { name: 'Clusters', header: 'Clusters' },
      { name: 'Panchayats & Villages', header: 'Panchayat' },
      { name: 'Students', header: 'Students' },
      { name: 'Volunteers', header: 'Volunteers' },
      { name: 'Students Attendance', header: 'Attendance' },
      { name: 'Volunteer Attendance', header: 'Attendance' },
      { name: 'Session Scheduling', header: 'Schedule' },
      { name: 'Session Photos', header: 'Photographs' },
      { name: 'Session Reports', header: 'Reports' },
      { name: 'Module Library & PPTs', header: 'Module Library' },
      { name: 'Lesson Plans', header: 'Lesson Plans' },
      { name: 'Finance', header: 'Finance' },
      { name: 'User Management', header: 'User' },
      { name: 'Approval Center', header: 'Approval' },
      { name: 'Audit Logs', header: 'Audit' },
      { name: 'Settings', header: 'Personal Information' }
    ];

    for (const item of navItems) {
      await page.click(`button:has-text("${item.name}")`);
      await page.waitForTimeout(150);
      await expect(page.locator(`h1:has-text("${item.header}"), h2:has-text("${item.header}")`).first()).toBeVisible({ timeout: 8000 });
    }
    console.log('✓ All 17 navigation views rendered successfully');

    // ============================================================
    // STEP 3: RADIX UI SELECT DROPDOWNS & COMBOBOXES
    // ============================================================
    console.log('[UI TEST] Step 3: Testing Radix Comboboxes & Dropdowns');
    await page.getByRole('button', { name: 'Clusters', exact: true }).click();
    await page.click('button:has-text("Add Cluster")');
    await expect(page.locator('#cluster-drawer-title:has-text("Add Cluster")')).toBeVisible({ timeout: 10000 });

    // DistrictCombobox trigger
    await page.click('#college-location');
    await expect(page.locator('input[placeholder="Search district or city..."]')).toBeVisible({ timeout: 5000 });
    await page.keyboard.press('Escape');

    // CollegeCombobox input
    const collegeInput = page.locator('input[aria-label="College name"]');
    await expect(collegeInput).toBeVisible();

    await page.click('button:has-text("Cancel")');
    await expect(page.locator('#cluster-drawer-title')).not.toBeVisible({ timeout: 5000 });
    console.log('✓ Comboboxes and dropdown interactions verified');

    // ============================================================
    // STEP 4: MODALS, DIALOGS & DISMISSAL VALIDATIONS
    // ============================================================
    console.log('[UI TEST] Step 4: Testing Modals & Dialog dismissal');
    // Open Cluster Drawer and test cancel button
    await page.getByRole('button', { name: 'Clusters', exact: true }).click();
    await page.click('button:has-text("Add Cluster")');
    await expect(page.locator('#cluster-drawer-title:has-text("Add Cluster")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('#cluster-drawer-title')).not.toBeVisible({ timeout: 5000 });

    // Open Module Modal and test cancel button
    await page.click('button:has-text("Module Library & PPTs")');
    await page.click('button:has-text("Create Module")');
    await expect(page.locator('h2:has-text("Create Module")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Create Module")')).not.toBeVisible({ timeout: 5000 });
    console.log('✓ Modals and Dialogs validated');
  });
});
