// TQI-ERP audit script: visits every page, captures console + network errors,
// and detects visible-but-non-functional buttons/links.
// Run: node audit-check.mjs
// Output: audit-results.json

import { chromium } from 'playwright';
import fs from 'fs';

const FRONTEND = 'http://localhost:5173';
const BACKEND  = 'http://localhost:5000';

const PAGES = [
  { name: 'Dashboard',            tab: 'dashboard' },
  { name: 'Academic Term',        tab: 'academic-setup' },
  { name: 'Approvals',            tab: 'approvals' },
  { name: 'Clusters',             tab: 'clusters' },
  { name: 'Audit & Governance',   tab: 'audit-logs' },
  { name: 'User Management',      tab: 'users' },
  { name: 'Panchayats',           tab: 'panchayats' },
  { name: 'Students',             tab: 'students' },
  { name: 'Volunteers',           tab: 'volunteers' },
  { name: 'Sessions',             tab: 'sessions' },
  { name: 'Attendance',           tab: 'attendance' },
  { name: 'Lesson Plan',          tab: 'lesson-plan' },
  { name: 'Session Photos',       tab: 'session-photos' },
  { name: 'Finance',              tab: 'finance' },
  { name: 'Reports',              tab: 'reports' },
  { name: 'Notifications',        tab: 'notifications' },
  { name: 'Settings',             tab: 'settings' },
  { name: 'Date Change Requests', tab: 'date-change-requests' },
  { name: 'Session Reports',      tab: 'session-reports' },
  { name: 'Session Submissions',  tab: 'session-submissions' },
  { name: 'Module Library',       tab: 'module-library' },
];

const report = {
  startedAt: new Date().toISOString(),
  frontend: FRONTEND,
  backend: BACKEND,
  pages: [],
  brokenButtons: [],
  brokenLinks: [],
  apiErrors: [],
  consoleErrors: [],
};

async function login(page) {
  await page.goto(`${FRONTEND}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(500);
  const emailInput = await page.locator('input[type="email"], input[name="email"], input[placeholder*="email" i]').first();
  const pwInput    = await page.locator('input[type="password"]').first();
  if (await emailInput.count()) await emailInput.fill('admin@tqi.org');
  if (await pwInput.count())    await pwInput.fill('Audit@2026');
  const submit = await page.locator('button:has-text("Sign in"), button:has-text("Login"), button[type="submit"]').first();
  if (await submit.count()) await submit.click().catch(() => {});
  // Wait for navigation away from login
  await page.waitForFunction(() => {
    return !document.body.innerText.includes('Sign in') && !document.body.innerText.includes('Welcome back');
  }, { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(800);
}

async function gotoTab(page, tab) {
  // Tabs are stored in localStorage as `tqi_current_tab_<role>` — flip it and reload
  await page.evaluate((t) => {
    const role = JSON.parse(localStorage.getItem('tqi_auth_session') || '{}').role || 'Super Admin';
    localStorage.setItem(`tqi_current_tab_${role}`, t);
  }, tab);
  await page.reload({ waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(1200);
}

async function auditPage(page, pageName, tab) {
  const pageReport = {
    name: pageName,
    tab,
    url: '',
    errors: [],
    apiFailures: [],
    visibleButtons: 0,
    workingButtons: 0,
    deadButtons: [],
    visibleLinks: 0,
    deadLinks: [],
    renderWarnings: [],
  };

  const consoleErrors = [];
  const apiFailures = [];
  const onConsole = (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text());
  };
  const onResponse = (resp) => {
    const url = resp.url();
    if (!url.includes('/api/')) return;
    if (resp.status() >= 400) {
      apiFailures.push({ url, status: resp.status(), method: resp.request().method() });
    }
  };

  page.on('console', onConsole);
  page.on('response', onResponse);

  try {
    await gotoTab(page, tab);
    pageReport.url = page.url();

    // Probe all visible <button>s
    const buttons = await page.locator('button:visible').elementHandles();
    pageReport.visibleButtons = buttons.length;
    for (const b of buttons) {
      const text = (await b.textContent() || '').trim().slice(0, 40);
      const ariaDisabled = await b.getAttribute('aria-disabled');
      const disabled     = await b.isDisabled();
      if (disabled || ariaDisabled === 'true') continue;
      if (!text) continue;
      // Filter decorative/close/X buttons (no text) — already skipped
      // Try clicking and see if anything happens (URL changes, modal opens, network fires)
      try {
        const urlBefore = page.url();
        const beforeRespCount = apiFailures.length;
        await b.click({ trial: false, timeout: 500 }).catch(() => {});
        await page.waitForTimeout(150);
        const urlAfter = page.url();
        if (urlAfter !== urlBefore) {
          pageReport.workingButtons++;
          await page.goBack().catch(() => {});
          await page.waitForTimeout(150);
        } else {
          // Check if modal opened by looking for [role=dialog] or .modal / fixed overlay
          const modalCount = await page.locator('[role="dialog"], .modal, [data-state="open"][data-radix-popper-content-wrapper]').count();
          if (modalCount > 0) {
            pageReport.workingButtons++;
            // Try to close any visible modal so next click isn't blocked
            const closeBtn = await page.locator('button[aria-label="Close"], button:has-text("Cancel"), button:has-text("×")').first();
            if (await closeBtn.count()) await closeBtn.click().catch(() => {});
            await page.waitForTimeout(150);
          } else {
            pageReport.deadButtons.push(text);
          }
        }
      } catch (e) {
        pageReport.deadButtons.push(`${text} (error)`);
      }
    }

    // Probe visible <a> links
    const links = await page.locator('a:visible').elementHandles();
    pageReport.visibleLinks = links.length;
    for (const a of links) {
      const href = await a.getAttribute('href');
      const text = (await a.textContent() || '').trim().slice(0, 40);
      if (!href) {
        pageReport.deadLinks.push({ text, reason: 'no href' });
        continue;
      }
      if (href.startsWith('#') && href.length < 3) continue;
    }
  } catch (e) {
    pageReport.renderWarnings.push(String(e));
  } finally {
    page.off('console', onConsole);
    page.off('response', onResponse);
  }

  pageReport.errors = consoleErrors;
  pageReport.apiFailures = apiFailures;
  report.pages.push(pageReport);
  report.consoleErrors.push({ page: pageName, errors: consoleErrors });
  report.apiErrors.push({ page: pageName, failures: apiFailures });
  if (pageReport.deadButtons.length) report.brokenButtons.push({ page: pageName, buttons: pageReport.deadButtons });
  if (pageReport.deadLinks.length)   report.brokenLinks.push({ page: pageName, links: pageReport.deadLinks });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();

  console.log('▶ Logging in…');
  await login(page);

  for (const p of PAGES) {
    console.log(`▶ Auditing ${p.name} (${p.tab})…`);
    await auditPage(page, p.name, p.tab);
  }

  await browser.close();
  report.finishedAt = new Date().toISOString();

  fs.writeFileSync('audit-results.json', JSON.stringify(report, null, 2));
  console.log('\n✅ Wrote audit-results.json');

  // Print summary
  console.log('\n===== SUMMARY =====');
  console.log(`Pages audited:        ${report.pages.length}`);
  console.log(`Total dead buttons:   ${report.brokenButtons.reduce((s, p) => s + p.buttons.length, 0)}`);
  console.log(`Total dead links:     ${report.brokenLinks.reduce((s, p) => s + p.links.length, 0)}`);
  console.log(`Total API failures:   ${report.apiErrors.reduce((s, p) => s + p.failures.length, 0)}`);
  console.log(`Total console errors: ${report.consoleErrors.reduce((s, p) => s + p.errors.length, 0)}`);
})();
