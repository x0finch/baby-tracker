import { describe, expect, it } from 'vitest'

import {
  DEFAULT_UNITS,
  type UnitPreferences,
  formatQuantity,
  inputValue,
  parseQuantity,
  parseUnitPreferences,
  toDisplay,
} from './units'

const imperial: UnitPreferences = { volume: 'oz', weight: 'lb', length: 'in', temperature: 'f' }

describe('units', () => {
  it('reads stored preferences and falls back per quantity', () => {
    expect(parseUnitPreferences(undefined)).toEqual(DEFAULT_UNITS)
    expect(parseUnitPreferences({ volume: 'oz', weight: 'stone' })).toEqual({
      ...DEFAULT_UNITS,
      volume: 'oz',
    })
  })

  it('converts stored values for display', () => {
    expect(toDisplay('volume', 120, imperial)).toBe(4.1)
    expect(toDisplay('weight', 3.5, imperial)).toBe(7.72)
    expect(toDisplay('length', 50, imperial)).toBe(19.7)
    expect(toDisplay('temperature', 38, imperial)).toBe(100.4)
    expect(formatQuantity('temperature', 37, DEFAULT_UNITS)).toBe('37.0')
    expect(formatQuantity('volume', 120, DEFAULT_UNITS)).toBe('120')
  })

  it('converts entered values to stored units', () => {
    expect(parseQuantity('volume', '4', imperial)).toBe(118.3)
    expect(parseQuantity('temperature', '100.4', imperial)).toBe(38)
    expect(parseQuantity('weight', '', imperial)).toBeNaN()
    expect(parseQuantity('volume', 'abc', DEFAULT_UNITS)).toBeNaN()
  })

  it('never changes a value that is edited and saved unchanged', () => {
    const cases = [
      ['volume', 118.3],
      ['weight', 5.234],
      ['length', 52.07],
      ['temperature', 37.72],
    ] as const
    for (const units of [DEFAULT_UNITS, imperial]) {
      for (const [quantity, stored] of cases) {
        expect(parseQuantity(quantity, inputValue(quantity, stored, units), units)).toBe(stored)
      }
    }
  })
})
