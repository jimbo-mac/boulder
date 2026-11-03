import { useMemo, useState } from 'react'
import { LongRunChart } from '../components/LongRunChart'
import { PaceTrendChart } from '../components/PaceTrendChart'
import { cardClass, chipClass } from '../components/ui'
import { WeeklyMileageChart } from '../components/WeeklyMileageChart'
import { addDays, formatLongDate, formatShortDate, todayLocal, toDayNumber, weekStart } from '../lib/dates'
import { runsBetween, type Run } from '../lib/db/runs'
import { getSettings, type Settings } from '../lib/db/settings'
import { formatDuration, formatMiles, formatPace, formatPaceChange } from '../lib/format'
import { goalPace, pace, paceTrend, predictRaceTime, weeklyMileage } from '../lib/metrics'
import { describeDistance } from '../lib/races'
import { RANGES, rangeStart, type RangeValue } from '../lib/ranges'
import { routeHref } from '../lib/router'
import { RUN_KINDS, runKindLabel, type RunKind } from '../lib/runKinds'
import { useAsync } from '../lib/useAsync'

/** Runs used for the trailing pace average and the start-vs-end comparison. */
const PACE_WINDOW = 5
/** The race prediction looks at best efforts from this many recent days. */
const PREDICTION_DAYS = 56

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cardClass}>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-stone-400 tabular-nums">{detail}</p>}
    </div>
  )
}

export function RunningProgress() {
  const today = todayLocal()
  const [range, setRange] = useState<RangeValue>('12w')
  const from = rangeStart(range, today)

  const ranged = useAsync(`${from ?? 'all'}..${today}`, async () => ({
    from,
    to: today,
    runs: await runsBetween(from, today),
  }))
  const settings = useAsync('settings', getSettings)

  // Computed from the result's own range, so a dimmed old chart stays self-consistent.
  const weeks = useMemo(() => {
    if (!ranged.data) return null
    const { runs, to } = ranged.data
    // "All" starts at the first run (or this week if there are none).
    const start = ranged.data.from ?? runs[0]?.date ?? weekStart(to)
    return weeklyMileage(runs, start, to)
  }, [ranged.data])

  const runs = ranged.data?.runs ?? null
  const goal = settings.data ?? null
  const goalPaceS =
    goal?.goalDistanceMi && goal.goalTimeS ? goalPace(goal.goalTimeS, goal.goalDistanceMi) : null

  const total = weeks?.reduce((sum, w) => sum + w.miles, 0) ?? 0
  const thisWeek = weeks?.at(-1)?.miles ?? 0
  const average = weeks && weeks.length > 0 ? total / weeks.length : 0

  return (
    <div className="flex flex-col gap-4">
      {goal && <GoalCard goal={goal} today={today} />}

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

      {ranged.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load runs: {ranged.error}
        </p>
      )}

      {weeks === null && !ranged.error && <p className="text-stone-400">Loading…</p>}

      {weeks && runs && (
        // Keep the previous render while refetching, dimmed, so nothing jumps.
        <div
          className={`flex flex-col gap-4 transition-opacity ${ranged.loading ? 'opacity-50' : ''}`}
        >
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Stat label="This week" value={`${thisWeek.toFixed(1)} mi`} />
            <Stat label="Weekly avg" value={`${average.toFixed(1)} mi`} />
            <Stat label="Total" value={`${total.toFixed(1)} mi`} />
          </div>
          <section className={cardClass}>
            <h2 className="mb-3 font-semibold">Weekly mileage</h2>
            {runs.length === 0 ? (
              <p className="py-10 text-center text-stone-400">No runs in this range yet.</p>
            ) : (
              <WeeklyMileageChart data={weeks} />
            )}
          </section>
          <PaceSection runs={runs} goalPaceS={goalPaceS} />
          <LongRunSection runs={runs} />
        </div>
      )}
    </div>
  )
}

function GoalCard({ goal, today }: { goal: Settings; today: string }) {
  const recent = useAsync(`recent..${today}`, () =>
    runsBetween(addDays(today, -(PREDICTION_DAYS - 1)), today),
  )

  if (goal.goalDistanceMi === null || goal.goalTimeS === null) {
    return (
      <p className="text-sm text-stone-400">
        <a href={routeHref('settings')} className="text-stone-200 underline underline-offset-4">
          Set a goal race
        </a>{' '}
        to see your goal pace and a predicted finish time.
      </p>
    )
  }

  const distance = goal.goalDistanceMi
  const title = goal.goalRaceName ?? `${describeDistance(distance)} goal`
  const prediction = recent.data ? predictRaceTime(recent.data, distance) : null
  const gap = prediction ? prediction.timeS - goal.goalTimeS : null
  const daysToGo = goal.goalRaceDate ? toDayNumber(goal.goalRaceDate) - toDayNumber(today) : null

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <div>
        <h2 className="font-semibold">{title}</h2>
        <p className="text-sm text-stone-400">
          {describeDistance(distance)}
          {goal.goalRaceDate && ` · ${formatLongDate(goal.goalRaceDate)}`}
          {daysToGo !== null && daysToGo >= 0 && ` · ${daysToGo} days to go`}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <Figure
          label="Goal"
          value={formatDuration(goal.goalTimeS)}
          detail={`${formatPace(goalPace(goal.goalTimeS, distance))} /mi`}
        />
        <Figure
          label="Predicted"
          value={prediction ? formatDuration(prediction.timeS) : '–'}
          detail={prediction ? `${formatPace(prediction.timeS / distance)} /mi` : undefined}
        />
      </div>
      {recent.data && (
        <p className="text-xs text-stone-400">
          {prediction ? (
            <>
              {gap !== null && Math.round(gap) !== 0 && (
                <span className="font-medium text-stone-200">
                  {formatDuration(Math.abs(gap))} {gap > 0 ? 'off goal' : 'ahead of goal'}.{' '}
                </span>
              )}
              Based on your best effort in the last 8 weeks:{' '}
              {formatMiles(prediction.basedOn.distanceMi)} mi on{' '}
              {formatShortDate(prediction.basedOn.date)} at{' '}
              {formatPace(pace(prediction.basedOn.durationS, prediction.basedOn.distanceMi))} /mi.
            </>
          ) : (
            'Log a run of 3+ miles to get a predicted time.'
          )}
        </p>
      )}
      {recent.error && <p className="text-xs text-red-300">Couldn&apos;t load prediction: {recent.error}</p>}
    </section>
  )
}

function PaceSection({ runs, goalPaceS }: { runs: Run[]; goalPaceS: number | null }) {
  const [kind, setKind] = useState<RunKind>('base')
  const ofKind = runs.filter((run) => run.kind === kind)
  const trend = paceTrend(ofKind, PACE_WINDOW)
  const current = trend.points.at(-1)?.avg

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="font-semibold">Pace</h2>
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Run type">
        {RUN_KINDS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={kind === option.value}
            onClick={() => setKind(option.value)}
            className={`${chipClass(kind === option.value)} px-1 text-sm`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {ofKind.length === 0 ? (
        <p className="py-10 text-center text-stone-400">
          No {runKindLabel(kind).toLowerCase()} runs in this range yet.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <Figure
              label={`Current (${PACE_WINDOW}-run avg)`}
              value={current === undefined ? '–' : `${formatPace(current)} /mi`}
            />
            <Figure label="Change in range" value={formatPaceChange(trend.improvement)} />
          </div>
          <PaceTrendChart points={trend.points} windowSize={PACE_WINDOW} goalPaceS={goalPaceS} />
        </>
      )}
    </section>
  )
}

function LongRunSection({ runs }: { runs: Run[] }) {
  const longRuns = runs.filter((run) => run.kind === 'long')
  const longest = longRuns.reduce((max, run) => Math.max(max, run.distanceMi), 0)
  const latest = longRuns.at(-1)

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="font-semibold">Long runs</h2>
      {longRuns.length === 0 ? (
        <p className="py-10 text-center text-stone-400">No long runs in this range yet.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 md:gap-4">
            <Figure label="Longest" value={`${formatMiles(longest)} mi`} />
            <Figure
              label="Latest"
              value={latest ? `${formatMiles(latest.distanceMi)} mi` : '–'}
              detail={latest ? formatShortDate(latest.date) : undefined}
            />
          </div>
          <LongRunChart runs={longRuns} />
        </>
      )}
    </section>
  )
}
