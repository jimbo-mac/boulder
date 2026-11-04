import { addDays, formatShortDate, type ISODate } from '../lib/dates'
import type { GoalWeek } from '../lib/metrics'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const
const HOLLOW = '#44403c' // stone-700 outline: not done

/** Above this many weeks, only every 4th column gets a date label. */
const LABEL_ALL_UP_TO = 6

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
  const labelEvery = weeks.length > LABEL_ALL_UP_TO ? 4 : 1
  const columns = `1rem repeat(${weeks.length}, minmax(0, 1.75rem))`

  return (
    <>
      <div
        aria-hidden="true"
        className="grid justify-start gap-1"
        style={{ gridTemplateColumns: columns }}
      >
        <span />
        {weeks.map((week, i) => (
          <span key={week.weekStart} className="overflow-visible text-xs whitespace-nowrap text-stone-500">
            {i % labelEvery === 0 ? formatShortDate(week.weekStart) : ''}
          </span>
        ))}

        {WEEKDAYS.map((label, day) => (
          <div key={day} className="contents">
            <span className="text-xs leading-none text-stone-500 self-center">{label}</span>
            {weeks.map((week) => {
              const date = addDays(week.weekStart, day)
              if (date > today) return <span key={date} />
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
