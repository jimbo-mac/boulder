/**
 * Derived-metric math. Pure functions only: no React, no Supabase.
 * Invalid inputs (zero, negative, non-finite) throw RangeError; callers validate first.
 */
import { addDays, weekStart, type ISODate } from './dates'

function assertPositive(name: string, value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new RangeError(`${name} must be a positive number, got ${value}`)
  }
}

/** Average pace in seconds per mile. */
export function pace(durationS: number, distanceMi: number): number {
  assertPositive('durationS', durationS)
  assertPositive('distanceMi', distanceMi)
  return durationS / distanceMi
}

export interface WeeklyMileage {
  /** Monday that starts the week. */
  weekStart: ISODate
  miles: number
}

/**
 * Total miles per ISO week (Monday start) for every week from the week containing
 * `from` through the week containing `to`. Weeks with no runs are 0, not missing.
 * Runs outside the range are ignored.
 */
export function weeklyMileage(
  runs: readonly { date: ISODate; distanceMi: number }[],
  from: ISODate,
  to: ISODate,
): WeeklyMileage[] {
  const first = weekStart(from)
  const last = weekStart(to)
  if (first > last) throw new RangeError(`from (${from}) is after to (${to})`)

  const totals = new Map<ISODate, number>()
  for (let week = first; week <= last; week = addDays(week, 7)) totals.set(week, 0)

  for (const run of runs) {
    assertPositive('distanceMi', run.distanceMi)
    const week = weekStart(run.date)
    const current = totals.get(week)
    if (current !== undefined) totals.set(week, current + run.distanceMi)
  }

  // Round to hundredths to remove floating-point noise (0.1 + 0.2).
  return [...totals].map(([week, miles]) => ({
    weekStart: week,
    miles: Math.round(miles * 100) / 100,
  }))
}
