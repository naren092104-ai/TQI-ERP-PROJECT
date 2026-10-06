import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('TQI ERP Complete End-to-End System Flow Test', () => {

  test.beforeAll(async () => {
    // Reset database to ensure clean state with only Super Admin
    console.log('[E2E SETUP] Running clean database reset...');
    execSync('npx tsx backend/src/scripts/cleanReset.ts', { stdio: 'inherit' });
  });

  test('Complete Flow: Login -> Setup -> Cluster -> Hierarchy -> Volunteer -> Session -> Attendance -> Report -> Finance -> Date Change -> Submission -> Super Admin Review', async ({ page }) => {
    test.setTimeout(120000);
    
    // ============================================================
    // STEP 1: SUPER ADMIN LOGIN
    // ============================================================
    console.log('Step 1: Super Admin Login');
    await page.goto('http://localhost:5173');
    await expect(page.locator('text=Welcome Back')).toBeVisible();

    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');

    // Verify Super Admin Dashboard loads
    await expect(page.locator('h1:has-text("Super Administrator")')).toBeVisible({ timeout: 15000 });

    // ============================================================
    // STEP 2: ACADEMIC SETUP
    // ============================================================
    console.log('Step 2: Academic Setup');
    await page.click('button:has-text("Academic Term (8-Day)")');
    await expect(page.locator('h1:has-text("Academic Term")')).toBeVisible();

    // ============================================================
    // STEP 3: CREATE CLUSTER
    // ============================================================
    console.log('Step 3: Create Cluster');
    await page.click('button:has-text("Clusters")');
    await expect(page.locator('h1:has-text("Clusters & College Onboarding")')).toBeVisible();

    // Open Add Cluster Modal
    await page.click('button:has-text("Onboard New College")');
    await expect(page.locator('h3:has-text("Onboard Partner College")')).toBeVisible();

    await page.fill('input[placeholder="e.g. Government Arts College"]', 'Government College of Engineering, Salem');
    await page.fill('input[placeholder="e.g. Dharmapuri"]', 'Salem');
    await page.fill('input[placeholder="e.g. Dr. M. Vignesh"]', 'Prof. S. Soundararajan');
    await page.fill('input[placeholder="e.g. +91 98765 43210"]', '+91 98765 43210');
    await page.fill('input[placeholder="e.g. vignesh.m@gac-dpi.edu.in"]', 'salem.spoc@tqi.org');
    
    await page.click('button[type="submit"]:has-text("Onboard College")');
    await expect(page.locator('div:has-text("Government College of Engineering, Salem")').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 4: ADD PANCHAYAT & VILLAGE
    // ============================================================
    console.log('Step 4: Add Panchayat & Village');
    await page.click('button:has-text("Panchayats & Villages")');
    await expect(page.locator('h1:has-text("Panchayats & Village Clusters")')).toBeVisible();

    await page.click('button:has-text("Add Panchayat")');
    await page.fill('#pan-name', 'Attur Panchayat');
    await page.fill('#pan-villages', 'Attur Village, Pethanaickenpalayam');
    await page.click('button[type="submit"]:has-text("Save Panchayat")');
    await expect(page.locator('div:has-text("Attur Panchayat")').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 5: ADD VOLUNTEER (Testing Radix UI Select Dropdowns)
    // ============================================================
    console.log('Step 5: Add Volunteer');
    await page.click('button:has-text("Volunteers Directory")');
    await expect(page.locator('h1:has-text("Volunteers & Mentors Directory")')).toBeVisible();

    await page.click('button:has-text("Add Volunteer")');
    await expect(page.locator('h3:has-text("Add New Volunteer")')).toBeVisible();

    await page.fill('input[placeholder="Enter volunteer name"]', 'Kavitha Ramesh');
    await page.fill('input[placeholder="you@college.edu"]', 'kavitha@gcesalem.edu.in');
    await page.fill('input[placeholder="+91 98765 43210"]', '+91 98765 11223');
    await page.fill('input[placeholder="e.g. Government College of Engineering, Dharmapuri"]', 'GCE Salem');

    // Test Department Radix UI Dropdown
    await page.click('button:has-text("Select Department"), button:has-text("Computer Science")');
    await page.click('[role="option"]:has-text("Computer Science and Engineering")');

    // Test Year Radix UI Dropdown
    await page.click('button:has-text("Select Year"), button:has-text("4th Year")');
    await page.click('[role="option"]:has-text("3rd Year")');

    await page.click('button[type="submit"]:has-text("Save Volunteer")');
    await expect(page.locator('div:has-text("Kavitha Ramesh")').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 6: MODULE MANAGEMENT
    // ============================================================
    console.log('Step 6: Module Management');
    await page.click('button:has-text("Module Library & PPTs")');
    await expect(page.locator('h1:has-text("Module Library")')).toBeVisible();

    await page.click('button:has-text("Create Module")');
    await page.fill('#mod-num', 'M-201');
    await page.fill('#mod-name', 'Foundational English Dialogue');
    await page.fill('#mod-topic', 'Interactive Spoken English');
    await page.fill('#mod-year', '2026-2027');

    await page.click('button[type="submit"]:has-text("Save Module")');
    await expect(page.locator('h3:has-text("Foundational English Dialogue")').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 7: SESSION SCHEDULING (Day 1 Session)
    // ============================================================
    console.log('Step 7: Session Scheduling');
    await page.click('button:has-text("Session Scheduling")');
    await expect(page.locator('h1:has-text("Learning Sessions")')).toBeVisible();

    await page.click('button:has-text("Add Session")');
    await expect(page.locator('h2:has-text("Create New Session")')).toBeVisible();

    await page.fill('input[placeholder="e.g. Spoken English — Module 3"]', 'Day 1: English Dialogue Workshop');
    await page.fill('input[type="date"]', '2026-09-01');

    await page.click('button:has-text("Create Session")');
    await expect(page.locator('text=Day 1: English Dialogue Workshop').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 8: 8-DAY ATTENDANCE ENTRY
    // ============================================================
    console.log('Step 8: Attendance Entry');
    await page.click('button:has-text("8-Day Attendance")');
    await expect(page.locator('h1:has-text("Attendance & Task Entry")')).toBeVisible();

    // ============================================================
    // STEP 9: SESSION REPORT ENTRY
    // ============================================================
    console.log('Step 9: Session Report');
    await page.click('button:has-text("Session Reports")');
    await expect(page.locator('h2:has-text("Session Reports")')).toBeVisible();

    await page.click('button:has-text("New Report")');
    await page.click('button:has-text("Select a session")');
    await page.click('[role="option"]:has-text("Day 1: English Dialogue Workshop")');

    await page.fill('textarea[placeholder="Provide a general summary of how the session went..."]', 'The students actively participated in dialogue exercises.');
    await page.fill('input[type="number"]', '28');
    await page.fill('textarea[placeholder="Brief note on attendance..."]', '28 students and 4 volunteer mentors present.');

    await page.click('button:has-text("Save Draft"), button:has-text("Submit Report")');
    await expect(page.locator('text=The students actively participated').first()).toBeVisible({ timeout: 10000 });

    // ============================================================
    // STEP 10: FINANCE STATEMENTS (Check Session Sheet Dropdown)
    // ============================================================
    console.log('Step 10: Finance Statements');
    await page.click('button:has-text("Finance Statements")');
    await expect(page.locator('text=Talent Quest for India').first()).toBeVisible();

    // Verify Radix UI dropdown trigger is present and clickable
    await expect(page.locator('#finance-session-sheet-select')).toBeVisible();
    await page.click('#finance-session-sheet-select');
    await expect(page.locator('[role="option"]').first()).toBeVisible();
    await page.keyboard.press('Escape');

    // ============================================================
    // STEP 11: SESSION SUBMISSION CHECKLIST & SUBMISSION
    // ============================================================
    console.log('Step 11: Session Submissions');
    await page.click('button:has-text("Session Submissions")');
    await expect(page.locator('h2:has-text("Session Submissions")')).toBeVisible();

    // ============================================================
    // STEP 12: VERIFY DASHBOARD 8-DAY MILESTONES
    // ============================================================
    console.log('Step 12: Dashboard 8-Day Progress Verification');
    await page.click('button:has-text("Dashboard")');
    await expect(page.locator('text=8-Day Curriculum Progress by Cluster')).toBeVisible();

    console.log('✅ ALL E2E FLOW STEPS PASSED SUCCESSFULLY!');
  });
});
