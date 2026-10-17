// Renders the iOS launch screens listed in src/lib/splash.ts: the app icon centered on
// the dark background. Run manually after changing the icon or the list:
// `node scripts/render-splash.mjs` (needs Playwright).
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { SPLASH_SCREENS, SPLASH_THEME, splashFile } from '../src/lib/splash.ts'
import { THEME_COLORS } from '../src/lib/theme.ts'

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright')
const icon = await readFile(new URL('../public/icons/icon.svg', import.meta.url), 'utf8')
const dir = fileURLToPath(new URL('../public/splash/', import.meta.url))
await rm(dir, { recursive: true, force: true })
await mkdir(dir)

// One page renders the screens one after another on purpose.
/* oxlint-disable no-await-in-loop */
const browser = await chromium.launch()
for (const screen of SPLASH_SCREENS) {
  const page = await browser.newPage({
    viewport: { width: screen.width, height: screen.height },
    deviceScaleFactor: screen.ratio,
  })
  await page.setContent(
    `<style>html,body{margin:0;height:100%;background:${THEME_COLORS[SPLASH_THEME]};display:grid;place-items:center}svg{width:112px;height:112px}</style>${icon}`,
  )
  await writeFile(dir + splashFile(screen), await page.screenshot({ scale: 'device' }))
  await page.close()
}
await browser.close()
