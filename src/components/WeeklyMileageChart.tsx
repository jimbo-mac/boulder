import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate } from '../lib/dates'
import type { WeeklyMileage } from '../lib/metrics'

// Validated (dataviz checks) against the stone-900 card surface.
const BAR = '#3987e5'
const BAR_ACTIVE = '#5b9cf0'
const GRID = '#292524' // stone-800
const AXIS_TEXT = '#a8a29e' // stone-400

function TooltipBody({ active, payload }: { active?: boolean; payload?: readonly { payload?: unknown }[] }) {
  const week = payload?.[0]?.payload as WeeklyMileage | undefined
  if (!active || !week) return null
  return (
    <div className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 shadow-lg">
      <p className="text-base font-semibold text-stone-100 tabular-nums">{week.miles.toFixed(1)} mi</p>
      <p className="text-xs text-stone-400">Week of {formatShortDate(week.weekStart)}</p>
    </div>
  )
}

/** Miles per week. Single series, so no legend; tap/hover a bar for its value. */
export function WeeklyMileageChart({ data }: { data: WeeklyMileage[] }) {
  return (
    <>
      <div className="h-56 w-full md:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 4, bottom: 0, left: -12 }}>
            <CartesianGrid vertical={false} stroke={GRID} strokeWidth={1} />
            <XAxis
              dataKey="weekStart"
              tickFormatter={formatShortDate}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: GRID }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
              width={40}
            />
            <Tooltip
              content={TooltipBody}
              cursor={{ fill: 'rgba(255,255,255,0.04)' }}
              isAnimationActive={false}
            />
            <Bar
              dataKey="miles"
              fill={BAR}
              activeBar={{ fill: BAR_ACTIVE }}
              maxBarSize={24}
              radius={[4, 4, 0, 0]}
              isAnimationActive={false}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Same data for screen readers. */}
      <table className="sr-only">
        <caption>Miles per week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Miles</th>
          </tr>
        </thead>
        <tbody>
          {data.map((week) => (
            <tr key={week.weekStart}>
              <td>{formatShortDate(week.weekStart)}</td>
              <td>{week.miles.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
