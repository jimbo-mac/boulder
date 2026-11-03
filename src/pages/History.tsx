import { useEffect, useState } from 'react'
import { errorMessage, secondaryButtonClass } from '../components/ui'
import { formatLongDate } from '../lib/dates'
import { listHistory, type HistoryEntry, type LiftEntry, type RunEntry } from '../lib/db/history'
import { formatDuration, formatMiles, formatPace, formatWeight } from '../lib/format'
import { pace, totalVolume } from '../lib/metrics'
import { routeHref } from '../lib/router'
import { runKindLabel } from '../lib/runKinds'

export const PAGE_SIZE = 50

function RunRow({ run }: { run: RunEntry }) {
  return (
    <>
      <div className="min-w-0">
        <p className="font-medium">{formatLongDate(run.date)}</p>
        <p className="text-sm text-stone-400">{runKindLabel(run.kind)} run</p>
      </div>
      <div className="text-right tabular-nums">
        <p className="font-semibold">
          {formatMiles(run.distanceMi)} mi
          <span className="font-normal text-stone-400"> · {formatDuration(run.durationS)}</span>
        </p>
        <p className="text-sm text-stone-400">{formatPace(pace(run.durationS, run.distanceMi))} /mi</p>
      </div>
    </>
  )
}

function LiftRow({ lift }: { lift: LiftEntry }) {
  const working = lift.sets.filter((s) => !s.isWarmup).length
  return (
    <>
      <div className="min-w-0">
        <p className="font-medium">{formatLongDate(lift.date)}</p>
        <p className="truncate text-sm text-stone-400">{lift.exercises.join(', ') || 'Lift'}</p>
      </div>
      <div className="shrink-0 text-right tabular-nums">
        <p className="font-semibold">
          {working} {working === 1 ? 'set' : 'sets'}
        </p>
        <p className="text-sm text-stone-400">{formatWeight(totalVolume(lift.sets))} lb</p>
      </div>
    </>
  )
}

export function History() {
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listHistory(0, PAGE_SIZE).then(
      (page) => {
        if (cancelled) return
        setEntries(page)
        setHasMore(page.length === PAGE_SIZE)
      },
      (err: unknown) => {
        if (!cancelled) setError(errorMessage(err))
      },
    )
    return () => {
      cancelled = true
    }
  }, [])

  async function loadMore() {
    if (!entries) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await listHistory(entries.length, PAGE_SIZE)
      setEntries([...entries, ...page])
      setHasMore(page.length === PAGE_SIZE)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setLoadingMore(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">History</h1>

      {entries === null && !error && <p className="text-stone-400">Loading…</p>}

      {entries?.length === 0 && (
        <p className="text-stone-400">
          No workouts yet.{' '}
          <a href={routeHref('log')} className="text-stone-200 underline underline-offset-4">
            Log your first one
          </a>
          .
        </p>
      )}

      {entries && entries.length > 0 && (
        <ul className="flex flex-col divide-y divide-stone-800 rounded-xl border border-stone-800 bg-stone-900">
          {entries.map((entry) => (
            <li key={entry.workoutId} className="flex items-center justify-between gap-3 px-4 py-3">
              {entry.type === 'run' ? <RunRow run={entry} /> : <LiftRow lift={entry} />}
            </li>
          ))}
        </ul>
      )}

      {hasMore && (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={loadingMore}
          className={secondaryButtonClass}
        >
          {loadingMore ? 'Loading…' : 'Load more'}
        </button>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load workouts: {error}
        </p>
      )}
    </div>
  )
}
