/** Parsing and display formatting. Values are stored in canonical units (miles, seconds). */

const MAX_DURATION_DIGITS = 6

/** Keep only digits, max 6 (h:mm:ss with up to 2-digit hours). Leading zeros dropped. */
export function cleanDurationDigits(input: string): string {
  return input.replace(/\D/g, '').replace(/^0+/, '').slice(0, MAX_DURATION_DIGITS)
}

function splitDigits(digits: string): { h: number; m: number; s: number } {
  const padded = digits.padStart(MAX_DURATION_DIGITS, '0')
  return {
    h: Number(padded.slice(0, 2)),
    m: Number(padded.slice(2, 4)),
    s: Number(padded.slice(4, 6)),
  }
}

/**
 * Show typed digits as a duration, filling from the right like a microwave:
 * "5" → "0:05", "4530" → "45:30", "10500" → "1:05:00".
 */
export function formatDurationDigits(digits: string): string {
  if (digits === '') return ''
  const { h, m, s } = splitDigits(digits)
  const ss = String(s).padStart(2, '0')
  if (digits.length > 4) return `${h}:${String(m).padStart(2, '0')}:${ss}`
  return `${m}:${ss}`
}

/**
 * Convert typed digits to seconds. Seconds must be < 60; minutes must be < 60
 * when hours are given ("9000" = 90:00 is allowed). Returns null if invalid or zero.
 */
export function durationDigitsToSeconds(digits: string): number | null {
  if (!/^\d+$/.test(digits) || digits.length > MAX_DURATION_DIGITS) return null
  const { h, m, s } = splitDigits(digits)
  if (s >= 60) return null
  if (h > 0 && m >= 60) return null
  const total = h * 3600 + m * 60 + s
  return total > 0 ? total : null
}

/** 2730 → "45:30", 3900 → "1:05:00". Rounds to the nearest second. */
export function formatDuration(totalSeconds: number): string {
  const rounded = Math.round(totalSeconds)
  const h = Math.floor(rounded / 3600)
  const m = Math.floor((rounded % 3600) / 60)
  const s = rounded % 60
  const ss = String(s).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${ss}` : `${m}:${ss}`
}

/** Seconds per mile → "9:06". */
export function formatPace(secondsPerMile: number): string {
  return formatDuration(secondsPerMile)
}

/**
 * Parse a distance in miles. Accepts "5", "5.25", ".5", and "5,25" (comma keyboards).
 * Must be > 0 and < 1000, with at most 2 decimals. Returns null if invalid.
 */
export function parseDistance(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^(\d{1,3}(\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null
  const value = Number(normalized)
  return value > 0 ? value : null
}

/** 5 → "5.00", 13.1 → "13.10". */
export function formatMiles(miles: number): string {
  return miles.toFixed(2)
}
