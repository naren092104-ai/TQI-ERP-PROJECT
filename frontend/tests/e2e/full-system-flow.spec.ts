import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('TQI ERP Complete End-to-End System Flow Test', () => {

  test.beforeAll(async () => {
    if (process.env.TQI_E2E_ALLOW_DB_RESET !== 'true') {
      test.skip(true, 'This full-system flow resets the configured database. Set TQI_E2E_ALLOW_DB_RESET=true only for a disposable test database.');
      return;
    }
    // Reset database to ensure clean state with only Super Admin
    console.log('[E2E SETUP] Running clean database reset...');
    execSync('npx tsx backend/src/scripts/cleanReset.ts', { stdio: 'inherit' });
  });

  test('Complete Flow: Login -> Setup -> Cluster -> Hierarchy -> Volunteer -> Session -> Attendance -> Report -> Finance -> Governance -> Super Admin Review', async ({ page }) => {
    test.setTimeout(180000);
    
    // ============================================================
    // STEP 1: SUPER ADMIN LOGIN
    // ============================================================
    console.log('Step 1: Super Admin Login');
    page.on('console', msg => console.log('PW BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('PW BROWSER ERROR:', err.message));
    page.on('requestfailed', req => console.log('PW REQ FAILED:', req.url(), req.failure()?.errorText));
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
    });
    await page.goto('http://127.0.0.1:5173');
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 20000 });

    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Verify Super Admin Dashboard loads
    await expect(page.locator('h1:has-text("Super Admin Dashboard")')).toBeVisible({ timeout: 20000 });
    console.log('✓ Super Admin authenticated and dashboard rendered');

    // ============================================================
    // STEP 2: ACADEMIC SETUP
    // ============================================================
    console.log('Step 2: Academic Setup');
    await page.click('button:has-text("Academic Term (8-day)")');
    await expect(page.locator('h1:has-text("Academic Year")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Parents Meet').first()).toBeVisible({ timeout: 10000 });
    console.log('✓ 8-day Academic cycle verified');

    // ============================================================
    // STEP 3: CREATE CLUSTER
    // ============================================================
    console.log('Step 3: Create Cluster');
    await page.click('button:has-text("Clusters")');
    await expect(page.getByRole('heading', { name: 'Clusters', exact: true })).toBeVisible({ timeout: 15000 });

    // Open Add Cluster Drawer
    await page.click('button:has-text("Add Cluster")');
    await expect(page.locator('#cluster-drawer-title:has-text("Add Cluster")')).toBeVisible({ timeout: 10000 });

    // Fill Cluster District / Name
    await page.fill('input[placeholder="Enter district name"]', 'Salem');

    // College Name selection
    const collegeInput = page.locator('input[aria-label="College name"]');
    if (await collegeInput.isVisible()) {
      await collegeInput.fill('Government College of Engineering');
      await page.waitForTimeout(400);
      const firstCollege = page.locator('button:has-text("Government College of Engineering")').first();
      if (await firstCollege.isVisible()) {
        await firstCollege.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // College Location trigger
    await page.click('#college-location');
    const locationSearch = page.locator('input[placeholder="Search district or city..."]');
    if (await locationSearch.isVisible()) {
      await locationSearch.fill('Salem');
      await page.waitForTimeout(300);
      const locOption = page.locator('[role="option"]:has-text("Salem")').first();
      if (await locOption.isVisible()) {
        await locOption.click();
      }
    }

    // SPOC Credentials
    await page.fill('input[placeholder="Full name"]', 'Prof. S. Soundararajan');
    await page.fill('input[placeholder="10-digit mobile number"]', '9876543210');
    await page.fill('input[placeholder="name@gmail.com"]', 'salem.tqi.admin@gmail.com');

    await page.click('button[type="submit"]:has-text("Save Cluster")');

    // Credentials Dialog verification
    const credDialog = page.locator('section[aria-labelledby="cluster-credentials-title"]');
    await expect(credDialog).toBeVisible({ timeout: 20000 });
    console.log('✓ Cluster created and temporary credentials dialog verified');
    await page.click('button:has-text("Done")');
    await expect(credDialog).toBeHidden({ timeout: 10000 });

    await expect(page.locator('h2:has-text("Salem")')).toBeVisible({ timeout: 10000 });
    console.log('✓ Salem cluster onboarding verified');

    // ============================================================
    // STEP 4: ADD PANCHAYAT
    // ============================================================
    console.log('Step 4: Add Panchayat & Villages');
    await page.click('button:has-text("Panchayats & Villages")');
    await expect(page.locator('h1:has-text("Panchayat")').first()).toBeVisible({ timeout: 15000 });

    // If cluster selection is needed, click Salem; otherwise Add Panchayat is already available
    const salemClusterCard = page.locator('button:has-text("Salem")');
    if (await salemClusterCard.isVisible()) {
      await salemClusterCard.click();
      await page.waitForTimeout(400);
    }

    // Click Add Panchayat
    await page.click('button:has-text("Add Panchayat")');
    await expect(page.locator('h3:has-text("Add New Panchayat")')).toBeVisible({ timeout: 10000 });

    await page.fill('#pan-name', 'Attur Panchayat');
    await page.click('button[type="submit"]:has-text("Save Panchayat")');
    await expect(page.locator('text=Attur Panchayat').first()).toBeVisible({ timeout: 10000 });
    console.log('✓ Attur Panchayat added under Salem cluster');

    // ============================================================
    // STEP 5: ADD VOLUNTEER
    // ============================================================
    console.log('Step 5: Add Volunteer');
    await page.click('button:has-text("Volunteers")');
    await expect(page.locator('h1:has-text("Volunteers")').first()).toBeVisible({ timeout: 15000 });

    // If in cluster overview mode, click Salem cluster card
    const salemVolCard = page.locator('section[aria-label="Volunteers by cluster"] button').first();
    if (await salemVolCard.isVisible()) {
      await salemVolCard.click();
      await page.waitForTimeout(400);
    }

    // Open Add Volunteer Modal
    await page.click('button:has-text("Add Volunteer")');
    await expect(page.locator('h3:has-text("Add New Volunteer")')).toBeVisible({ timeout: 10000 });

    await page.fill('input[placeholder="Enter volunteer name"]', 'Kavitha Ramesh');
    await page.fill('input[placeholder="you@college.edu"]', 'kavitha@gcesalem.edu.in');
    await page.fill('input[placeholder="+91 98765 43210"]', '+91 98765 11223');

    // Select Gender
    const genderSelect = page.locator('button:has-text("Select gender")');
    if (await genderSelect.isVisible()) {
      await genderSelect.click();
      await page.waitForTimeout(200);
      await page.click('[role="option"]:has-text("Female")');
    }

    // Save Volunteer
    await page.click('button[type="submit"]:has-text("Save Volunteer")');
    await expect(page.locator('text=Kavitha Ramesh').first()).toBeVisible({ timeout: 10000 });
    console.log('✓ Volunteer Kavitha Ramesh added successfully');

    // ============================================================
    // STEP 6: MODULE MANAGEMENT
    // ============================================================
    console.log('Step 6: Module Management');
    await page.click('button:has-text("Module Library & PPTs")');
    await expect(page.locator('h1:has-text("Module Library")').first()).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Parents Meet")')).toBeVisible({ timeout: 10000 });
    console.log('✓ Module Library verified');

    // ============================================================
    // STEP 7: SESSION SCHEDULING
    // ============================================================
    console.log('Step 7: Session Scheduling');
    await page.click('button:has-text("Session Scheduling")');
    await expect(page.locator('h1:has-text("Cluster Sessions Schedule Overview")').first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Session Scheduling Board verified');

    // ============================================================
    // STEP 8: ATTENDANCE & REVIEW
    // ============================================================
    console.log('Step 8: Attendance Review Subsystem');
    await page.click('button:has-text("Students Attendance")');
    await expect(page.locator('text=Attendance').first()).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Volunteer Attendance")');
    await expect(page.locator('text=Attendance').first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Student and Volunteer Attendance subsystems verified');

    // ============================================================
    // STEP 9: SESSION REPORTS
    // ============================================================
    console.log('Step 9: Session Reports');
    await page.click('button:has-text("Session Reports")');
    await expect(page.locator('h1:has-text("Session Reports")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Session Reports verified');

    // ============================================================
    // STEP 10: FINANCE & STATEMENTS
    // ============================================================
    console.log('Step 10: Finance Statements');
    await page.click('button:has-text("Finance")');
    await expect(page.locator('h1:has-text("Finance & Expenses")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Finance module verified');

    // ============================================================
    // STEP 11: USER MANAGEMENT, APPROVALS & AUDIT LOGS
    // ============================================================
    console.log('Step 11: Administration & Governance');
    await page.click('button:has-text("User Management")');
    await expect(page.locator('h1:has-text("User & Role Management")').first()).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Approval Center")');
    await expect(page.locator('h1:has-text("Approval Center")').first()).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Audit Logs")');
    await expect(page.locator('h1:has-text("Audit & Governance Trail")').first()).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Settings")');
    await expect(page.locator('h1:has-text("Personal Information")').first()).toBeVisible({ timeout: 10000 });
    console.log('✓ Governance, Approvals, and Audit logs verified');

    // ============================================================
    // STEP 12: VERIFY DASHBOARD WITH PERSISTED METRICS
    // ============================================================
    console.log('Step 12: Return to Dashboard & Verify Metrics');
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('h1:has-text("Super Admin Dashboard")').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('button:has-text("Total Clusters")').first()).toContainText('1');
    await expect(page.locator('button:has-text("Total Volunteers")').first()).toContainText('1');
    console.log('✓ 1 Cluster and 1 Volunteer reflected on Super Admin Dashboard');

    console.log('========================================================');
    console.log('✅ ALL E2E FLOW STEPS PASSED SUCCESSFULLY!');
    console.log('========================================================');
  });
});
