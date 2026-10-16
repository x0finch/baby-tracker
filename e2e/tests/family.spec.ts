import { expect, test } from '@playwright/test'

import { logDiaper, newDevice, onboard, sheet, signIn, syncNow } from '../support/app'

test('invites a family member, who sets an alias, then the owner deletes the family', async ({
  browser,
}) => {
  const owner = await newDevice(browser)
  await onboard(owner.page)
  await logDiaper(owner.page)
  await signIn(owner.context, 'owner')
  await syncNow(owner.page)

  await owner.page.goto('/settings')
  await owner.page.getByRole('link', { name: /测试家长的家/ }).click()
  await owner.page.getByRole('button', { name: '邀请家人' }).click()
  await sheet(owner.page).getByText('管理员').click()
  await sheet(owner.page).getByRole('button', { name: '生成邀请链接' }).click()
  const url = (await sheet(owner.page).locator('p.break-all').innerText()).trim()
  await owner.page.keyboard.press('Escape')

  const grandma = await newDevice(browser)
  await signIn(grandma.context, 'grandma')
  await syncNow(grandma.page)
  await grandma.page.goto(url)
  await grandma.page.getByRole('button', { name: '加入' }).click()
  await expect(grandma.page.getByText('已加入')).toBeVisible({ timeout: 15_000 })
  await syncNow(grandma.page)
  await grandma.page.goto('/settings')
  await grandma.page.getByRole('link', { name: /测试家长的家/ }).click()
  await grandma.page.getByRole('button', { name: '修改备注名' }).click()
  await sheet(grandma.page).getByLabel('备注名').fill('女儿家')
  await sheet(grandma.page).locator('button[type=submit]').click()
  await expect(grandma.page.getByRole('heading', { name: '女儿家' })).toBeVisible()

  // The owner deletes the family; its name must be typed first.
  await owner.page.reload()
  await owner.page.getByRole('button', { name: '删除家庭' }).click()
  const forever = sheet(owner.page).getByRole('button', { name: '永久删除' })
  await expect(forever).toBeDisabled()
  await sheet(owner.page)
    .getByLabel(/确认删除/)
    .fill('测试家长的家')
  await forever.click()
  await expect(owner.page).toHaveURL(/\/settings$/)

  await syncNow(grandma.page)
  await grandma.page.goto('/settings')
  await expect(grandma.page.getByText('女儿家')).toHaveCount(0)

  await owner.context.close()
  await grandma.context.close()
})
