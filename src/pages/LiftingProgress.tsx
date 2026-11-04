import { useMemo, useState } from 'react'
import { DateLineChart } from '../components/DateLineChart'
import { PR_COLOR } from '../components/prMarker'
import { cardClass, chipClass, inputClass, labelClass } from '../components/ui'
import { WeeklyBarChart } from '../components/WeeklyBarChart'
import { formatShortDate, todayLocal, weekStart, type ISODate } from '../lib/dates'
import { allSets, listExercises, type DatedSet } from '../lib/db/lifts'
import type { Exercise } from '../lib/exercises'
import { formatWeight } from '../lib/format'
import {
  liftPRs,
  MAX_CONFIDENT_REPS,
  oneRepMaxByDay,
  repsByDay,
  weeklyVolume,
  type LiftPR,
} from '../lib/metrics'
import { RANGES, rangeStart, type RangeValue } from '../lib/ranges'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'

/** Most PRs listed under Recent PRs. */
const RECENT_PR_LIMIT = 10

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-stone-400 tabular-nums">{detail}</p>}
    </div>
  )
}

function signed(value: number, format: (n: number) => string): string {
  return `${value >= 0 ? '+' : '−'}${format(Math.abs(value))}`
}

const repsText = (n: number) => `${n} ${n === 1 ? 'rep' : 'reps'}`

/** Axis labels for pounds: 950, 1.2k, 12k. */
function compactWeight(lb: number): string {
  if (lb < 1000) return String(Math.round(lb))
  const k = lb / 1000
  return `${k < 10 ? Math.round(k * 10) / 10 : Math.round(k)}k`
}

function inRange(date: ISODate, from: ISODate | null, to: ISODate): boolean {
  return (from === null || date >= from) && date <= to
}

interface ExercisePR extends LiftPR {
  exercise: Exercise
}

export function LiftingProgress() {
  const today = todayLocal()
  const exercises = useAsync('exercises', listExercises)
  // All history, loaded once: PRs compare against everything before, whatever the range.
  const sets = useAsync('sets:all', allSets)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [range, setRange] = useState<RangeValue>('12w')
  const from = rangeStart(range, today)

  const list = useMemo(() => exercises.data ?? [], [exercises.data])
  const exercise = list.find((e) => e.id === chosenId) ?? list[0] ?? null

  const { setsByExercise, prsByExercise } = useMemo(() => {
    const setsByExercise = new Map<string, DatedSet[]>()
    for (const set of sets.data ?? []) {
      const forExercise = setsByExercise.get(set.exerciseId) ?? []
      forExercise.push(set)
      setsByExercise.set(set.exerciseId, forExercise)
    }
    const prsByExercise = new Map<string, LiftPR[]>()
    for (const e of list) prsByExercise.set(e.id, liftPRs(setsByExercise.get(e.id) ?? [], e.tracking))
    return { setsByExercise, prsByExercise }
  }, [sets.data, list])

  if (exercises.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
        Couldn&apos;t load exercises: {exercises.error}
      </p>
    )
  }
  if (exercises.data === undefined) return <p className="text-stone-400">Loading…</p>
  if (!exercise) {
    return (
      <p className="text-stone-400">
        No lifts yet.{' '}
        <a href={routeHref('log')} className="text-stone-200 underline underline-offset-4">
          Log a lift workout
        </a>{' '}
        to see strength trends.
      </p>
    )
  }

  const recentPRs = list
    .flatMap((e) => (prsByExercise.get(e.id) ?? []).map((pr): ExercisePR => ({ ...pr, exercise: e })))
    .filter((pr) => inRange(pr.date, from, today))
    .sort((a, b) =>
      a.date !== b.date ? (a.date < b.date ? 1 : -1) : a.exercise.name.localeCompare(b.exercise.name),
    )
    .slice(0, RECENT_PR_LIMIT)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label htmlFor="exercise-select" className={labelClass}>
          Exercise
        </label>
        <select
          id="exercise-select"
          value={exercise.id}
          onChange={(e) => setChosenId(e.target.value)}
          className={inputClass}
        >
          {list.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </div>

      <div className="flex gap-2" role="group" aria-label="Time range">
        {RANGES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={range === option.value}
            onClick={() => setRange(option.value)}
            className={`${chipClass(range === option.value)} flex-1 md:flex-none md:px-4`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {sets.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load sets: {sets.error}
        </p>
      )}
      {sets.data === undefined && !sets.error && <p className="text-stone-400">Loading…</p>}

      {sets.data !== undefined && (
        <>
          <ExerciseSections
            exercise={exercise}
            sets={(setsByExercise.get(exercise.id) ?? []).filter((s) => inRange(s.date, from, today))}
            prs={prsByExercise.get(exercise.id) ?? []}
            from={from}
            today={today}
          />
          <RecentPRs prs={recentPRs} />
        </>
      )}
    </div>
  )
}

function ExerciseSections({
  exercise,
  sets,
  prs,
  from,
  today,
}: {
  exercise: Exercise
  /** This exercise's sets in the selected range. */
  sets: DatedSet[]
  /** All-time PRs for this exercise. */
  prs: LiftPR[]
  from: ISODate | null
  today: ISODate
}) {
  const prDates = new Set(prs.map((pr) => pr.date))
  const repsOnly = exercise.tracking === 'reps'
  // "All" starts at this exercise's first set.
  const start = from ?? sets[0]?.date ?? weekStart(today)
  const weeks = weeklyVolume(sets, start, today, exercise.tracking)

  return (
    <>
      <section className={`${cardClass} flex flex-col gap-4`}>
        <h2 className="font-semibold">{repsOnly ? 'Reps per set' : 'Estimated 1-rep max'}</h2>
        {repsOnly ? (
          <RepsTrend exercise={exercise} sets={sets} prDates={prDates} />
        ) : (
          <StrengthTrend exercise={exercise} sets={sets} prDates={prDates} />
        )}
      </section>

      <section className={`${cardClass} flex flex-col gap-3`}>
        <div>
          <h2 className="font-semibold">Weekly volume</h2>
          <p className="text-xs text-stone-400">
            {repsOnly ? 'Total working reps per week' : 'Weight × reps per week, warm-ups excluded'}
          </p>
        </div>
        {weeks.every((w) => w.value === 0) ? (
          <Empty exercise={exercise} />
        ) : repsOnly ? (
          <WeeklyBarChart
            data={weeks}
            caption={`Reps per week, ${exercise.name}`}
            valueLabel="Reps"
            formatValue={(n) => String(Math.round(n))}
            unit="reps"
          />
        ) : (
          <WeeklyBarChart
            data={weeks}
            caption={`Volume per week, ${exercise.name}`}
            valueLabel="Pounds"
            formatValue={formatWeight}
            formatAxis={compactWeight}
            unit="lb"
          />
        )}
      </section>
    </>
  )
}

function RecentPRs({ prs }: { prs: ExercisePR[] }) {
  return (
    <section className={`${cardClass} flex flex-col gap-3`}>
      <h2 className="font-semibold">Recent PRs</h2>
      {prs.length === 0 ? (
        <p className="text-sm text-stone-400">
          No PRs in this range yet. Your first session of each exercise sets the baseline to beat.
        </p>
      ) : (
        <ul className="flex flex-col divide-y divide-stone-800">
          {prs.map((pr) => (
            <li key={`${pr.exercise.id}-${pr.date}`} className="flex items-center justify-between gap-3 py-2">
              <div className="flex min-w-0 items-center gap-2">
                <svg width="10" height="10" className="shrink-0" aria-hidden="true">
                  <circle cx="5" cy="5" r="4" fill={PR_COLOR} />
                </svg>
                <div className="min-w-0">
                  <p className="truncate font-medium">{pr.exercise.name}</p>
                  <p className="text-xs text-stone-400">{formatShortDate(pr.date)}</p>
                </div>
              </div>
              <div className="shrink-0 text-right tabular-nums">
                {pr.exercise.tracking === 'reps' ? (
                  <>
                    <p className="font-semibold">{repsText(pr.reps)}</p>
                    <p className="text-xs text-stone-400">+{pr.value - pr.previousBest} on best set</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold">
                      {formatWeight(pr.weightLb)} × {pr.reps}
                    </p>
                    <p className="text-xs text-stone-400">
                      est. 1RM {formatWeight(pr.value)} lb (+{formatWeight(pr.value - pr.previousBest)})
                    </p>
                  </>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Empty({ exercise }: { exercise: Exercise }) {
  return (
    <p className="py-10 text-center text-stone-400">
      No working sets of {exercise.name} in this range yet.
    </p>
  )
}

/** Weighted lifts: best estimated 1RM per day. */
function StrengthTrend({
  exercise,
  sets,
  prDates,
}: {
  exercise: Exercise
  sets: DatedSet[]
  prDates: ReadonlySet<ISODate>
}) {
  const points = oneRepMaxByDay(sets)
  if (points.length === 0) return <Empty exercise={exercise} />

  const latest = points.at(-1)
  const first = points[0]
  const best = points.reduce((top, p) => (p.value > top.value ? p : top))
  const change = latest && first && points.length > 1 ? latest.value - first.value : null
  const anyLowConfidence = points.some((p) => p.lowConfidence)

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Figure
          label="Latest"
          value={latest ? `${formatWeight(latest.value)} lb` : '–'}
          detail={latest ? formatShortDate(latest.date) : undefined}
        />
        <Figure label="Best" value={`${formatWeight(best.value)} lb`} detail={formatShortDate(best.date)} />
        <Figure label="Change" value={change === null ? '–' : `${signed(change, formatWeight)} lb`} />
      </div>
      <DateLineChart
        points={points.map((p) => ({ ...p, hollow: p.lowConfidence, pr: prDates.has(p.date) }))}
        caption={`Estimated 1-rep max, ${exercise.name}`}
        valueLabel="Estimated 1RM (lb)"
        formatValue={(lb) => formatWeight(lb)}
        tooltip={(p) => (
          <>
            <p className="text-base font-semibold text-stone-100 tabular-nums">
              {formatWeight(p.value)} lb <span className="text-xs font-normal text-stone-400">est. 1RM</span>
            </p>
            <p className="text-xs text-stone-400 tabular-nums">
              {formatShortDate(p.date)} · best set {formatWeight(p.weightLb)} × {p.reps}
              {p.lowConfidence && ' (rough estimate)'}
            </p>
          </>
        )}
      />
      <p className="text-xs text-stone-500">
        Best working set each day, estimated with the Epley formula.
        {anyLowConfidence && ` Hollow dots are rough: that day's best set was over ${MAX_CONFIDENT_REPS} reps.`}
      </p>
    </>
  )
}

/** Reps-only lifts (pull-ups): most reps in one set per day. */
function RepsTrend({
  exercise,
  sets,
  prDates,
}: {
  exercise: Exercise
  sets: DatedSet[]
  prDates: ReadonlySet<ISODate>
}) {
  const points = repsByDay(sets)
  if (points.length === 0) return <Empty exercise={exercise} />

  const latest = points.at(-1)
  const first = points[0]
  const best = points.reduce((top, p) => (p.bestSet > top.bestSet ? p : top))
  const change = latest && first && points.length > 1 ? latest.bestSet - first.bestSet : null

  return (
    <>
      <div className="grid grid-cols-3 gap-2 md:gap-4">
        <Figure
          label="Latest best set"
          value={latest ? repsText(latest.bestSet) : '–'}
          detail={latest ? `${latest.totalReps} total · ${formatShortDate(latest.date)}` : undefined}
        />
        <Figure label="Best set" value={repsText(best.bestSet)} detail={formatShortDate(best.date)} />
        <Figure label="Change" value={change === null ? '–' : signed(change, (n) => String(n))} />
      </div>
      <DateLineChart
        points={points.map((p) => ({ ...p, value: p.bestSet, pr: prDates.has(p.date) }))}
        caption={`Most reps in a set, ${exercise.name}`}
        valueLabel="Reps"
        formatValue={(n) => String(Math.round(n))}
        zeroBaseline
        tooltip={(p) => (
          <>
            <p className="text-base font-semibold text-stone-100 tabular-nums">
              {repsText(p.bestSet)} <span className="text-xs font-normal text-stone-400">best set</span>
            </p>
            <p className="text-xs text-stone-400 tabular-nums">
              {formatShortDate(p.date)} · {p.totalReps} total in {p.workingSets}{' '}
              {p.workingSets === 1 ? 'set' : 'sets'}
            </p>
          </>
        )}
      />
      <p className="text-xs text-stone-500">Most reps in a single working set each day.</p>
    </>
  )
}
