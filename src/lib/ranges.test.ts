import { describe, expect, it } from 'vitest'
import { rangeStart } from './ranges'

describe('rangeStart', () => {
  const today = '2026-11-04' // Wed; week starts Mon 2026-11-02

  it('covers whole weeks including the current one', () => {
    expect(rangeStart('4w', today)).toBe('2026-10-12')
    expect(rangeStart('12w', today)).toBe('2026-08-17')
    expect(rangeStart('6m', today)).toBe('2026-05-11')
    expect(rangeStart('1y', today)).toBe('2025-11-10')
  })

  it('has no lower bound for all', () => {
    expect(rangeStart('all', today)).toBeNull()
  })
})
