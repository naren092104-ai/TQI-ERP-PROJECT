import { expect, test } from '@playwright/test';

const viewportWidths = [320, 360, 375, 390, 414, 430, 768, 1024, 1280, 1440];

test('login screen has no horizontal overflow across supported viewport widths', async ({ page }) => {
  for (const width of viewportWidths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible();

    const widths = await page.evaluate(() => ({
      viewport: window.innerWidth,
      document: document.documentElement.scrollWidth,
      body: document.body.scrollWidth,
    }));

    expect(widths.document, `document overflow at ${width}px`).toBeLessThanOrEqual(widths.viewport);
    expect(widths.body, `body overflow at ${width}px`).toBeLessThanOrEqual(widths.viewport);
  }
});
