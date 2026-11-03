import { useState } from 'react'
import { DateLineChart } from '../components/DateLineChart'
import { cardClass, chipClass, inputClass, labelClass } from '../components/ui'
import { formatShortDate, todayLocal } from '../lib/dates'
import { listExercises, setsForExercise } from '../lib/db/lifts'
import { formatWeight } from '../lib/format'
import { MAX_CONFIDENT_REPS, oneRepMaxByDay } from '../lib/metrics'
import { RANGES, rangeStart, type RangeValue } from '../lib/ranges'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-stone-400 tabular-nums">{detail}</p>}
    </div>
  )
}

export function LiftingProgress() {
  const today = todayLocal()
  const exercises = useAsync('exercises', listExercises)
  const [chosenId, setChosenId] = useState<string | null>(null)
  const [range, setRange] = useState<RangeValue>('12w')
  const from = rangeStart(range, today)

  const list = exercises.data ?? []
  const exercise = list.find((e) => e.id === chosenId) ?? list[0] ?? null

  const sets = useAsync(`${exercise?.id ?? 'none'}|${from ?? 'all'}..${today}`, () =>
    exercise ? setsForExercise(exercise.id, from, today) : Promise.resolve([]),
  )

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

  const points = oneRepMaxByDay(sets.data ?? [])
  const latest = points.at(-1)
  const first = points[0]
  const best = points.reduce<(typeof points)[number] | undefined>(
    (top, p) => (!top || p.value > top.value ? p : top),
    undefined,
  )
  const change = latest && first && points.length > 1 ? latest.value - first.value : null
  const anyLowConfidence = points.some((p) => p.lowConfidence)

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

      <section
        className={`${cardClass} flex flex-col gap-4 transition-opacity ${sets.loading ? 'opacity-50' : ''}`}
      >
        <h2 className="font-semibold">Estimated 1-rep max</h2>
        {sets.data === undefined && !sets.error ? (
          <p className="py-10 text-center text-stone-400">Loading…</p>
        ) : points.length === 0 ? (
          <p className="py-10 text-center text-stone-400">
            No working sets of {exercise.name} in this range yet.
          </p>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 md:gap-4">
              <Figure
                label="Latest"
                value={latest ? `${formatWeight(latest.value)} lb` : '–'}
                detail={latest ? formatShortDate(latest.date) : undefined}
              />
              <Figure
                label="Best"
                value={best ? `${formatWeight(best.value)} lb` : '–'}
                detail={best ? formatShortDate(best.date) : undefined}
              />
              <Figure
                label="Change"
                value={change === null ? '–' : `${change >= 0 ? '+' : '−'}${formatWeight(Math.abs(change))} lb`}
              />
            </div>
            <DateLineChart
              points={points.map((p) => ({ ...p, hollow: p.lowConfidence }))}
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
              {anyLowConfidence &&
                ` Hollow dots are rough: that day's best set was over ${MAX_CONFIDENT_REPS} reps.`}
            </p>
          </>
        )}
      </section>
    </div>
  )
}
