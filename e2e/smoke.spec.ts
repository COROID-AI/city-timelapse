import { expect, test } from '@playwright/test'

test('serves the placeholder page', async ({ page }) => {
  await page.goto('/')
  await expect(
    page.getByRole('heading', { name: 'City Time Period Timelapse' }),
  ).toBeVisible()
  await expect(page.getByLabel('Year')).toHaveValue('0')
  await expect(page.getByRole('status')).toHaveText('1945')
})