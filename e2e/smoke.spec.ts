import { expect, test } from '@playwright/test'

test('serves the scene shell and keeps the timeline functional', async ({ page }) => {
  const consoleErrors: string[] = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') consoleErrors.push(msg.text())
  })

  await page.goto('/')

  // UI scaffold is present.
  await expect(
    page.getByRole('heading', { name: 'City Time Period Timelapse' }),
  ).toBeVisible()
  await expect(page.getByLabel('Year')).toHaveValue('0')
  await expect(page.locator('#era-output')).toHaveText('1945')
  await expect(page.locator('#mode-badge')).toContainText('orbit')

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

  // No console errors on load.
  expect(consoleErrors).toEqual([])
})