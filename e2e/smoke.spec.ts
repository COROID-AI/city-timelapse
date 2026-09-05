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

  // Clicking the audio toggle flips the visible state (gesture-gated).
  await page.locator('#audio-toggle').click()
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.locator('#audio-toggle')).toContainText('Sound on')
  await page.locator('#audio-toggle').click()
  await expect(page.locator('#audio-toggle')).toHaveAttribute('aria-pressed', 'false')

  // No console errors on load.
  expect(consoleErrors).toEqual([])
})

test('shows the six-era timeline slider and switches eras', async ({ page }) => {
  await page.goto('/')

  // Top-center slider with all six tick labels visible.
  const slider = page.getByTestId('timeline-slider')
  await expect(slider).toBeVisible()
  for (const year of ['1945', '1965', '1985', '2005', '2025', '2055']) {
    await expect(
      slider.locator(`.timeline-era-label[data-era="${year}"]`),
    ).toBeVisible()
  }

  // Click each tick: the store re-emits and the scene panel updates.
  const scenePanel = page.getByTestId('scene-canvas')
  for (const year of ['1965', '1985', '2005', '2025', '2055']) {
    await slider.locator(`.timeline-tick[data-era="${year}"]`).click()
    await expect(scenePanel).toContainText(`City block — ${year}`)
    await expect(
      slider.locator('.timeline-era-label.is-active'),
    ).toHaveText(year)
  }

  // Keyboard: focus the slider and arrow through all eras.
  const thumb = slider.locator('.timeline-thumb')
  await thumb.focus()
  await expect(thumb).toBeFocused()
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('ArrowLeft')
  }
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('1945')
  for (let i = 0; i < 5; i += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('2055')

  // Drag from 2055 back toward the middle.
  const track = slider.locator('[data-testid="timeline-track"]')
  const trackBox = await track.boundingBox()
  expect(trackBox).not.toBeNull()
  await page.mouse.move(
    trackBox!.x + trackBox!.width * 0.75,
    trackBox!.y + trackBox!.height / 2,
  )
  await page.mouse.down()
  await page.mouse.move(
    trackBox!.x + trackBox!.width * 0.5,
    trackBox!.y + trackBox!.height / 2,
    { steps: 8 },
  )
  await page.mouse.up()
  // 0.5 → index 3 → 2005.
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('2005')
})

test('transitions show and clear the transitioning indicator', async ({ page }) => {
  await page.goto('/')
  const badge = page.getByTestId('timeline-transitioning')
  await expect(badge).toBeHidden()

  await page.getByTestId('timeline-slider').locator('.timeline-tick[data-era="2005"]').click()
  await expect(badge).toBeVisible()
  await expect(page.getByTestId('scene-canvas')).toContainText(
    'City block — 2005',
  )
  await expect(badge).toBeHidden({ timeout: 2_000 })
})