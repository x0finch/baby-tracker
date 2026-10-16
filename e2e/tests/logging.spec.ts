import { expect, test } from '@playwright/test'

import { logDiaper, onboard, openRow, sheet, todayRows } from '../support/app'

test('logs a diaper change, deletes it and undoes the delete', async ({ page }) => {
  await onboard(page)
  await logDiaper(page)
  await expect(todayRows(page)).toHaveCount(1)
  // "上次换尿布" now shows how long ago instead of "还没有记录".
  await expect(page.locator('main dd').nth(2)).not.toHaveText('还没有记录')

  await openRow(page)
  await sheet(page).getByRole('button', { name: '删除' }).click()
  await expect(todayRows(page)).toHaveCount(0)

  const toast = page.locator('[data-sonner-toast]', { hasText: '已删除一条记录' })
  await toast.getByRole('button', { name: '撤销' }).click()
  await expect(todayRows(page)).toHaveCount(1)
})

test('starts and stops a sleep timer', async ({ page }) => {
  await onboard(page)
  await page.locator('main').getByRole('button', { name: '睡眠', exact: true }).click()
  await sheet(page).getByRole('button', { name: '现在开始睡觉' }).click()
  await expect(page.getByRole('timer')).toBeVisible()
  await page.getByRole('button', { name: '醒了' }).click()
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(todayRows(page)).toHaveCount(1)
})
