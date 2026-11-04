/**
 * Derived-metric math. Pure functions only: no React, no Supabase.
 * Invalid inputs (zero, negative, non-finite) throw RangeError; callers validate first.
 */
import { addDays, weekStart, type ISODate } from './dates'
import type { RunKind } from './runKinds'

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

/** Riegel race-time prediction: T2 = T1 × (D2 / D1)^1.06. */
export function riegel(t1S: number, d1Mi: number, d2Mi: number): number {
  assertPositive('t1S', t1S)
  assertPositive('d1Mi', d1Mi)
  assertPositive('d2Mi', d2Mi)
  return t1S * (d2Mi / d1Mi) ** 1.06
}

/** Pace needed to hit a goal time, seconds per mile. */
export function goalPace(goalTimeS: number, goalDistanceMi: number): number {
  return pace(goalTimeS, goalDistanceMi)
}

export interface Prediction {
  timeS: number
  basedOn: { date: ISODate; distanceMi: number; durationS: number }
}

/**
 * Predict a race time from the best effort among `runs`: the run (of at least
 * `minDistanceMi`) whose Riegel prediction for `targetMi` is fastest.
 * Null if no run qualifies. Short runs are excluded because Riegel overstates
 * fitness when extrapolating from them.
 */
export function predictRaceTime(
  runs: readonly { date: ISODate; distanceMi: number; durationS: number }[],
  targetMi: number,
  minDistanceMi = 3,
): Prediction | null {
  assertPositive('targetMi', targetMi)
  let best: Prediction | null = null
  for (const run of runs) {
    if (run.distanceMi < minDistanceMi) continue
    const timeS = riegel(run.durationS, run.distanceMi, targetMi)
    if (!best || timeS < best.timeS) {
      best = {
        timeS,
        basedOn: { date: run.date, distanceMi: run.distanceMi, durationS: run.durationS },
      }
    }
  }
  return best
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

// --- Lifting -----------------------------------------------------------------

/** Above this many reps, a 1RM estimate is unreliable and is flagged. */
export const MAX_CONFIDENT_REPS = 12

export interface OneRepMax {
  value: number
  lowConfidence: boolean
}

/** Estimated 1RM (Epley): weight × (1 + reps / 30); a single rep is just the weight. */
export function estimate1RM(weightLb: number, reps: number): OneRepMax {
  assertPositive('weightLb', weightLb)
  if (!Number.isInteger(reps) || reps < 1) throw new RangeError(`reps must be a positive integer, got ${reps}`)
  return {
    value: reps === 1 ? weightLb : weightLb * (1 + reps / 30),
    lowConfidence: reps > MAX_CONFIDENT_REPS,
  }
}

export interface LiftSet {
  weightLb: number
  reps: number
  isWarmup: boolean
}

/** Weight × reps; warm-ups count as 0. */
export function setVolume(set: LiftSet): number {
  if (!Number.isFinite(set.weightLb) || set.weightLb < 0) {
    throw new RangeError(`weightLb must be >= 0, got ${set.weightLb}`)
  }
  if (!Number.isInteger(set.reps) || set.reps < 1) throw new RangeError(`reps must be a positive integer`)
  return set.isWarmup ? 0 : set.weightLb * set.reps
}

export function totalVolume(sets: readonly LiftSet[]): number {
  return sets.reduce((sum, set) => sum + setVolume(set), 0)
}

export interface OneRepMaxPoint {
  date: ISODate
  /** Best estimated 1RM that day. */
  value: number
  /** The set that produced it. */
  weightLb: number
  reps: number
  lowConfidence: boolean
}

/**
 * Best estimated 1RM per day for one exercise, oldest first. Warm-ups and
 * bodyweight (0 lb) sets are ignored. A low-confidence estimate (reps > 12) is
 * only used for a day when that day has no confident one.
 */
export function oneRepMaxByDay(
  sets: readonly (LiftSet & { date: ISODate })[],
): OneRepMaxPoint[] {
  const best = new Map<ISODate, OneRepMaxPoint>()
  for (const set of sets) {
    if (set.isWarmup || set.weightLb <= 0) continue
    const estimate = estimate1RM(set.weightLb, set.reps)
    const point: OneRepMaxPoint = {
      date: set.date,
      value: estimate.value,
      weightLb: set.weightLb,
      reps: set.reps,
      lowConfidence: estimate.lowConfidence,
    }
    const current = best.get(set.date)
    const better =
      !current ||
      (current.lowConfidence && !point.lowConfidence) ||
      (current.lowConfidence === point.lowConfidence && point.value > current.value)
    if (better) best.set(set.date, point)
  }
  return [...best.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

export interface RepsPoint {
  date: ISODate
  /** Most reps in a single working set that day. */
  bestSet: number
  /** All working reps that day. */
  totalReps: number
  workingSets: number
}

/** For reps-only exercises (pull-ups): best set and total reps per day, oldest first. Warm-ups ignored. */
export function repsByDay(sets: readonly (LiftSet & { date: ISODate })[]): RepsPoint[] {
  const byDay = new Map<ISODate, RepsPoint>()
  for (const set of sets) {
    if (!Number.isInteger(set.reps) || set.reps < 1) throw new RangeError('reps must be a positive integer')
    if (set.isWarmup) continue
    const day = byDay.get(set.date) ?? { date: set.date, bestSet: 0, totalReps: 0, workingSets: 0 }
    day.bestSet = Math.max(day.bestSet, set.reps)
    day.totalReps += set.reps
    day.workingSets += 1
    byDay.set(set.date, day)
  }
  return [...byDay.values()].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
}

// --- PRs -------------------------------------------------------------------------

/** Values closer than this are a tie, not a PR (floating-point noise in 1RM math). */
const PR_EPSILON = 1e-9

export interface LiftPR {
  date: ISODate
  /** Est. 1RM (weighted lifts) or most reps in a set (reps-only lifts). */
  value: number
  /** Best value on any earlier day. */
  previousBest: number
  /** The set that set it. 0 for reps-only lifts. */
  weightLb: number
  reps: number
}

/**
 * Days that beat every earlier day, oldest first. The first day is the baseline,
 * not a PR. `days` must be one point per day, oldest first.
 */
function recordDays<D extends { value: number }>(days: readonly D[]): { day: D; previousBest: number }[] {
  const records: { day: D; previousBest: number }[] = []
  let best: number | null = null
  for (const day of days) {
    if (best !== null && day.value > best + PR_EPSILON) records.push({ day, previousBest: best })
    if (best === null || day.value > best) best = day.value
  }
  return records
}

/**
 * PR days for one exercise, oldest first. Pass the exercise's full history (not just
 * the visible range) so old lifts aren't mistaken for new PRs.
 * - 'weight': best est. 1RM per day; warm-ups, 0 lb sets and sets over 12 reps don't count.
 * - 'reps': most reps in one working set per day.
 */
export function liftPRs(
  sets: readonly (LiftSet & { date: ISODate })[],
  tracking: 'weight' | 'reps',
): LiftPR[] {
  if (tracking === 'reps') {
    return recordDays(repsByDay(sets).map((d) => ({ ...d, value: d.bestSet }))).map(
      ({ day, previousBest }) => ({ date: day.date, value: day.value, previousBest, weightLb: 0, reps: day.bestSet }),
    )
  }
  const confident = sets.filter((set) => set.reps <= MAX_CONFIDENT_REPS)
  return recordDays(oneRepMaxByDay(confident)).map(({ day, previousBest }) => ({
    date: day.date,
    value: day.value,
    previousBest,
    weightLb: day.weightLb,
    reps: day.reps,
  }))
}

/** Pace PRs only compare runs within this fraction of the same distance. */
export const PR_DISTANCE_TOLERANCE = 0.05

export interface RunPRInput {
  workoutId: string
  date: ISODate
  distanceMi: number
  durationS: number
  kind: RunKind
}

export interface RunPR<R extends RunPRInput = RunPRInput> {
  run: R
  /** Long runs: longest distance. Everything else: fastest pace at about this distance. */
  measure: 'distance' | 'pace'
  /** Miles (distance) or seconds per mile (pace). */
  value: number
  previousBest: number
}

/**
 * Run PRs, oldest first. Pass all runs, not just the visible range. Same-day runs
 * keep their given order.
 * - Long runs: longer than every earlier long run.
 * - Base / recovery / speed: faster pace than every earlier run of the same type
 *   within ±5% of its distance. A run with no such earlier run sets a baseline.
 */
export function runPRs<R extends RunPRInput>(runs: readonly R[]): RunPR<R>[] {
  const sorted = [...runs].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  const prs: RunPR<R>[] = []
  sorted.forEach((run, i) => {
    const runPace = pace(run.durationS, run.distanceMi)
    const earlier = sorted.slice(0, i).filter((r) => r.kind === run.kind)
    if (run.kind === 'long') {
      if (earlier.length === 0) return
      const longest = Math.max(...earlier.map((r) => r.distanceMi))
      if (run.distanceMi > longest + PR_EPSILON) {
        prs.push({ run, measure: 'distance', value: run.distanceMi, previousBest: longest })
      }
      return
    }
    const comparable = earlier.filter(
      (r) => Math.abs(r.distanceMi - run.distanceMi) <= run.distanceMi * PR_DISTANCE_TOLERANCE + PR_EPSILON,
    )
    if (comparable.length === 0) return
    const fastest = Math.min(...comparable.map((r) => pace(r.durationS, r.distanceMi)))
    if (runPace < fastest - PR_EPSILON) {
      prs.push({ run, measure: 'pace', value: runPace, previousBest: fastest })
    }
  })
  return prs
}

// --- Weekly totals -----------------------------------------------------------------

/** A zero for every Monday from the week containing `from` through the week containing `to`. */
function emptyWeeks(from: ISODate, to: ISODate): Map<ISODate, number> {
  const first = weekStart(from)
  const last = weekStart(to)
  if (first > last) throw new RangeError(`from (${from}) is after to (${to})`)
  const totals = new Map<ISODate, number>()
  for (let week = first; week <= last; week = addDays(week, 7)) totals.set(week, 0)
  return totals
}

export interface WeeklyVolume {
  /** Monday that starts the week. */
  weekStart: ISODate
  /** Pounds lifted (weight × reps), or total reps for reps-only lifts. */
  value: number
}

/**
 * Weekly volume for one exercise from the week containing `from` through the week
 * containing `to`; empty weeks are 0. Warm-ups don't count; sets outside the range are ignored.
 * - 'weight': Σ weight × reps.  - 'reps': Σ reps (bodyweight sets are stored as 0 lb).
 */
export function weeklyVolume(
  sets: readonly (LiftSet & { date: ISODate })[],
  from: ISODate,
  to: ISODate,
  tracking: 'weight' | 'reps',
): WeeklyVolume[] {
  const totals = emptyWeeks(from, to)
  for (const set of sets) {
    const volume = setVolume(set) // validates weight and reps
    const week = weekStart(set.date)
    const current = totals.get(week)
    if (current === undefined || set.isWarmup) continue
    totals.set(week, current + (tracking === 'reps' ? set.reps : volume))
  }
  return [...totals].map(([week, value]) => ({ weekStart: week, value: Math.round(value * 100) / 100 }))
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
  const totals = emptyWeeks(from, to)
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

// --- Habits (stretching) ------------------------------------------------------------

export interface WeeklyGoalProgress {
  /** Days done in the week. */
  done: number
  goal: number
  met: boolean
}

/** Days a habit was done in the Monday-start week containing `weekOf`, against its weekly goal. */
export function weeklyGoalProgress(
  doneDates: readonly ISODate[],
  weekOf: ISODate,
  goal: number,
): WeeklyGoalProgress {
  if (!Number.isInteger(goal) || goal < 1 || goal > 7) {
    throw new RangeError(`goal must be a whole number from 1 to 7, got ${goal}`)
  }
  const start = weekStart(weekOf)
  const end = addDays(start, 6)
  const done = new Set(doneDates.filter((d) => d >= start && d <= end)).size
  return { done, goal, met: done >= goal }
}

/** Distinct days a habit was done in `date`'s month. */
export function daysDoneInMonth(doneDates: readonly ISODate[], date: ISODate): number {
  const month = date.slice(0, 7)
  return new Set(doneDates.filter((d) => d.slice(0, 7) === month)).size
}

export interface GoalWeek {
  /** Monday that starts the week. */
  weekStart: ISODate
  done: number
  met: boolean
  /** False for the week containing `to` (still in progress). */
  complete: boolean
}

/**
 * One entry per Monday-start week from the week containing `from` through the week
 * containing `to`, with days done against the weekly goal. Days after `to` don't count.
 */
export function goalWeeks(
  doneDates: readonly ISODate[],
  from: ISODate,
  to: ISODate,
  goal: number,
): GoalWeek[] {
  const upToTo = doneDates.filter((d) => d <= to)
  return [...emptyWeeks(from, to).keys()].map((week) => {
    const { done, met } = weeklyGoalProgress(upToTo, week, goal)
    return { weekStart: week, done, met, complete: addDays(week, 6) < to }
  })
}

/**
 * Weeks in a row the goal was met, counting back from this week. This week only
 * counts once its goal is met; until then the streak runs through last week, so
 * it doesn't reset every Monday.
 */
export function goalStreak(doneDates: readonly ISODate[], today: ISODate, goal: number): number {
  const upToToday = doneDates.filter((d) => d <= today)
  let week = weekStart(today)
  let streak = 0
  if (weeklyGoalProgress(upToToday, week, goal).met) streak = 1
  week = addDays(week, -7)
  while (weeklyGoalProgress(upToToday, week, goal).met) {
    streak += 1
    week = addDays(week, -7)
  }
  return streak
}

// --- Daily habits ------------------------------------------------------------------

/**
 * Days in a row a habit was done, counting back from today. A blank today
 * doesn't break it (the day isn't over): the streak then runs through yesterday.
 * Today marked missed (✗) does: the streak is 0. Days after `today` are ignored.
 */
export function dailyStreak(
  doneDates: readonly ISODate[],
  today: ISODate,
  /** Days explicitly marked missed (✓ / ✗ habits). */
  missedDates: readonly ISODate[] = [],
): number {
  const done = new Set(doneDates)
  return dailyStreakWhere((day) => done.has(day), today, missedDates.includes(today))
}

/** dailyStreak for any "was it done on this day?" lookup. */
export function dailyStreakWhere(isDone: (day: ISODate) => boolean, today: ISODate, missedToday = false): number {
  if (missedToday) return 0
  let day = isDone(today) ? today : addDays(today, -1)
  let streak = 0
  while (isDone(day)) {
    streak += 1
    day = addDays(day, -1)
  }
  return streak
}

/** Longest run of consecutive days done, on or before `today`. */
export function bestStreak(doneDates: readonly ISODate[], today: ISODate): number {
  const days = [...new Set(doneDates.filter((d) => d <= today))].sort()
  let best = 0
  let run = 0
  let previous: ISODate | null = null
  for (const day of days) {
    run = previous !== null && addDays(previous, 1) === day ? run + 1 : 1
    best = Math.max(best, run)
    previous = day
  }
  return best
}

export interface DailyMinutes {
  date: ISODate
  /** Minutes logged that day, or null if nothing was logged (not the same as 0). */
  minutes: number | null
  /** Average of the logged days in the 7 days ending here; null if none were logged. */
  avg7: number | null
}

/** Days in the trailing screen time average. */
export const MINUTES_AVERAGE_DAYS = 7

/**
 * One point per day from `from` through `to`, with a trailing 7-day average over
 * logged days. Pass entries from at least 6 days before `from` so the first
 * averages are complete.
 */
export function dailyMinutes(
  entries: readonly { date: ISODate; minutes: number }[],
  from: ISODate,
  to: ISODate,
): DailyMinutes[] {
  if (from > to) throw new RangeError(`from (${from}) is after to (${to})`)
  const byDay = new Map<ISODate, number>()
  for (const entry of entries) {
    if (!Number.isInteger(entry.minutes) || entry.minutes < 0) {
      throw new RangeError(`minutes must be a whole number >= 0, got ${entry.minutes}`)
    }
    byDay.set(entry.date, entry.minutes)
  }
  const points: DailyMinutes[] = []
  for (let day = from; day <= to; day = addDays(day, 1)) {
    const window: number[] = []
    for (let i = 0; i < MINUTES_AVERAGE_DAYS; i++) {
      const value = byDay.get(addDays(day, -i))
      if (value !== undefined) window.push(value)
    }
    points.push({
      date: day,
      minutes: byDay.get(day) ?? null,
      avg7: window.length > 0 ? window.reduce((a, b) => a + b, 0) / window.length : null,
    })
  }
  return points
}

/** Average minutes over the logged days with `from <= date <= to`; null if none. */
export function averageMinutes(
  entries: readonly { date: ISODate; minutes: number }[],
  from: ISODate,
  to: ISODate,
): number | null {
  const inRange = entries.filter((e) => e.date >= from && e.date <= to)
  if (inRange.length === 0) return null
  return inRange.reduce((sum, e) => sum + e.minutes, 0) / inRange.length
}
