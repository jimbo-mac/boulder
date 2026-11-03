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

export interface PacePoint {
  date: ISODate
  /** This run's pace, seconds per mile. */
  pace: number
  /** Distance-weighted pace of this run and up to `window - 1` runs before it. */
  avg: number
}

export interface PaceTrend {
  points: PacePoint[]
  /**
   * Seconds per mile gained: pace of the first `k` runs minus pace of the last `k`,
   * with k = min(window, floor(n / 2)). Positive = faster. Null with fewer than 2 runs.
   */
  improvement: number | null
}

/** Combined pace of several runs: total time ÷ total distance. */
function combinedPace(runs: readonly { distanceMi: number; durationS: number }[]): number {
  let time = 0
  let distance = 0
  for (const run of runs) {
    time += run.durationS
    distance += run.distanceMi
  }
  return pace(time, distance)
}

/**
 * Per-run pace plus a trailing distance-weighted average, for runs sorted oldest first.
 * Runs are not filtered here; pass only the run type you want to compare.
 */
export function paceTrend(
  runs: readonly { date: ISODate; distanceMi: number; durationS: number }[],
  window = 5,
): PaceTrend {
  if (!Number.isInteger(window) || window < 1) throw new RangeError(`window must be >= 1`)
  for (let i = 1; i < runs.length; i++) {
    const prev = runs[i - 1]
    const curr = runs[i]
    if (prev && curr && prev.date > curr.date) throw new RangeError('runs must be sorted oldest first')
  }

  const points = runs.map((run, i) => ({
    date: run.date,
    pace: pace(run.durationS, run.distanceMi),
    avg: combinedPace(runs.slice(Math.max(0, i - window + 1), i + 1)),
  }))

  const k = Math.min(window, Math.floor(runs.length / 2))
  const improvement =
    k >= 1 ? combinedPace(runs.slice(0, k)) - combinedPace(runs.slice(runs.length - k)) : null

  return { points, improvement }
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
