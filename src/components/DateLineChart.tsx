import type { Key, ReactNode } from 'react'
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { formatShortDate, fromDayNumber, toDayNumber, type ISODate } from '../lib/dates'
import { PR_COLOR, PrBadge, PrLegend } from './prMarker'

// Validated (dataviz checks) against the stone-900 card surface.
const LINE = '#3987e5'
const SURFACE = '#1c1917'
const GRID = '#292524'
const AXIS_TEXT = '#a8a29e'

export interface DatePoint {
  date: ISODate
  value: number
  /** Drawn as a hollow dot (e.g. a low-confidence estimate). */
  hollow?: boolean
  /** A personal record: drawn as a larger yellow dot and labeled "PR" in the tooltip. */
  pr?: boolean
}

interface Datum<P extends DatePoint> {
  day: number
  value: number
  point: P
}

interface DotProps {
  cx?: number
  cy?: number
  payload?: { point?: DatePoint }
}

function Dot({ cx, cy, payload }: DotProps) {
  if (cx === undefined || cy === undefined) return null
  const hollow = payload?.point?.hollow === true
  if (payload?.point?.pr === true) {
    return <circle cx={cx} cy={cy} r={6} fill={PR_COLOR} stroke={SURFACE} strokeWidth={2} />
  }
  return (
    <circle
      cx={cx}
      cy={cy}
      r={4}
      fill={hollow ? SURFACE : LINE}
      stroke={hollow ? LINE : SURFACE}
      strokeWidth={2}
    />
  )
}

/**
 * One series over calendar days: a 2px line with dots, hover/tap tooltip, and a
 * screen-reader table. Single series, so no legend: the section title names it.
 */
export function DateLineChart<P extends DatePoint>({
  points,
  caption,
  valueLabel,
  formatValue,
  tooltip,
  zeroBaseline = false,
}: {
  points: P[]
  caption: string
  valueLabel: string
  formatValue: (value: number) => string
  tooltip: (point: P) => ReactNode
  /** Start the y-axis at 0 (distances) instead of near the data (strength). */
  zeroBaseline?: boolean
}) {
  const data: Datum<P>[] = points.map((point) => ({ day: toDayNumber(point.date), value: point.value, point }))
  const firstDay = data[0]?.day ?? 0
  const lastDay = data.at(-1)?.day ?? 0
  const anyPr = points.some((p) => p.pr)

  return (
    <>
      {anyPr && <PrLegend />}
      <div className="h-48 w-full md:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
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
              domain={zeroBaseline ? [0, 'auto'] : ['auto', 'auto']}
              tickFormatter={(v: number) => formatValue(v)}
              allowDecimals={false}
              tick={{ fill: AXIS_TEXT, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              content={({ active, payload }) => {
                const datum = payload?.[0]?.payload as Datum<P> | undefined
                if (!active || !datum) return null
                return (
                  <div className="rounded-lg border border-stone-700 bg-stone-950 px-3 py-2 shadow-lg">
                    {datum.point.pr && <PrBadge />}
                    {tooltip(datum.point)}
                  </div>
                )
              }}
              cursor={{ stroke: '#57534e', strokeWidth: 1 }}
              isAnimationActive={false}
            />
            <Line
              dataKey="value"
              stroke={LINE}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              dot={(props: DotProps & { key?: Key | null }) => {
                const { key, ...rest } = props
                return <Dot key={key ?? undefined} {...rest} />
              }}
              activeDot={{ r: 6, fill: LINE, stroke: SURFACE, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <table className="sr-only">
        <caption>{caption}</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">{valueLabel}</th>
          </tr>
        </thead>
        <tbody>
          {points.map((point, i) => (
            <tr key={`${point.date}-${i}`}>
              <td>{formatShortDate(point.date)}</td>
              <td>
                {formatValue(point.value)}
                {point.pr && ' (PR)'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
