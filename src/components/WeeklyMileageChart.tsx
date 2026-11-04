import type { WeeklyMileage } from '../lib/metrics'
import { WeeklyBarChart } from './WeeklyBarChart'

/** Miles per week. */
export function WeeklyMileageChart({ data }: { data: WeeklyMileage[] }) {
  return (
    <WeeklyBarChart
      data={data.map((week) => ({ weekStart: week.weekStart, value: week.miles }))}
      caption="Miles per week"
      valueLabel="Miles"
      formatValue={(miles) => miles.toFixed(1)}
      formatAxis={(miles) => String(Math.round(miles))}
      unit="mi"
    />
  )
}
