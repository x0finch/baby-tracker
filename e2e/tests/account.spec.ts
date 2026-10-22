import { expect, test } from '@playwright/test'

import { onboard, sheet, sheetClosed, signIn } from '../support/app'

// On iPhone, Google sign-in from the installed app finishes in a separate browser sheet
// that shares the session but not this window's data; coming back must pick it up.
test('a window signed out here picks up a sign-in finished elsewhere when it comes back', async ({
  page,
  context,
}) => {
  await onboard(page)
  await page.goto('/settings')
  await expect(page.getByRole('link', { name: /登录 \/ 注册/ })).toBeVisible()
  // Let the start-up session check finish before the session appears.
  await page.waitForLoadState('networkidle')

  await signIn(context, 'elsewhere')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

  await expect(page.getByText('elsewhere@example.com')).toBeVisible({ timeout: 15_000 })
})

test('signs up with email, renames the account and changes the password', async ({ page }) => {
  // A page that needs an account sends you to sign in and back.
  await page.goto('/settings/reminders')
  await page.getByRole('link', { name: '登录 / 注册' }).click()
  await page.getByText('注册', { exact: true }).click()
  // The local server has no Google client and no way to send email.
  await expect(page.getByRole('button', { name: '使用 Google 登录' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: '忘记密码？' })).toHaveCount(0)

  const email = `new-${Date.now()}@example.com`
  await page.getByLabel('邮箱').fill(email)
  await page.getByLabel(/昵称/).fill('妈妈')
  await page.getByLabel('密码').fill('first-password')
  await page.locator('form button[type=submit]').click()
  await expect(page).toHaveURL(/\/settings\/reminders$/)

  await page.goto('/settings/account')
  await expect(page.getByText(email)).toBeVisible()
  await expect(page.getByText('登录方式：邮箱和密码')).toBeVisible()
  await expect(page.getByRole('button', { name: '在这台设备上添加通行密钥' })).toBeVisible()

  const nickname = page.getByLabel('昵称')
  await nickname.fill('小米粒妈妈')
  // Saved when the field loses focus; let it reach the server before reloading the page.
  const saved = page.waitForResponse((res) => res.url().endsWith('/api/auth/update-user'))
  await nickname.blur()
  await saved
  await page.goto('/settings')
  await expect(page.getByText('小米粒妈妈', { exact: true })).toBeVisible()

  await page.goto('/settings/account')
  await page.getByRole('button', { name: '修改密码' }).click()
  await sheet(page).getByLabel('当前密码').fill('wrong-password')
  await sheet(page).getByLabel('新密码').fill('second-password')
  await sheet(page).getByRole('button', { name: '修改密码' }).click()
  await expect(sheet(page).getByText('当前密码不正确')).toBeVisible()
  await sheet(page).getByLabel('当前密码').fill('first-password')
  await sheet(page).getByRole('button', { name: '修改密码' }).click()
  await sheetClosed(page)
})
