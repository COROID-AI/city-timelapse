import { test, expect } from '@playwright/test';

test('app mounts a WebGL canvas and hides the loading overlay', async ({ page }) => {
  await page.goto('/');

  const app = page.locator('#app');
  await expect(app).toBeVisible();

  // The renderer appends a canvas inside #app once WebGL2 is available.
  const canvas = app.locator('canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });

  // Loading overlay should be dismissed after the first frame renders.
  await expect(page.locator('#loading')).toBeHidden({ timeout: 15_000 });
});