import { test, expect, type Page } from '@playwright/test';

/**
 * End-to-end era-transition test.
 *
 * Mounts the composed scene, drives the REAL top timeline slider through
 * 1945/1965/1985/2005/2025, and asserts the on-screen scene transforms at each
 * era with no console errors. Captures a per-era screenshot so the evidence
 * shows visually distinct buildings, vehicles, storefronts, ads, outfits and
 * atmosphere (no gray placeholder blocks).
 */

/** The five canonical eras, in order. */
const YEARS = [1945, 1965, 1985, 2005, 2025];

/** The screenshot output directory (committed evidence). */
const SHOT_DIR = 'tests/screenshots';

/** Drive the top timeline slider to the era at `index` (0..4) via arrow keys. */
async function driveToEra(page: Page, index: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Timeline era' });
  await slider.focus();
  // Home = first era; ArrowRight steps forward one era.
  await page.keyboard.press('Home');
  for (let i = 0; i < index; i++) {
    await page.keyboard.press('ArrowRight');
  }
}

test.describe('era transition E2E', () => {
  test('drives the slider across all five eras and transforms the scene with no console errors', async ({
    page,
  }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') {
        consoleErrors.push(msg.text());
      }
    });
    const pageErrors: Error[] = [];
    page.on('pageerror', (err) => pageErrors.push(err));

    await page.goto('/');

    // Freeze the auto-tween so each selected era holds steady on screen (the
    // real year is still driven by the slider).
    await page.evaluate(() => {
      (window as unknown as { __CITY_QA_PAUSE__?: boolean }).__CITY_QA_PAUSE__ = true;
    });

    // The composed scene mounts.
    await expect(page.locator('.city-scene')).toBeVisible();
    await expect(page.getByRole('slider', { name: 'Timeline era' })).toBeVisible();

    // Track per-era evidence of a genuinely transforming scene.
    const skyColors = new Set<string>();
    const styleIds = new Set<string>();
    const sfxIds = new Set<string>();

    for (let i = 0; i < YEARS.length; i++) {
      const year = YEARS[i]!;
      await driveToEra(page, i);

      // The scene root reflects the selected era.
      await expect(page.locator('.city-scene')).toHaveAttribute('data-era', String(year));

      // The visible stage transforms: sky tint + architecture style + sfx.
      const view = page.locator('.city-view');
      await expect(view).toBeVisible();
      const sky = await view.getAttribute('data-sky');
      const style = await page.locator('.epoch-style').textContent();
      const sfx = await page.locator('.sfx-label').getAttribute('data-sfx');
      expect(sky).toBeTruthy();
      skyColors.add(sky!);
      styleIds.add((style ?? '').trim());
      sfxIds.add(sfx ?? '');

      // Distinct content is present (no gray placeholder blocks).
      await expect(page.locator('.skyline .block').first()).toBeVisible();
      await expect(page.locator('.street .vehicle').first()).toBeVisible();
      await expect(page.locator('.storefronts .sign').first()).toBeVisible();
      await expect(page.locator('.storefronts .ad').first()).toBeVisible();
      await expect(page.locator('.crowd .person').first()).toBeVisible();

      // Per-era screenshot evidence.
      await page.screenshot({
        path: `${SHOT_DIR}/era-${year}.png`,
        fullPage: true,
      });
    }

    // Every era produced a distinct sky, architecture style and SFX profile —
    // proving the scene genuinely transforms (not a static/stubbed screen).
    expect(skyColors.size).toBe(5);
    expect(styleIds.size).toBe(5);
    expect(sfxIds.size).toBe(5);

    // No console or page errors across the whole transition.
    expect(pageErrors, `page errors: ${pageErrors.map((e) => e.message).join('; ')}`).toEqual([]);
    expect(consoleErrors, `console errors: ${consoleErrors.join('; ')}`).toEqual([]);
  });
});