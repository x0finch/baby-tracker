import { expect, test } from '@playwright/test'

import { onboard, signIn } from '../support/app'

// On iPhone, Google sign-in from the installed app finishes in a separate browser sheet
// that shares the session but not this window's data; coming back must pick it up.
test('a window signed out here picks up a sign-in finished elsewhere when it comes back', async ({
  page,
  context,
}) => {
  await onboard(page)
  await page.goto('/settings')
  await expect(page.getByText('未登录 · 记录只保存在这台设备')).toBeVisible()
  // Let the start-up session check finish before the session appears.
  await page.waitForLoadState('networkidle')

  await signIn(context, 'elsewhere')
  await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')))

  await expect(page.getByText(/^爸爸 · /)).toBeVisible({ timeout: 15_000 })
})
