import { describe, expect, it } from 'vitest'
import { pace, weeklyMileage } from './metrics'

describe('pace', () => {
  it('is seconds per mile', () => {
    expect(pace(2730, 5)).toBe(546)
    expect(pace(3600, 6.2)).toBeCloseTo(580.645, 3)
  })
  it('rejects zero, negative, and non-finite inputs', () => {
    expect(() => pace(0, 5)).toThrow(RangeError)
    expect(() => pace(2730, 0)).toThrow(RangeError)
    expect(() => pace(-1, 5)).toThrow(RangeError)
    expect(() => pace(2730, -5)).toThrow(RangeError)
    expect(() => pace(Number.NaN, 5)).toThrow(RangeError)
    expect(() => pace(2730, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('weeklyMileage', () => {
  it('sums runs per Monday-start week', () => {
    const runs = [
      { date: '2026-11-02', distanceMi: 3 }, // Mon
      { date: '2026-11-08', distanceMi: 5 }, // Sun, same week
      { date: '2026-11-09', distanceMi: 4 }, // next Mon
    ]
    expect(weeklyMileage(runs, '2026-11-02', '2026-11-09')).toEqual([
      { weekStart: '2026-11-02', miles: 8 },
      { weekStart: '2026-11-09', miles: 4 },
    ])
  })

  it('shows weeks with no runs as 0', () => {
    const runs = [
      { date: '2026-10-19', distanceMi: 3 },
      { date: '2026-11-04', distanceMi: 6 },
    ]
    expect(weeklyMileage(runs, '2026-10-19', '2026-11-04')).toEqual([
      { weekStart: '2026-10-19', miles: 3 },
      { weekStart: '2026-10-26', miles: 0 },
      { weekStart: '2026-11-02', miles: 6 },
    ])
  })

  it('returns all-zero weeks when there are no runs', () => {
    expect(weeklyMileage([], '2026-11-02', '2026-11-16')).toEqual([
      { weekStart: '2026-11-02', miles: 0 },
      { weekStart: '2026-11-09', miles: 0 },
      { weekStart: '2026-11-16', miles: 0 },
    ])
  })

  it('expands mid-week range ends to whole weeks and ignores runs outside', () => {
    const runs = [
      { date: '2026-10-25', distanceMi: 10 }, // Sun before range
      { date: '2026-10-28', distanceMi: 2 },
      { date: '2026-11-10', distanceMi: 10 }, // after range
    ]
    expect(weeklyMileage(runs, '2026-10-29', '2026-11-03')).toEqual([
      { weekStart: '2026-10-26', miles: 2 },
      { weekStart: '2026-11-02', miles: 0 },
    ])
  })

  it('handles a week that crosses the DST change', () => {
    const runs = [
      { date: '2026-10-31', distanceMi: 4 }, // Sat
      { date: '2026-11-01', distanceMi: 6 }, // Sun, DST ends
    ]
    expect(weeklyMileage(runs, '2026-10-26', '2026-11-01')).toEqual([
      { weekStart: '2026-10-26', miles: 10 },
    ])
  })

  it('rounds away floating-point noise', () => {
    const runs = [
      { date: '2026-11-02', distanceMi: 0.1 },
      { date: '2026-11-03', distanceMi: 0.2 },
    ]
    expect(weeklyMileage(runs, '2026-11-02', '2026-11-02')).toEqual([
      { weekStart: '2026-11-02', miles: 0.3 },
    ])
  })

  it('rejects an inverted range and invalid distances', () => {
    expect(() => weeklyMileage([], '2026-11-09', '2026-11-02')).toThrow(RangeError)
    expect(() =>
      weeklyMileage([{ date: '2026-11-02', distanceMi: 0 }], '2026-11-02', '2026-11-02'),
    ).toThrow(RangeError)
  })
})
