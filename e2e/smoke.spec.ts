import { expect, test } from '@playwright/test'

test('serves the scene shell and keeps the timeline functional', async ({ page }) => {
  const consoleErrors: string[] = []
  const geometryWarnings: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
    if (
      msg.type() === 'warning' &&
      /geometry|material|texture|shader|instanced/i.test(msg.text())
    ) {
      geometryWarnings.push(msg.text())
    }
  })

  await page.goto('/')

  // UI scaffold is present.
  await expect(
    page.getByRole('heading', { name: 'City Time Period Timelapse' }),
  ).toBeVisible()
  await expect(page.getByLabel('Year')).toHaveValue('0')
  await expect(page.locator('#era-output')).toHaveText('1945')
  await expect(page.locator('#mode-badge')).toContainText('orbit')
  // Audio toggle starts muted (no autoplay before a gesture).
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false')
  await expect(page.locator('#audio-toggle')).toContainText('Sound off')

  // Full-viewport WebGL canvas was created and renders.
  await expect(page.locator('canvas')).toBeVisible()
  await expect
    .poll(() => page.locator('canvas').evaluate((el) => el.getBoundingClientRect().width))
    .toBeGreaterThan(300)

  // Resizing the viewport resizes the full-viewport canvas to track it.
  await page.setViewportSize({ width: 900, height: 640 })
  await expect
    .poll(() => page.locator('canvas').evaluate((el) => el.getBoundingClientRect().width))
    .toBe(900)
  await expect
    .poll(() => page.locator('canvas').evaluate((el) => el.getBoundingClientRect().height))
    .toBe(640)

  // Timeline still updates the displayed year.
  await page.getByLabel('Year').evaluate((el, max) => {
    const input = el as HTMLInputElement
    input.value = String(max)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, 5)
  await expect(page.locator('#era-output')).toHaveText('2055')

  // Era store events reach the CityBlock layout: switching to a modern era
  // changes the atmosphere/lamp styling (visible via the year output) and
  // the block re-renders without leaking placeholder meshes or console
  // errors. The smoke check only asserts the wiring stays functional.
  await page.getByLabel('Year').evaluate((el, mid) => {
    const input = el as HTMLInputElement
    input.value = String(mid)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  }, 3)
  await expect(page.locator('#era-output')).toHaveText('2005')
  await page.getByLabel('Year').evaluate((el) => {
    const input = el as HTMLInputElement
    input.value = '0'
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await expect(page.locator('#era-output')).toHaveText('1945')

  // Clicking the audio toggle flips the visible state (gesture-gated).
  await page.locator('#audio-toggle').click()
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#audio-toggle')).toContainText('Sound on')
  await page.locator('#audio-toggle').click()
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false')

  // No console errors on load.
  expect(consoleErrors).toEqual([])
  // No console warnings about missing/shared geometry or materials.
  expect(geometryWarnings).toEqual([])

  // Screenshot evidence: the block renders roads, sidewalks, crosswalks and
  // lamp positions as a full-viewport instanced scene.
  await page.screenshot({ path: 'test-results/city-block-1945.png' })
})