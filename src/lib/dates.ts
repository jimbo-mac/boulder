/**
 * Calendar-day helpers. Workout dates are plain local days ("YYYY-MM-DD"),
 * never timestamps. Arithmetic is done on UTC midnights so DST never shifts a day.
 */

/** A calendar day as "YYYY-MM-DD". */
export type ISODate = string

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const DAY_MS = 86_400_000

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function toUTCms(date: ISODate): number {
  const match = ISO_DATE.exec(date)
  if (!match || !isValidISODate(date)) throw new RangeError(`Invalid date: ${date}`)
  return Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
}

function fromUTCms(ms: number): ISODate {
  const d = new Date(ms)
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

export function isValidISODate(date: string): boolean {
  const match = ISO_DATE.exec(date)
  if (!match) return false
  const [y, m, d] = [Number(match[1]), Number(match[2]), Number(match[3])]
  const probe = new Date(Date.UTC(y, m - 1, d))
  return probe.getUTCFullYear() === y && probe.getUTCMonth() === m - 1 && probe.getUTCDate() === d
}

/** Today in the device's local timezone. */
export function todayLocal(now: Date = new Date()): ISODate {
  return `${now.getFullYear()}-${pad2(now.getMonth() + 1)}-${pad2(now.getDate())}`
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromUTCms(toUTCms(date) + days * DAY_MS)
}

/** The Monday on or before `date` (ISO weeks start Monday). */
export function weekStart(date: ISODate): ISODate {
  const ms = toUTCms(date)
  const daysSinceMonday = (new Date(ms).getUTCDay() + 6) % 7
  return fromUTCms(ms - daysSinceMonday * DAY_MS)
}

/** Days since 1970-01-01, for placing dates on a numeric chart axis. */
export function toDayNumber(date: ISODate): number {
  return Math.round(toUTCms(date) / DAY_MS)
}

export function fromDayNumber(day: number): ISODate {
  return fromUTCms(Math.round(day) * DAY_MS)
}

/** "Nov 3" style label for chart axes. */
export function formatShortDate(date: ISODate): string {
  return new Date(toUTCms(date)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

/** "Tue, Nov 3, 2026" style label for history rows. */
export function formatLongDate(date: ISODate): string {
  return new Date(toUTCms(date)).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  })
}
