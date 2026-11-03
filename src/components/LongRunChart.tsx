import { formatShortDate } from '../lib/dates'
import type { Run } from '../lib/db/runs'
import { formatDuration, formatMiles } from '../lib/format'
import { DateLineChart } from './DateLineChart'

/** Distance of each long run over time. */
export function LongRunChart({ runs }: { runs: Run[] }) {
  const points = runs.map((run) => ({ date: run.date, value: run.distanceMi, run }))
  return (
    <DateLineChart
      points={points}
      caption="Long run distance"
      valueLabel="Miles"
      formatValue={(miles) => String(Math.round(miles * 10) / 10)}
      zeroBaseline
      tooltip={({ run }) => (
        <>
          <p className="text-base font-semibold text-stone-100 tabular-nums">{formatMiles(run.distanceMi)} mi</p>
          <p className="text-xs text-stone-400">
            {formatShortDate(run.date)} · {formatDuration(run.durationS)}
          </p>
        </>
      )}
    />
  )
}
