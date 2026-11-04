import { describe, expect, it } from 'vitest'
import { DEFAULT_RANGE, RANGES, rangeStart } from './ranges'

describe('rangeStart', () => {
  const today = '2026-11-04' // Wed; week starts Mon 2026-11-02

  it('covers whole weeks including the current one', () => {
    expect(rangeStart('1w', today)).toBe('2026-11-02') // this week only
    expect(rangeStart('1m', today)).toBe('2026-10-12') // 4 weeks
    expect(rangeStart('3m', today)).toBe('2026-08-10') // 13 weeks
  })

  it('lists the ranges shortest first, defaulting to 1 month', () => {
    expect(RANGES.map((r) => r.label)).toEqual(['1w', '1m', '3m'])
    expect(DEFAULT_RANGE).toBe('1m')
  })
})
