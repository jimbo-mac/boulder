import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate, fromDayNumber, toDayNumber } from '../lib/dates'
import type { Run } from '../lib/db/runs'
import { formatDuration, formatMiles } from '../lib/format'

const LINE = '#3987e5'
const SURFACE = '#1c1917'
const GRID = '#292524'
const AXIS_TEXT = '#a8a29e'

interface Datum {
  day: number
  date: string
  miles: number
  durationS: number
}

function TooltipBody({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const point = payload?.[0]?.payload as Datum | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 shadow-lg">
      <p className="text-base font-semibold text-stone-100 tabular-nums">{formatMiles(point.miles)} mi</p>
      <p className="text-xs text-stone-400">
        {formatShortDate(point.date)} · {formatDuration(point.durationS)}
      </p>
    </div>
  )
}

/** Distance of each long run over time. Single series: the section title names it. */
export function LongRunChart({ runs }: { runs: Run[] }) {
  const data: Datum[] = runs.map((run) => ({
    day: toDayNumber(run.date),
    date: run.date,
    miles: run.distanceMi,
    durationS: run.durationS,
  }))
  const firstDay = data[0]?.day ?? 0
  const lastDay = data.at(-1)?.day ?? 0

  return (
    <>
      <div className="h-48 w-full md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="day"
              type="number"
              domain={[firstDay - 1, lastDay + 1]}
              tickFormatter={(day: number) => formatShortDate(fromDayNumber(day))}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickCount={5}
              allowDecimals={false}
            />
            <YAxis
              domain={[0, 'auto']}
              allowDecimals={false}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip content={TooltipBody} cursor={{ stroke: '#57534e', strokeWidth: 1 }} isAnimationActive={false} />
            <Line
              dataKey="miles"
              stroke={LINE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={{ r: 4, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>Long run distance</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Miles</th>
          </tr>
        </thead>
        <tbody>
          {data.map((d, i) => (
            <tr key={`${d.date}-${i}`}>
              <td>{formatShortDate(d.date)}</td>
              <td>{formatMiles(d.miles)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
