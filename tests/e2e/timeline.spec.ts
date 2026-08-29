import { test, expect } from '@playwright/test';
import { mkdirSync } from 'node:fs';

const YEARS = ['1945', '1965', '1985', '2005', '2025'] as const;
/** Expected handle aria-valuenow (1-based index) per year. */
const VALUENOW: Record<(typeof YEARS)[number], string> = {
  '1945': '1',
  '1965': '2',
  '1985': '3',
  '2005': '4',
  '2025': '5',
};

// Five clicks × camera fly-to settle time plus page load needs headroom over
// the default 30s test timeout.
test.setTimeout(120_000);

test('timeline: clicking each year moves the handle and visibly changes the scene', async ({ page }) => {
  await page.goto('/');

  // The renderer appends a canvas inside #app once WebGL2 is available.
  const canvas = page.locator('#app canvas');
  await expect(canvas).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('#loading')).toBeHidden({ timeout: 15_000 });

  const slider = page.locator('[data-testid="timeline-slider"]');
  await expect(slider).toBeVisible({ timeout: 15_000 });
  await expect(page.locator('[data-testid="timeline-year-label"]')).toHaveText('1945');

  const screenshotDir = 'test-results/timeline';
  mkdirSync(screenshotDir, { recursive: true });

  let previousShot: Buffer | null = null;
  for (const year of YEARS) {
    const stop = page.locator(`[data-testid="timeline-stop-${year}"]`);
    await stop.click();

    // Two-way sync: the label, handle position, and active stop all reflect
    // the store's selected year after the click.
    await expect(page.locator('[data-testid="timeline-year-label"]')).toHaveText(year);
    await expect(page.locator('[data-testid="timeline-handle"]')).toHaveAttribute('aria-valuenow', VALUENOW[year]);
    await expect(stop).toHaveAttribute('aria-pressed', 'true');

    // Let the cinematic camera fly-to settle before capturing the scene.
    await page.waitForTimeout(2_400);

    const shot = await page.screenshot({ path: `${screenshotDir}/timeline-${year}.png` });
    if (previousShot) {
      // The scene must visibly change between eras: the camera flies to a new
      // vantage point, so the rendered frame (PNG bytes) must differ.
      expect(shot.equals(previousShot)).toBe(false);
    }
    previousShot = shot;
  }
});