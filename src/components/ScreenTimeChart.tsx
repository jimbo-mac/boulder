import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate } from '../lib/dates'
import { formatMinutes } from '../lib/format'
import { MINUTES_AVERAGE_DAYS, type DailyMinutes } from '../lib/metrics'
import { evenTicks, minuteTicks } from '../lib/ticks'

// One hue (validated against the stone-900 card): bars = each day, line = trend.
const LINE = '#3987e5'
const BAR = 'rgba(57, 135, 229, 0.45)'
const BAR_ACTIVE = 'rgba(57, 135, 229, 0.7)'
const SURFACE = '#1c1917'
const GRID = '#292524'
const AXIS_TEXT = '#a8a29e'

function TooltipBody({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const day = payload?.[0]?.payload as DailyMinutes | undefined
  if (!active || !day) return null
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 shadow-lg">
      <p className="text-xs text-stone-400">{formatShortDate(day.date)}</p>
      <p className="text-base font-semibold text-stone-100 tabular-nums">
        {day.minutes === null ? 'Not logged' : formatMinutes(day.minutes)}
      </p>
      {day.avg7 !== null && (
        <p className="text-sm text-stone-200 tabular-nums">
          {formatMinutes(day.avg7)} <span className="text-xs text-stone-400">{MINUTES_AVERAGE_DAYS}-day avg</span>
        </p>
      )}
    </div>
  )
}

/** Screen time per day with a trailing 7-day average. Lower is better. */
export function ScreenTimeChart({ days }: { days: DailyMinutes[] }) {
  const max = Math.max(0, ...days.flatMap((d) => [d.minutes ?? 0, d.avg7 ?? 0]))
  const ticks = minuteTicks(max)
  // At most 4 date labels so they never overlap on a phone.
  const dateTicks = evenTicks(
    days.map((d) => d.date),
    4,
  )

  return (
    <>
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-stone-400" aria-hidden="true">
        <span className="flex items-center gap-1.5">
          <svg width="10" height="10">
            <rect width="10" height="10" rx="2" fill={BAR} />
          </svg>
          Each day
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="16" height="10">
            <line x1="0" y1="5" x2="16" y2="5" stroke={LINE} strokeWidth="2" strokeLinecap="round" />
          </svg>
          {MINUTES_AVERAGE_DAYS}-day average
        </span>
        <span className="ml-auto">Lower = better</span>
      </div>

      <div className="h-56 w-full md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={days} margin={{ top: 8, right: 20, bottom: 0, left: -8 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="date"
              tickFormatter={formatShortDate}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              ticks={dateTicks}
              interval={0}
            />
            <YAxis
              domain={[0, ticks.at(-1) ?? 'auto']}
              ticks={ticks}
              tickFormatter={(m: number) => (m === 0 ? '0' : formatMinutes(m))}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={48}
            />
            <Tooltip content={TooltipBody} cursor={{ fill: 'rgba(255,255,255,0.04)' }} isAnimationActive={false} />
            <Bar
              dataKey="minutes"
              fill={BAR}
              activeBar={{ fill: BAR_ACTIVE }}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
            <Line
              dataKey="avg7"
              type="monotone"
              stroke={LINE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={false}
              activeDot={{ r: 5, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              connectNulls
              isAnimationActive={false}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <table className="sr-only">
        <caption>Screen time per day, with {MINUTES_AVERAGE_DAYS}-day average</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Screen time</th>
            <th scope="col">{MINUTES_AVERAGE_DAYS}-day average</th>
          </tr>
        </thead>
        <tbody>
          {days.map((d) => (
            <tr key={d.date}>
              <td>{formatShortDate(d.date)}</td>
              <td>{d.minutes === null ? 'not logged' : formatMinutes(d.minutes)}</td>
              <td>{d.avg7 === null ? '–' : formatMinutes(d.avg7)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
