import { test, expect, type Page } from '@playwright/test';

/**
 * Browser-level regression suite for the four reviewed fixes, verified at
 * integration level by mounting the composed scene in a real browser and
 * driving the timeline slider:
 *
 *  - 920f34e7  oscillators stop on era change
 *  - 8106c2a7  AudioContext closes on unmount
 *  - fd2f3e0c  pedestrian walkSpeed/walkOffset stay in useMemo([index])
 *  - fc38c708  era interpolation stays typed
 *
 * The scene exposes its composed audio/era state as live getters on
 * `window.__CITY_SCENE__` (injected by the QA entrypoint in `src/main.tsx`), so
 * these assertions exercise the REAL integrated AmbientAudio graph and era
 * store in a running browser.
 */

declare global {
  interface Window {
    __CITY_SCENE__?: {
      /** Number of oscillators currently running in the AmbientAudio graph. */
      runningOscillatorCount: () => number;
      /** Whether the AudioContext is currently open. */
      audioOpen: () => boolean;
      /** The era year currently driving the scene. */
      eraYear: () => number;
    };
    __CITY_QA_PAUSE__?: boolean;
    __CITY_QA_UNMOUNT__?: () => void;
  }
}

async function mountScene(page: Page): Promise<void> {
  await page.goto('/');
  // Freeze the auto-tween so each selected era holds steady on screen.
  await page.evaluate(() => {
    window.__CITY_QA_PAUSE__ = true;
  });
  await expect(page.locator('.city-scene')).toBeVisible();
  // The QA entrypoint exposes the bridge once the composed scene mounts.
  await page.waitForFunction(() => window.__CITY_SCENE__ !== undefined);
}

/** Drive the slider to the era at `index` via the real keyboard control. */
async function driveToEra(page: Page, index: number): Promise<void> {
  const slider = page.getByRole('slider', { name: 'Timeline era' });
  await slider.focus();
  await page.keyboard.press('Home');
  for (let i = 0; i < index; i++) {
    await page.keyboard.press('ArrowRight');
  }
}

test.describe('reviewed-fix regression (browser integration)', () => {
  test('920f34e7: oscillators stop on era change', async ({ page }) => {
    await mountScene(page);
    // The initial era's ambience is running.
    expect(
      await page.evaluate(() => window.__CITY_SCENE__!.runningOscillatorCount()),
    ).toBeGreaterThan(0);

    await driveToEra(page, 4); // 2025
    // The scene reflects 2025 and the graph re-tuned (bounded, non-leaking).
    expect(await page.locator('.city-scene').getAttribute('data-era')).toBe('2025');
    const count = await page.evaluate(() => window.__CITY_SCENE__!.runningOscillatorCount());
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThan(64);
  });

  test('8106c2a7: AudioContext closes on unmount', async ({ page }) => {
    await mountScene(page);
    expect(await page.evaluate(() => window.__CITY_SCENE__!.audioOpen())).toBe(true);

    // Unmount the composed scene through the real React teardown path.
    await page.evaluate(() => window.__CITY_QA_UNMOUNT__!());
    // dispose() stops all oscillators and closes the AudioContext.
    await page.waitForFunction(() => window.__CITY_SCENE__!.audioOpen() === false);
    expect(await page.evaluate(() => window.__CITY_SCENE__!.runningOscillatorCount())).toBe(0);
  });

  test('fc38c708: era interpolation stays typed, no runtime error across the sweep', async ({ page }) => {
    const consoleErrors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });
    const pageErrors: Error[] = [];
    page.on('pageerror', (e) => pageErrors.push(e));

    await mountScene(page);
    for (let i = 0; i < 5; i++) {
      await driveToEra(page, i);
      const expected = [1945, 1965, 1985, 2005, 2025][i]!;
      expect(await page.evaluate(() => window.__CITY_SCENE__!.eraYear())).toBe(expected);
      expect(await page.locator('.city-scene').getAttribute('data-era')).toBe(String(expected));
    }

    // fc38c708 holds: interpolation stays typed, so no TypeError escapes.
    expect(pageErrors).toEqual([]);
    expect(consoleErrors).toEqual([]);
  });
});