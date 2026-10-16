import { expect, test } from '@playwright/test'

import { onboard, sheet, sheetClosed } from '../support/app'

test.describe('bottom sheet', () => {
  test.beforeEach(async ({ page }) => onboard(page))

  test('slides away whole when the backdrop is tapped', async ({ page }) => {
    await page.locator('main').getByRole('button', { name: '尿布', exact: true }).click()
    const save = sheet(page).getByRole('button', { name: '保存' })
    await expect(save).toBeVisible()
    await page.waitForTimeout(500)
    await page.mouse.click(195, 40)
    // Mid-slide the sheet is still open and still shows its content.
    await page.waitForTimeout(120)
    await expect(sheet(page)).toHaveCount(1)
    await expect(save).toBeAttached()
    await sheetClosed(page)
  })

  test('closes when dragged down by its header', async ({ page }) => {
    await page.locator('main').getByRole('button', { name: '喂养', exact: true }).click()
    const title = sheet(page).getByRole('heading').first()
    await page.waitForTimeout(500)
    const box = await title.boundingBox()
    if (!box) throw new Error('no sheet header')
    await page.mouse.move(box.x + 20, box.y + 5)
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + 205, { steps: 10 })
    await page.mouse.up()
    await sheetClosed(page)
  })

  test('springs back after a short drag', async ({ page }) => {
    await page.locator('main').getByRole('button', { name: '喂养', exact: true }).click()
    const title = sheet(page).getByRole('heading').first()
    await page.waitForTimeout(500)
    const box = await title.boundingBox()
    if (!box) throw new Error('no sheet header')
    await page.mouse.move(box.x + 20, box.y + 5)
    await page.mouse.down()
    await page.mouse.move(box.x + 20, box.y + 35, { steps: 3 })
    await page.waitForTimeout(100)
    await page.mouse.up()
    await page.waitForTimeout(600)
    await expect(sheet(page)).toHaveCount(1)
  })
})
