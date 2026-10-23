import { type Page, expect, test } from '@playwright/test'

import { onboard, sheet } from '../support/app'

const point = ([x, y]: [number, number]) => ({ x, y, id: 1 })

/** A finger drag as the phone sends it, holding before letting go. */
async function drag(page: Page, from: [number, number], to: [number, number]) {
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(from)] })
  for (let step = 1; step <= 8; step += 1) {
    const at: [number, number] = [
      from[0] + ((to[0] - from[0]) * step) / 8,
      from[1] + ((to[1] - from[1]) * step) / 8,
    ]
    // oxlint-disable-next-line no-await-in-loop -- a drag is a sequence of moves
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(at)] })
  }
  return async () => {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await cdp.detach()
  }
}

const transformOf = (page: Page, selector: string) =>
  page
    .locator(selector)
    .first()
    .evaluate((element) => (element instanceof HTMLElement ? element.style.transform : ''))

test('the page bounces past its top and springs back', async ({ page }) => {
  await onboard(page)
  await page.goto('/settings')
  await expect(page.getByRole('heading', { name: '设置' })).toBeVisible()
  const release = await drag(page, [200, 300], [200, 460])
  expect(await transformOf(page, 'main')).toMatch(/translate3d\(0px, \d+(\.\d+)?px, 0px\)/)
  await release()
  await expect.poll(() => transformOf(page, 'main')).toBe('')
})

test('a short sheet bounces on its own, without moving the page', async ({ page }) => {
  await onboard(page)
  await page.locator('main').getByRole('button', { name: '更多记录' }).click()
  await expect(sheet(page)).toBeVisible()
  await page.waitForTimeout(500)
  const box = await sheet(page).locator('button').last().boundingBox()
  if (!box) throw new Error('no sheet content')
  const release = await drag(page, [box.x + 20, box.y], [box.x + 20, box.y - 150])
  expect(await transformOf(page, 'dialog[open] > div')).toMatch(/translate3d\(0px, -\d/)
  expect(await transformOf(page, 'main')).toBe('')
  await release()
  await expect.poll(() => transformOf(page, 'dialog[open] > div')).toBe('')
})

test('a chip row bounces sideways at its start', async ({ page }) => {
  await onboard(page)
  await page.locator('main').getByRole('button', { name: '睡眠', exact: true }).click()
  await page.waitForTimeout(500)
  const row = sheet(page).getByRole('group', { name: '持续了多久' }).locator('div').first()
  await row.scrollIntoViewIfNeeded()
  const box = await row.boundingBox()
  if (!box) throw new Error('no chip row')
  const y = box.y + box.height / 2
  const release = await drag(page, [box.x + 40, y], [box.x + 200, y])
  expect(await row.evaluate((element) => element.style.transform)).toMatch(/translate3d\(\d/)
  await release()
  await expect.poll(() => row.evaluate((element) => element.style.transform)).toBe('')
})
