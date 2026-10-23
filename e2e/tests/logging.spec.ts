import { expect, test } from '@playwright/test'

import { logDiaper, onboard, openRow, sheet, sheetClosed, todayRows } from '../support/app'

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

test('times pumping and asks for the amount when it stops', async ({ page }) => {
  await onboard(page)
  await page.locator('main').getByRole('button', { name: '更多记录' }).click()
  await sheet(page).getByRole('button', { name: '吸奶' }).click()
  await sheet(page).getByRole('button', { name: '开始计时' }).click()
  await sheetClosed(page)
  await expect(page.getByText('吸奶中 · 双侧')).toBeVisible()
  await page.getByRole('button', { name: '结束' }).click()
  await sheet(page)
    .getByLabel(/吸奶量/)
    .fill('80')
  await sheet(page).getByRole('button', { name: '结束' }).click()
  await sheetClosed(page)
  await expect(page.getByRole('timer')).toHaveCount(0)
  await expect(todayRows(page)).toHaveCount(1)
})

test('logs a breastfeed afterwards with minutes on each side', async ({ page }) => {
  await onboard(page)
  await page.locator('main').getByRole('button', { name: '喂养', exact: true }).click()
  // Left is suggested first; it starts with the usual 10 minutes. Add 5 on the right.
  const right = sheet(page).getByRole('group', { name: '右侧喂了多久' })
  await right.getByText('5 分钟', { exact: true }).click()
  await expect(sheet(page).getByText(/^结束于 /)).toBeVisible()
  await sheet(page).getByRole('button', { name: '保存' }).click()
  await sheetClosed(page)
  await expect(page.getByText('左 10 分钟 · 右 5 分钟')).toBeVisible()
})
