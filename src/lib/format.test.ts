import { describe, expect, it } from 'vitest'
import {
  cleanDurationDigits,
  durationDigitsToSeconds,
  formatDuration,
  formatDurationDigits,
  formatMiles,
  formatPace,
  formatPaceChange,
  parseDistance,
} from './format'

describe('cleanDurationDigits', () => {
  it('strips non-digits, leading zeros, and caps at 6 digits', () => {
    expect(cleanDurationDigits('45:30')).toBe('4530')
    expect(cleanDurationDigits('0:05')).toBe('5')
    expect(cleanDurationDigits('1234567')).toBe('123456')
    expect(cleanDurationDigits('')).toBe('')
  })
})

describe('formatDurationDigits', () => {
  it('fills from the right', () => {
    expect(formatDurationDigits('')).toBe('')
    expect(formatDurationDigits('5')).toBe('0:05')
    expect(formatDurationDigits('45')).toBe('0:45')
    expect(formatDurationDigits('453')).toBe('4:53')
    expect(formatDurationDigits('4530')).toBe('45:30')
    expect(formatDurationDigits('10500')).toBe('1:05:00')
    expect(formatDurationDigits('123456')).toBe('12:34:56')
  })
  it('re-flows when a digit is deleted', () => {
    expect(formatDurationDigits(cleanDurationDigits('45:3'))).toBe('4:53')
  })
})

describe('durationDigitsToSeconds', () => {
  it('converts valid durations', () => {
    expect(durationDigitsToSeconds('4530')).toBe(45 * 60 + 30)
    expect(durationDigitsToSeconds('10500')).toBe(3900)
    expect(durationDigitsToSeconds('5')).toBe(5)
  })
  it('allows 60+ minutes when no hours are typed', () => {
    expect(durationDigitsToSeconds('9000')).toBe(5400)
  })
  it('rejects invalid seconds, or minutes >= 60 alongside hours', () => {
    expect(durationDigitsToSeconds('4575')).toBeNull()
    expect(durationDigitsToSeconds('16000')).toBeNull()
  })
  it('rejects zero, empty, and non-digits', () => {
    expect(durationDigitsToSeconds('0')).toBeNull()
    expect(durationDigitsToSeconds('')).toBeNull()
    expect(durationDigitsToSeconds('45:30')).toBeNull()
  })
})

describe('formatDuration / formatPace', () => {
  it('formats with and without hours', () => {
    expect(formatDuration(2730)).toBe('45:30')
    expect(formatDuration(3900)).toBe('1:05:00')
    expect(formatDuration(59)).toBe('0:59')
  })
  it('rounds to the nearest second without producing :60', () => {
    expect(formatPace(545.6)).toBe('9:06')
    expect(formatPace(599.6)).toBe('10:00')
  })
})

describe('formatPaceChange', () => {
  it('says faster or slower', () => {
    expect(formatPaceChange(18)).toBe('0:18 /mi faster')
    expect(formatPaceChange(-75)).toBe('1:15 /mi slower')
  })
  it('treats sub-second changes as no change', () => {
    expect(formatPaceChange(0.4)).toBe('No change')
    expect(formatPaceChange(-0.4)).toBe('No change')
  })
  it('shows a dash when there is nothing to compare', () => {
    expect(formatPaceChange(null)).toBe('–')
  })
})

describe('parseDistance', () => {
  it('accepts common inputs', () => {
    expect(parseDistance('5')).toBe(5)
    expect(parseDistance('5.25')).toBe(5.25)
    expect(parseDistance('.5')).toBe(0.5)
    expect(parseDistance('5,25')).toBe(5.25)
    expect(parseDistance(' 13.1 ')).toBe(13.1)
    expect(parseDistance('5.')).toBe(5)
  })
  it('rejects zero, negatives, too many decimals, and junk', () => {
    expect(parseDistance('0')).toBeNull()
    expect(parseDistance('0.00')).toBeNull()
    expect(parseDistance('-3')).toBeNull()
    expect(parseDistance('5.255')).toBeNull()
    expect(parseDistance('1000')).toBeNull()
    expect(parseDistance('abc')).toBeNull()
    expect(parseDistance('')).toBeNull()
  })
})

describe('formatMiles', () => {
  it('always shows two decimals', () => {
    expect(formatMiles(5)).toBe('5.00')
    expect(formatMiles(13.1)).toBe('13.10')
  })
})
