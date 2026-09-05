import { expect, test } from '@playwright/test'

test('shows the five-era timeline slider and switches eras', async ({ page }) => {
  await page.goto('/')

  // Top-center slider with all five tick labels visible.
  const slider = page.getByTestId('timeline-slider')
  await expect(slider).toBeVisible()
  for (const year of ['1945', '1965', '1985', '2005', '2025']) {
    await expect(
      slider.locator(`.timeline-era-label[data-era="${year}"]`),
    ).toBeVisible()
  }

  // Click each tick: the store re-emits and the scene panel updates.
  const scenePanel = page.getByTestId('scene-canvas')
  for (const year of ['1965', '1985', '2005', '2025']) {
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
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('ArrowLeft')
  }
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('1945')
  for (let i = 0; i < 4; i += 1) {
    await page.keyboard.press('ArrowRight')
  }
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('2025')

  // Drag from 2025 back toward the middle.
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
  // 0.5 → index 2 → 1985.
  await expect(slider.locator('.timeline-era-label.is-active')).toHaveText('1985')
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