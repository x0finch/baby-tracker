/**
 * iOS launch screens, shown while an installed Bobo starts instead of a blank page. iOS
 * only uses an image whose media query matches the device exactly, so there is one per
 * screen size (portrait, CSS pixels and pixel ratio) and theme. Rendered by
 * scripts/render-splash.mjs.
 */
export const SPLASH_SCREENS = [
  { width: 440, height: 956, ratio: 3 },
  { width: 430, height: 932, ratio: 3 },
  { width: 428, height: 926, ratio: 3 },
  { width: 414, height: 896, ratio: 3 },
  { width: 414, height: 896, ratio: 2 },
  { width: 414, height: 736, ratio: 3 },
  { width: 402, height: 874, ratio: 3 },
  { width: 393, height: 852, ratio: 3 },
  { width: 390, height: 844, ratio: 3 },
  { width: 375, height: 812, ratio: 3 },
  { width: 375, height: 667, ratio: 2 },
  { width: 1032, height: 1376, ratio: 2 },
  { width: 1024, height: 1366, ratio: 2 },
  { width: 834, height: 1210, ratio: 2 },
  { width: 834, height: 1194, ratio: 2 },
  { width: 834, height: 1112, ratio: 2 },
  { width: 820, height: 1180, ratio: 2 },
  { width: 810, height: 1080, ratio: 2 },
  { width: 768, height: 1024, ratio: 2 },
  { width: 744, height: 1133, ratio: 2 },
] as const

// Plain literals and no imports, so scripts/render-splash.mjs can load this file directly.
export const SPLASH_THEMES = ['light', 'dark'] as const

export function splashFile(
  screen: (typeof SPLASH_SCREENS)[number],
  theme: (typeof SPLASH_THEMES)[number],
) {
  return `${screen.width * screen.ratio}x${screen.height * screen.ratio}-${theme}.png`
}

export const splashLinks = SPLASH_SCREENS.flatMap((screen) =>
  SPLASH_THEMES.map((theme) => ({
    rel: 'apple-touch-startup-image',
    href: `/splash/${splashFile(screen, theme)}`,
    media:
      `(device-width: ${screen.width}px) and (device-height: ${screen.height}px) and ` +
      `(-webkit-device-pixel-ratio: ${screen.ratio}) and (orientation: portrait) and ` +
      `(prefers-color-scheme: ${theme})`,
  })),
)
