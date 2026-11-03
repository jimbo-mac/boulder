import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { formatShortDate, fromDayNumber, toDayNumber } from '../lib/dates'
import { formatPace } from '../lib/format'
import type { PacePoint } from '../lib/metrics'
import { paceTicks } from '../lib/ticks'

// One hue (validated against the stone-900 card): dots = each run, line = trend.
const LINE = '#3987e5'
const DOT = 'rgba(57, 135, 229, 0.55)'
const SURFACE = '#1c1917' // stone-900, ring around dots
const GRID = '#292524'
const AXIS_TEXT = '#a8a29e'
const GOAL = '#d6d3d1' // stone-300: a neutral reference, not a data series

interface Datum extends PacePoint {
  day: number
}

function TooltipBody({
  active,
  payload,
  windowSize,
}: {
  active?: boolean
  payload?: readonly { payload?: unknown }[]
  windowSize: number
}) {
  const point = payload?.[0]?.payload as Datum | undefined
  if (!active || !point) return null
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 shadow-lg">
      <p className="text-xs text-stone-400">{formatShortDate(point.date)}</p>
      <p className="text-base font-semibold text-stone-100 tabular-nums">
        {formatPace(point.pace)} <span className="text-xs font-normal text-stone-400">/mi this run</span>
      </p>
      <p className="text-sm text-stone-200 tabular-nums">
        {formatPace(point.avg)}{' '}
        <span className="text-xs text-stone-400">/mi {windowSize}-run avg</span>
      </p>
    </div>
  )
}

/** Pace over time. Normal axis: lower is faster, so improvement trends down. */
export function PaceTrendChart({
  points,
  windowSize,
  goalPaceS = null,
}: {
  points: PacePoint[]
  windowSize: number
  /** Draws a reference line at goal pace when set. */
  goalPaceS?: number | null
}) {
  const data: Datum[] = points.map((p) => ({ ...p, day: toDayNumber(p.date) }))
  const values = points.flatMap((p) => [p.pace, p.avg])
  if (goalPaceS !== null) values.push(goalPaceS)
  const ticks = paceTicks(Math.min(...values), Math.max(...values))
  const firstDay = data[0]?.day ?? 0
  const lastDay = data.at(-1)?.day ?? 0
  // Pad a day each side so single points and edge dots aren't clipped.
  const xDomain: [number, number] = [firstDay - 1, lastDay + 1]

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10">
            <circle cx="5" cy="5" r="4" fill={DOT} />
          </svg>
          Each run
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="10">
            <line x1="0" y1="5" x2="16" y2="5" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {windowSize}-run average
        </span>
        {goalPaceS !== null && (
          <span className="flex items-center gap-1.5">
            <svg width="16" height="10">
              <line x1="0" y1="5" x2="16" y2="5" stroke={GOAL} strokeWidth="1" />
            </svg>
            Goal {formatPace(goalPaceS)}
          </span>
        )}
        <span className="ml-auto">Lower = faster</span>
      </div>

      <div className="h-56 w-full md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="day"
              type="number"
              domain={xDomain}
              tickFormatter={(day: number) => formatShortDate(fromDayNumber(day))}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              tickCount={5}
              allowDecimals={false}
            />
            <YAxis
              domain={[ticks[0] ?? 'auto', ticks.at(-1) ?? 'auto']}
              ticks={ticks}
              tickFormatter={(s: number) => formatPace(s)}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={(props) => <TooltipBody {...props} windowSize={windowSize} />}
              cursor={{ stroke: '#57534e', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            {goalPaceS !== null && (
              <ReferenceLine y={goalPaceS} stroke={GOAL} strokeWidth={1} ifOverflow="extendDomain" />
            )}
            <Line
              dataKey="pace"
              stroke="none"
              dot={{ r: 4, fill: DOT, stroke: SURFACE, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="avg"
              type="monotone"
              stroke={LINE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Pace per run, with {windowSize}-run average</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Pace per mile</th>
            <th scope="col">{windowSize}-run average</th>
          </tr>
        </thead>
        <tbody>
          {points.map((p, i) => (
            <tr key={`${p.date}-${i}`}>
              <td>{formatShortDate(p.date)}</td>
              <td>{formatPace(p.pace)}</td>
              <td>{formatPace(p.avg)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
