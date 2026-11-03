import { useEffect, useState } from 'react'
import { errorMessage, secondaryButtonClass } from '../components/ui'
import { formatLongDate } from '../lib/dates'
import { listRuns, type Run } from '../lib/db/runs'
import { formatDuration, formatMiles, formatPace } from '../lib/format'
import { pace } from '../lib/metrics'
import { routeHref } from '../lib/router'
import { runKindLabel } from '../lib/runKinds'

export const PAGE_SIZE = 50

export function History() {
  const [runs, setRuns] = useState<Run[] | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    listRuns(0, PAGE_SIZE).then(
      (page) => {
        if (cancelled) return
        setRuns(page)
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
    if (!runs) return
    setLoadingMore(true)
    setError(null)
    try {
      const page = await listRuns(runs.length, PAGE_SIZE)
      setRuns([...runs, ...page])
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

      {runs === null && !error && <p className="text-stone-400">Loading…</p>}

      {runs?.length === 0 && (
        <p className="text-stone-400">
          No runs yet.{' '}
          <a href={routeHref('log')} className="text-stone-200 underline underline-offset-4">
            Log your first one
          </a>
          .
        </p>
      )}

      {runs && runs.length > 0 && (
        <ul className="flex flex-col divide-y divide-stone-800 rounded-xl border border-stone-800 bg-stone-900">
          {runs.map((run) => (
            <li key={run.workoutId} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="font-medium">{formatLongDate(run.date)}</p>
                <p className="text-sm text-stone-400">{runKindLabel(run.kind)}</p>
              </div>
              <div className="text-right tabular-nums">
                <p className="font-semibold">
                  {formatMiles(run.distanceMi)} mi
                  <span className="font-normal text-stone-400"> · {formatDuration(run.durationS)}</span>
                </p>
                <p className="text-sm text-stone-400">
                  {formatPace(pace(run.durationS, run.distanceMi))} /mi
                </p>
              </div>
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
          Couldn&apos;t load runs: {error}
        </p>
      )}
    </div>
  )
}
