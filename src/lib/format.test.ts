import { describe, expect, it } from 'vitest'
import {
  cleanDurationDigits,
  cleanHmDigits,
  durationDigitsToSeconds,
  formatDuration,
  formatDurationDigits,
  formatHmDigits,
  formatMiles,
  formatMinutes,
  formatPace,
  formatPaceChange,
  formatWeight,
  hmDigitsToMinutes,
  minutesToHmDigits,
  parseDistance,
  secondsToDurationDigits,
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

describe('secondsToDurationDigits', () => {
  it('round-trips with durationDigitsToSeconds', () => {
    for (const seconds of [5, 59, 2730, 3900, 6000, 12 * 3600 + 34 * 60 + 56]) {
      expect(durationDigitsToSeconds(secondsToDurationDigits(seconds))).toBe(seconds)
    }
  })
  it('produces the digits a user would type', () => {
    expect(secondsToDurationDigits(2730)).toBe('4530')
    expect(secondsToDurationDigits(3900)).toBe('10500')
    expect(secondsToDurationDigits(0)).toBe('')
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

describe('formatWeight', () => {
  it('rounds to whole pounds with separators', () => {
    expect(formatWeight(262.5)).toBe('263')
    expect(formatWeight(1350)).toBe('1,350')
    expect(formatWeight(0)).toBe('0')
  })
})

describe('formatMiles', () => {
  it('always shows two decimals', () => {
    expect(formatMiles(5)).toBe('5.00')
    expect(formatMiles(13.1)).toBe('13.10')
  })
})

describe('hours:minutes entry', () => {
  it('cleans input to up to 4 digits, keeping a lone 0', () => {
    expect(cleanHmDigits('2:15')).toBe('215')
    expect(cleanHmDigits('0015')).toBe('15')
    expect(cleanHmDigits('000')).toBe('0')
    expect(cleanHmDigits('123456')).toBe('1234')
    expect(cleanHmDigits('')).toBe('')
  })
  it('formats as you type', () => {
    expect(formatHmDigits('')).toBe('')
    expect(formatHmDigits('5')).toBe('0:05')
    expect(formatHmDigits('45')).toBe('0:45')
    expect(formatHmDigits('215')).toBe('2:15')
    expect(formatHmDigits('1030')).toBe('10:30')
  })
  it('converts to minutes, rejecting 60+ minutes and a full day', () => {
    expect(hmDigitsToMinutes('215')).toBe(135)
    expect(hmDigitsToMinutes('0')).toBe(0)
    expect(hmDigitsToMinutes('2359')).toBe(1439)
    expect(hmDigitsToMinutes('260')).toBeNull()
    expect(hmDigitsToMinutes('2400')).toBeNull()
    expect(hmDigitsToMinutes('')).toBeNull()
    expect(hmDigitsToMinutes('2:15')).toBeNull()
  })
  it('round-trips minutes to digits', () => {
    for (const minutes of [0, 5, 45, 60, 135, 1439]) {
      expect(hmDigitsToMinutes(minutesToHmDigits(minutes))).toBe(minutes)
    }
    expect(minutesToHmDigits(135)).toBe('215')
    expect(minutesToHmDigits(0)).toBe('0')
  })
  it('formats minutes for display', () => {
    expect(formatMinutes(135)).toBe('2h 15m')
    expect(formatMinutes(120)).toBe('2h')
    expect(formatMinutes(45)).toBe('45m')
    expect(formatMinutes(0)).toBe('0m')
    expect(formatMinutes(89.6)).toBe('1h 30m')
    expect(formatMinutes(-30)).toBe('30m')
  })
})
