import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { describe, expect, it } from 'vitest'

const SRC = join(import.meta.dirname, '..')
const messages: Record<string, unknown> = JSON.parse(
  readFileSync(join(SRC, '../messages/zh-CN.json'), 'utf8'),
)
const keys = Object.keys(messages).filter((key) => key !== '$schema')

const source = readdirSync(SRC, { recursive: true, encoding: 'utf8' })
  .filter((path) => /\.tsx?$/.test(path) && !path.startsWith('paraglide'))
  .map((path) => readFileSync(join(SRC, path), 'utf8'))
  .join('\n')
const used = new Set(Array.from(source.matchAll(/\bm\.(\w+)/g), (match) => match[1]))

/**
 * Keeps the message file tidy: keys are named `<feature><Thing>` and sorted, so a feature's
 * messages sit together, and none are left behind when the code stops using them.
 */
describe('messages', () => {
  it('are sorted by key', () => {
    expect(keys).toEqual(keys.toSorted())
  })

  it('are all used', () => {
    expect(keys.filter((key) => !used.has(key))).toEqual([])
  })
})
