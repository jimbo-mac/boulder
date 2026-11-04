import { addDays, formatShortDate, formatShortMonth, type ISODate } from '../lib/dates'

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
export interface GridWeek {
  /** Monday that starts the week. */
  weekStart: ISODate
  /** Days done that week. */
  done: number
  /** Shown under the week's column, e.g. "✓" or "5". */
  mark: string
  /** Read out in the table view when the grid has a `resultLabel`, e.g. "met". */
  result?: string
}

function monthSpans(weeks: readonly GridWeek[]): MonthSpan[] {
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
 * Read-only week grid for one habit: a column per week, a row per weekday,
 * a filled square for each day done, and a mark under each week.
 */
export function WeekGrid({
  name,
  color,
  weeks,
  isDone,
  today,
  resultLabel,
  isMissed,
}: {
  name: string
  color: string
  weeks: GridWeek[]
  isDone: (date: ISODate) => boolean
  today: ISODate
  /** Heading for a third table column holding each week's `result`. */
  resultLabel?: string
  /** Days marked missed (✗) get a small ✗ instead of an empty square. */
  isMissed?: (date: ISODate) => boolean
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
              const missed = !done && (isMissed?.(date) ?? false)
              return (
                <span
                  key={date}
                  className="flex aspect-square items-center justify-center rounded-sm text-[10px] leading-none text-stone-400"
                  style={done ? { backgroundColor: color } : { boxShadow: `inset 0 0 0 1px ${HOLLOW}` }}
                >
                  {missed ? '✗' : ''}
                </span>
              )
            })}
          </div>
        ))}

        <span />
        {weeks.map((week) => (
          <span key={week.weekStart} className="text-center text-sm leading-6 text-stone-300">
            {week.mark}
          </span>
        ))}
      </div>

      <table className="sr-only">
        <caption>{name} by week</caption>
        <thead>
          <tr>
            <th scope="col">Week of</th>
            <th scope="col">Days done</th>
            {resultLabel && <th scope="col">{resultLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.weekStart}>
              <td>{formatShortDate(week.weekStart)}</td>
              <td>{week.done}</td>
              {resultLabel && <td>{week.result}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
