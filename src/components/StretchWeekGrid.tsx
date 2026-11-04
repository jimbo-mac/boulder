import { addDays, formatShortDate, formatShortMonth, type ISODate } from '../lib/dates'
import type { GoalWeek } from '../lib/metrics'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const HOLLOW = '#44403c' // stone-700 outline: not done

interface MonthSpan {
  /** First week column of the run, 0-based. */
  start: number
  length: number
  label: string
}

/**
 * Runs of consecutive weeks whose Monday falls in the same month. A label only
 * gets its own columns' width, so labels can't overlap. A one-week run at the
 * start is left blank (its name wouldn't fit); the last run may spill right.
 */
function monthSpans(weeks: readonly GoalWeek[]): MonthSpan[] {
  const spans: MonthSpan[] = []
  weeks.forEach((week, i) => {
    const label = formatShortMonth(week.weekStart)
    const last = spans.at(-1)
    if (last && last.label === label) last.length += 1
    else spans.push({ start: i, length: 1, label })
  })
  return spans
}

/**
 * Read-only week grid for one routine: a column per week, a row per weekday,
 * a filled square for each day done, and a goal mark under each week.
 */
export function StretchWeekGrid({
  name,
  color,
  weeks,
  isDone,
  today,
}: {
  name: string
  color: string
  weeks: GoalWeek[]
  isDone: (date: ISODate) => boolean
  today: ISODate
}) {
  const spans = monthSpans(weeks)
  const columns = `1rem repeat(${weeks.length}, minmax(0, 1.75rem))`

  return (
    <>
      <div
        aria-hidden="true"
        className="grid justify-start gap-1"
        style={{ gridTemplateColumns: columns }}
      >
        {/* Month names, each spanning its weeks. */}
        <span />
        {spans.map((span, i) => {
          const isLast = i === spans.length - 1
          const hidden = i === 0 && span.length === 1 && spans.length > 1
          return (
            <span
              key={span.start}
              className={`text-xs font-medium whitespace-nowrap text-stone-400 ${isLast ? '' : 'overflow-hidden'}`}
              style={{ gridColumn: `${span.start + 2} / span ${span.length}` }}
            >
              {hidden ? '' : span.label}
            </span>
          )
        })}

        {/* Day of the month each week starts (its Monday). */}
        <span />
        {weeks.map((week) => (
          <span key={week.weekStart} className="text-center text-xs text-stone-500 tabular-nums">
            {Number(week.weekStart.slice(8))}
          </span>
        ))}

        {WEEKDAYS.map((label, day) => (
          <div key={day} className="contents">
            <span className="text-xs leading-none text-stone-500 self-center">{label}</span>
            {weeks.map((week) => {
              const date = addDays(week.weekStart, day)
              // Future days: blank, but keep the row's height.
              if (date > today) return <span key={date} className="aspect-square" />
              const done = isDone(date)
              return (
                <span
                  key={date}
                  className="aspect-square rounded-sm"
                  style={done ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 1px ${HOLLOW}` }}
                />
              )
            })}
          </div>
        ))}

        <span />
        {weeks.map((week) => (
          <span key={week.weekStart} className="text-center text-sm leading-6 text-stone-300">
            {week.met ? '✓' : week.complete ? '–' : '·'}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{name} by week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Days done</th>
            <th scope="col">Goal</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>{formatShortDate(week.weekStart)}</td>
              <td>{week.done}</td>
              <td>{week.met ? 'met' : week.complete ? 'missed' : 'in progress'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
