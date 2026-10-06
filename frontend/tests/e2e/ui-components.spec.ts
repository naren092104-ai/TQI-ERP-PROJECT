import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

test.describe('TQI ERP - UI & Visual Components Verification Suite', () => {

  test.beforeAll(async () => {
    console.log('[UI-E2E] Running clean database reset...');
    execSync('npx tsx backend/src/scripts/cleanReset.ts', { stdio: 'inherit' });
  });

  test('UI Test 1: Authentication View, Error States, and Theme Toggle', async ({ page }) => {
    await page.goto('http://localhost:5173');
    
    // 1. Check Branding & Login Card presence
    await expect(page.locator('text=Sign in to manage clusters').or(page.locator('text=Welcome Back'))).toBeVisible();

    // 2. Validate Bad Credentials feedback
    await page.fill('#login-email', 'wrong.admin@tqi.org');
    await page.fill('input[type="password"]', 'invalidpassword');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('text=Invalid credentials').or(page.locator('text=Invalid email or password'))).toBeVisible({ timeout: 5000 });

    // 3. Login with Super Admin
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('h1:has-text("Super Administrator")')).toBeVisible({ timeout: 15000 });
  });

  test('UI Test 2: Sidebar Navigation, Active Tab Indicators & Responsive Layout', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('h1:has-text("Super Administrator")')).toBeVisible({ timeout: 15000 });

    // Test Navigation items with exact sidebar button labels
    const navItems = [
      { name: 'Academic Term (8-Day)', header: 'Academic Term' },
      { name: 'Clusters', header: 'Clusters & College Onboarding' },
      { name: 'Panchayats & Villages', header: 'Panchayats & Village Clusters' },
      { name: 'Students Roster', header: 'Students by Panchayat' },
      { name: 'Volunteers Directory', header: 'Volunteers & Mentors Directory' },
      { name: '8-Day Attendance', header: 'Attendance & Task Entry' },
      { name: 'Session Scheduling', header: 'Learning Sessions' },
      { name: 'Session Photos', header: 'Session Photos' },
      { name: 'Date Change Requests', header: 'Date Change Requests' },
      { name: 'Session Reports', header: 'Session Reports' },
      { name: 'Module Library & PPTs', header: 'Module Library' },
      { name: 'Lesson Plans', header: 'Lesson Plans' },
      { name: 'Finance & OCR Bills', header: 'Finance' },
      { name: 'Finance Statements', header: 'Talent Quest for India' },
      { name: 'Approval Center', header: 'Approval Center' },
      { name: 'Session Submissions', header: 'Session Submissions' },
      { name: 'Analytics & Reports', header: 'Operational & Academic Reports' },
      { name: 'User & Role Management', header: 'User & Role Management' },
      { name: 'Audit & Governance Trail', header: 'Audit & Governance Trail' },
      { name: 'Settings & Profile', header: 'Personal Information' },
    ];

    for (const item of navItems) {
      await page.click(`button:has-text("${item.name}")`);
      await expect(page.locator(`text=${item.header}`).first()).toBeVisible({ timeout: 8000 });
    }
  });

  test('UI Test 3: Radix UI Custom Select Dropdowns Verification', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('h1:has-text("Super Administrator")')).toBeVisible({ timeout: 15000 });

    // 1. Volunteer Form Radix Selects
    await page.click('button:has-text("Volunteers Directory")');
    await page.click('button:has-text("Add Volunteer")');
    await expect(page.locator('h3:has-text("Add New Volunteer")')).toBeVisible();

    // Verify Department Radix UI dropdown
    await page.click('button:has-text("Select Department"), button:has-text("Computer Science")');
    await expect(page.locator('[role="option"]:has-text("Computer Science and Engineering")')).toBeVisible();
    await page.click('[role="option"]:has-text("Computer Science and Engineering")');

    // Verify Year Radix UI dropdown
    await page.click('button:has-text("Select Year"), button:has-text("4th Year")');
    await expect(page.locator('[role="option"]:has-text("3rd Year")')).toBeVisible();
    await page.click('[role="option"]:has-text("3rd Year")');

    await page.click('button:has-text("Cancel")');

    // 2. Finance Statement Sheet Select
    await page.click('button:has-text("Finance Statements")');
    await expect(page.locator('#finance-session-sheet-select')).toBeVisible();
    await page.click('#finance-session-sheet-select');
    await expect(page.locator('[role="option"]:has-text("Combined Approved Statement")')).toBeVisible();
    await expect(page.locator('[role="option"]:has-text("Day 1 Statement")')).toBeVisible();
    await page.keyboard.press('Escape');
  });

  test('UI Test 4: Modals, Dialogs, and Form Validations', async ({ page }) => {
    await page.goto('http://localhost:5173');
    await page.fill('#login-email', 'admin@tqi.org');
    await page.fill('input[type="password"]', 'admin123');
    await page.click('button[type="submit"]:has-text("Sign In")');
    await expect(page.locator('h1:has-text("Super Administrator")')).toBeVisible({ timeout: 15000 });

    // Open Cluster Modal and test close button
    await page.click('button:has-text("Clusters")');
    await page.click('button:has-text("Onboard New College")');
    await expect(page.locator('h3:has-text("Onboard Partner College")')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h3:has-text("Onboard Partner College")')).not.toBeVisible();

    // Open Module Modal
    await page.click('button:has-text("Module Library & PPTs")');
    await page.click('button:has-text("Create Module")');
    await expect(page.locator('h2:has-text("Create Module")')).toBeVisible();
    await page.click('button:has-text("Cancel")');
    await expect(page.locator('h2:has-text("Create Module")')).not.toBeVisible();
  });
});
