import { describe, expect, it } from 'vitest'
import {
  addDays,
  fromDayNumber,
  formatLongDate,
  formatShortDate,
  isValidISODate,
  toDayNumber,
  todayLocal,
  weekStart,
} from './dates'

describe('isValidISODate', () => {
  it('accepts real days', () => {
    expect(isValidISODate('2026-11-03')).toBe(true)
    expect(isValidISODate('2028-02-29')).toBe(true)
  })
  it('rejects impossible days and bad formats', () => {
    expect(isValidISODate('2026-02-29')).toBe(false)
    expect(isValidISODate('2026-13-01')).toBe(false)
    expect(isValidISODate('2026-1-3')).toBe(false)
    expect(isValidISODate('')).toBe(false)
  })
})

describe('todayLocal', () => {
  it('uses the local calendar day, even late at night', () => {
    expect(todayLocal(new Date(2026, 10, 3, 23, 59))).toBe('2026-11-03')
    expect(todayLocal(new Date(2026, 0, 1, 0, 1))).toBe('2026-01-01')
  })
})

describe('addDays', () => {
  it('moves across month and year boundaries', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  })
  it('is not shifted by daylight-saving changes', () => {
    // US DST starts 2026-03-08 and ends 2026-11-01
    expect(addDays('2026-03-07', 1)).toBe('2026-03-08')
    expect(addDays('2026-03-08', 1)).toBe('2026-03-09')
    expect(addDays('2026-10-31', 7)).toBe('2026-11-07')
  })
  it('rejects invalid dates', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow(RangeError)
  })
})

describe('weekStart', () => {
  it('returns the same day for a Monday', () => {
    expect(weekStart('2026-11-02')).toBe('2026-11-02')
  })
  it('returns the previous Monday for other days, including Sunday', () => {
    expect(weekStart('2026-11-03')).toBe('2026-11-02') // Tue
    expect(weekStart('2026-11-08')).toBe('2026-11-02') // Sun
  })
  it('crosses month/year boundaries', () => {
    expect(weekStart('2027-01-01')).toBe('2026-12-28')
  })
  it('handles DST weeks', () => {
    expect(weekStart('2026-03-08')).toBe('2026-03-02') // Sun, DST start
    expect(weekStart('2026-11-01')).toBe('2026-10-26') // Sun, DST end
  })
})

describe('toDayNumber / fromDayNumber', () => {
  it('round-trips and steps one per day', () => {
    expect(toDayNumber('1970-01-02')).toBe(1)
    expect(fromDayNumber(toDayNumber('2026-11-03'))).toBe('2026-11-03')
    expect(toDayNumber('2026-03-09') - toDayNumber('2026-03-08')).toBe(1)
  })
})

describe('date labels', () => {
  it('formats without timezone drift', () => {
    expect(formatShortDate('2026-11-03')).toBe('Nov 3')
    expect(formatLongDate('2026-11-03')).toBe('Tue, Nov 3, 2026')
  })
})
