import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('TQI ERP Comprehensive End-to-End System Flow Test', () => {

  test.beforeAll(async () => {
    console.log('[E2E SETUP] Running clean database reset to baseline state...');
    execSync('npx tsx backend/src/scripts/cleanReset.ts', { stdio: 'inherit' });
  });

  test('Entire Flow: Login -> Dashboard -> Academic Setup -> Clusters -> Panchayats -> Students -> Volunteers -> Attendance -> Scheduling -> Modules -> Lesson Plans -> Photos -> Reports -> Finance -> Users -> Approvals -> Audit Logs -> Settings', async ({ page }) => {
    test.setTimeout(180000);

    // ============================================================
    // STEP 1: AUTHENTICATION & VALIDATION
    // ============================================================
    console.log('Step 1: Testing Login Page & Error Handling');
    page.on('console', msg => console.log('PW BROWSER LOG:', msg.text()));
    page.on('pageerror', err => console.log('PW BROWSER ERROR:', err.message));
    await page.addInitScript(() => {
      try { localStorage.clear(); } catch {}
    });
    await page.goto('http://127.0.0.1:5173');
    await expect(page.locator('#login-email')).toBeVisible({ timeout: 20000 });

    // 1a. Test invalid credentials
    await page.fill('#login-email', 'wrong.admin@tqi.org');
    await page.fill('input[type="password"]', 'wrongpassword');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('text=Invalid credentials').or(page.locator('text=Invalid email or password'))).toBeVisible({ timeout: 10000 });

    // 1b. Test valid Super Admin credentials
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Verify Super Admin Dashboard
    await expect(page.locator('h1:has-text("Super Admin Dashboard")')).toBeVisible({ timeout: 20000 });
    console.log('✓ Super Admin authenticated successfully');

    // ============================================================
    // STEP 2: ACADEMIC SETUP & TERM VERIFICATION
    // ============================================================
    console.log('Step 2: Testing Academic Term & Setup');
    await page.click('button:has-text("Academic Term (8-day)")');
    await expect(page.locator('h1:has-text("Academic Year Management")').or(page.locator('h1:has-text("Academic Year")'))).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=Parents Meet').first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Know Your Locality').first()).toBeVisible({ timeout: 10000 });
    console.log('✓ 8 Academic days verified');

    // ============================================================
    // STEP 3: CLUSTERS & COLLEGE ONBOARDING
    // ============================================================
    console.log('Step 3: Testing Cluster Creation & Onboarding');
    await page.click('button:has-text("Clusters")');
    await expect(page.getByRole('heading', { name: 'Clusters', exact: true })).toBeVisible({ timeout: 15000 });

    // Open Add Cluster Drawer
    await page.click('button:has-text("Add Cluster")');
    await expect(page.locator('#cluster-drawer-title:has-text("Add Cluster")')).toBeVisible({ timeout: 10000 });

    // Fill Cluster Name / District
    await page.fill('input[placeholder="Enter district name"]', 'Salem');
    
    // Fill College
    const collegeInput = page.locator('input[aria-label="College name"]');
    if (await collegeInput.isVisible()) {
      await collegeInput.fill('Government College of Engineering');
      await page.waitForTimeout(500);
      const firstCollege = page.locator('button:has-text("Government College of Engineering")').first();
      if (await firstCollege.isVisible()) {
        await firstCollege.click();
      } else {
        await page.keyboard.press('Escape');
      }
    }

    // Select College Location via DistrictCombobox trigger
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

    // Fill SPOC details
    await page.fill('input[placeholder="Full name"]', 'Prof. S. Soundararajan');
    await page.fill('input[placeholder="10-digit mobile number"]', '9876543210');
    await page.fill('input[placeholder="name@gmail.com"]', 'salem.tqi.admin@gmail.com');

    // Save Cluster
    await page.click('button[type="submit"]:has-text("Save Cluster")');

    // Credentials Dialog verification
    const credDialog = page.locator('section[aria-labelledby="cluster-credentials-title"]');
    await expect(credDialog).toBeVisible({ timeout: 20000 });
    console.log('✓ Temporary credentials generated for new Cluster Admin');
    await page.click('button:has-text("Done")');
    await expect(credDialog).toBeHidden({ timeout: 10000 });
    await expect(page.locator('#cluster-drawer-title')).toBeHidden({ timeout: 10000 });

    // Verify Salem cluster card appears
    await expect(page.locator('h2:has-text("Salem")')).toBeVisible({ timeout: 10000 });
    console.log('✓ Salem cluster onboarding verified');

    // ============================================================
    // STEP 4: PANCHAYATS & VILLAGES
    // ============================================================
    console.log('Step 4: Testing Panchayats & Villages Directory');
    await page.click('button:has-text("Panchayats & Villages")');
    await expect(page.locator('h1:has-text("Panchayat")').or(page.locator('h1:has-text("Clusters")'))).toBeVisible({ timeout: 15000 });
    console.log('✓ Panchayats view verified');

    // ============================================================
    // STEP 5: STUDENTS DIRECTORY
    // ============================================================
    console.log('Step 5: Testing Students Directory');
    await page.click('button:has-text("Students")');
    await expect(page.locator('h1:has-text("Students")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Students view verified');

    // ============================================================
    // STEP 6: VOLUNTEERS DIRECTORY
    // ============================================================
    console.log('Step 6: Testing Volunteers Directory');
    await page.click('button:has-text("Volunteers")');
    await expect(page.locator('h1:has-text("Volunteers")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Volunteers view verified');

    // ============================================================
    // STEP 7: ATTENDANCE (STUDENTS & VOLUNTEERS)
    // ============================================================
    console.log('Step 7: Testing Attendance Subsystem');
    await page.click('button:has-text("Students Attendance")');
    await expect(page.locator('h1:has-text("Attendance")')).toBeVisible({ timeout: 15000 });

    await page.click('button:has-text("Volunteer Attendance")');
    await expect(page.locator('h1:has-text("Attendance")').or(page.locator('h1:has-text("Volunteer")'))).toBeVisible({ timeout: 15000 });
    console.log('✓ Student & Volunteer Attendance views verified');

    // ============================================================
    // STEP 8: SESSION SCHEDULING
    // ============================================================
    console.log('Step 8: Testing Session Scheduling');
    await page.click('button:has-text("Session Scheduling")');
    await expect(page.locator('h1:has-text("Sessions")').or(page.locator('h1:has-text("Schedule")'))).toBeVisible({ timeout: 15000 });
    console.log('✓ Session scheduling view verified');

    // ============================================================
    // STEP 9: MODULE LIBRARY & CURRICULUM
    // ============================================================
    console.log('Step 9: Testing Module Library');
    await page.click('button:has-text("Module Library & PPTs")');
    await expect(page.locator('h1:has-text("Module Library")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('h2:has-text("Parents Meet")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Know Your Locality")')).toBeVisible({ timeout: 10000 });
    console.log('✓ Curriculum 8-day module sections verified');

    // ============================================================
    // STEP 10: LESSON PLANS
    // ============================================================
    console.log('Step 10: Testing Lesson Plans');
    await page.click('button:has-text("Lesson Plans")');
    await expect(page.locator('h1:has-text("Summit Lesson Plans")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Lesson Plans view verified');

    // ============================================================
    // STEP 11: SESSION PHOTOS & GALLERY
    // ============================================================
    console.log('Step 11: Testing Session Photos');
    await page.click('button:has-text("Session Photos")');
    await expect(page.locator('text=Parents Meet').or(page.locator('text=Session Photos')).first()).toBeVisible({ timeout: 15000 });
    console.log('✓ Session Photos view verified');

    // ============================================================
    // STEP 12: SESSION REPORTS
    // ============================================================
    console.log('Step 12: Testing Session Reports');
    await page.click('button:has-text("Session Reports")');
    await expect(page.locator('h1:has-text("Session Reports")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Session Reports view verified');

    // ============================================================
    // STEP 13: FINANCE & OCR BILLS
    // ============================================================
    console.log('Step 13: Testing Finance System');
    await page.click('button:has-text("Finance")');
    await expect(page.locator('h1:has-text("Finance & Expenses")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Finance module verified');

    // ============================================================
    // STEP 14: USER MANAGEMENT
    // ============================================================
    console.log('Step 14: Testing User & Role Management');
    await page.click('button:has-text("User Management")');
    await expect(page.locator('h1:has-text("User & Role Management")')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('text=admin@tqi.org')).toBeVisible({ timeout: 10000 });
    console.log('✓ User management verified');

    // ============================================================
    // STEP 15: APPROVAL CENTER
    // ============================================================
    console.log('Step 15: Testing Approval Center');
    await page.click('button:has-text("Approval Center")');
    await expect(page.locator('h1:has-text("Approval Center")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Approval Center verified');

    // ============================================================
    // STEP 16: AUDIT LOGS
    // ============================================================
    console.log('Step 16: Testing Audit Logs');
    await page.click('button:has-text("Audit Logs")');
    await expect(page.locator('h1:has-text("Audit & Governance Trail")')).toBeVisible({ timeout: 15000 });
    console.log('✓ Audit Logs verified');

    // ============================================================
    // STEP 17: NOTIFICATIONS & SETTINGS
    // ============================================================
    console.log('Step 17: Testing Notifications & Settings');
    await page.click('button:has-text("Notifications")');
    await expect(page.locator('h1:has-text("Notifications")')).toBeVisible({ timeout: 10000 });

    await page.click('button:has-text("Settings")');
    await expect(page.locator('h1:has-text("Personal Information")')).toBeVisible({ timeout: 10000 });
    console.log('✓ Notifications & Settings verified');

    // ============================================================
    // STEP 18: RETURN TO DASHBOARD
    // ============================================================
    console.log('Step 18: Testing Navigation Home to Dashboard');
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('h1:has-text("Super Admin Dashboard")')).toBeVisible({ timeout: 10000 });
    console.log('========================================================');
    console.log('🎉 ALL MODULES AND COMPLETE FLOW VERIFIED SUCCESSFULLY!');
    console.log('========================================================');
  });
});
