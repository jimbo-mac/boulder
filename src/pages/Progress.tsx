import { useEffect, useMemo, useRef, useState } from 'react'
import { cardClass, chipClass, errorMessage } from '../components/ui'
import { WeeklyMileageChart } from '../components/WeeklyMileageChart'
import { todayLocal, weekStart, type ISODate } from '../lib/dates'
import { runsBetween, type Run } from '../lib/db/runs'
import { weeklyMileage } from '../lib/metrics'
import { RANGES, rangeStart, type RangeValue } from '../lib/ranges'

type Tab = 'running' | 'lifting'

export function Progress() {
  const [tab, setTab] = useState<Tab>('running')

  return (
    <div className="flex flex-col gap-5">
      <div className="grid max-w-xs grid-cols-2 gap-2" role="group" aria-label="Progress type">
        <button
          type="button"
          aria-pressed={tab === 'running'}
          onClick={() => setTab('running')}
          className={chipClass(tab === 'running')}
        >
          Running
        </button>
        <button
          type="button"
          aria-pressed={tab === 'lifting'}
          onClick={() => setTab('lifting')}
          className={chipClass(tab === 'lifting')}
        >
          Lifting
        </button>
      </div>
      {tab === 'running' ? (
        <RunningProgress />
      ) : (
        <p className="text-stone-400">Lifting charts are coming soon.</p>
      )}
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className={cardClass}>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** A finished fetch, tagged with the query it answers. */
interface FetchResult {
  key: string
  from: ISODate | null
  to: ISODate
  runs: Run[] | null
  error: string | null
}

function RunningProgress() {
  const today = todayLocal()
  const [range, setRange] = useState<RangeValue>('12w')
  const from = rangeStart(range, today)
  const key = `${from ?? 'all'}..${today}`

  const [result, setResult] = useState<FetchResult | null>(null)
  // Only the newest request may update state; older responses are dropped.
  const latestKey = useRef(key)

  useEffect(() => {
    latestKey.current = key
    runsBetween(from, today).then(
      (runs) => {
        if (latestKey.current === key) setResult({ key, from, to: today, runs, error: null })
      },
      (err: unknown) => {
        if (latestKey.current === key) {
          setResult({ key, from, to: today, runs: null, error: errorMessage(err) })
        }
      },
    )
  }, [key, from, today])

  const loading = result?.key !== key
  const error = loading ? null : (result?.error ?? null)
  const runs = result?.runs ?? null

  // Computed from the result's own range, so a dimmed old chart stays self-consistent.
  const weeks = useMemo(() => {
    if (!result?.runs) return null
    // "All" starts at the first run (or this week if there are none).
    const start = result.from ?? result.runs[0]?.date ?? weekStart(result.to)
    return weeklyMileage(result.runs, start, result.to)
  }, [result])

  const total = weeks?.reduce((sum, w) => sum + w.miles, 0) ?? 0
  const thisWeek = weeks?.at(-1)?.miles ?? 0
  const average = weeks && weeks.length > 0 ? total / weeks.length : 0

  return (
    <div className="flex flex-col gap-4">
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

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load runs: {error}
        </p>
      )}

      {weeks === null && !error && <p className="text-stone-400">Loading…</p>}

      {weeks && (
        // Keep the previous render while refetching, dimmed, so nothing jumps.
        <div className={`flex flex-col gap-4 transition-opacity ${loading ? 'opacity-50' : ''}`}>
          <div className="grid grid-cols-3 gap-2 md:gap-4">
            <Stat label="This week" value={`${thisWeek.toFixed(1)} mi`} />
            <Stat label="Weekly avg" value={`${average.toFixed(1)} mi`} />
            <Stat label="Total" value={`${total.toFixed(1)} mi`} />
          </div>
          <section className={cardClass}>
            <h2 className="mb-3 font-semibold">Weekly mileage</h2>
            {runs?.length === 0 ? (
              <p className="py-10 text-center text-stone-400">No runs in this range yet.</p>
            ) : (
              <WeeklyMileageChart data={weeks} />
            )}
          </section>
        </div>
      )}
    </div>
  )
}
