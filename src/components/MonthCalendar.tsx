import type { ReactNode } from 'react'
import { addMonths, formatLongDate, formatMonth, monthGrid, type ISODate } from '../lib/dates'
import { cardClass } from './ui'

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

/**
 * Month calendar (Monday first) for picking a day to log. Each day shows what
 * `renderDay` returns under its number; future days are disabled.
 */
export function MonthCalendar({
  label,
  month,
  onMonthChange,
  selected,
  onSelect,
  today,
  dimmed = false,
  legend,
  footer,
  renderDay,
}: {
  /** Accessible name for the calendar section. */
  label: string
  /** Any day in the month shown. */
  month: ISODate
  onMonthChange: (month: ISODate) => void
  selected: ISODate
  onSelect: (date: ISODate) => void
  today: ISODate
  /** Fade the days while loading. */
  dimmed?: boolean
  legend?: ReactNode
  footer?: ReactNode
  renderDay: (date: ISODate) => { marks: ReactNode; status: string }
}) {
  const days = monthGrid(month).flat()
  const thisMonth = month.slice(0, 7)

  return (
    <section className={`${cardClass} flex flex-col gap-3`} aria-label={label}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, -1))}
          aria-label="Previous month"
          className="h-11 w-11 rounded-lg text-xl text-stone-300 active:bg-stone-800"
        >
          ‹
        </button>
        <h2 className="font-semibold">{formatMonth(month)}</h2>
        <button
          type="button"
          onClick={() => onMonthChange(addMonths(month, 1))}
          disabled={addMonths(month, 1) > today}
          aria-label="Next month"
          className="h-11 w-11 rounded-lg text-xl text-stone-300 active:bg-stone-800 disabled:opacity-30"
        >
          ›
        </button>
      </div>

      {legend}

      <div className={`grid grid-cols-7 gap-1 transition-opacity ${dimmed ? 'opacity-50' : ''}`}>
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="text-center text-xs text-stone-500" aria-hidden="true">
            {d}
          </span>
        ))}
        {days.map((date) => {
          const { marks, status } = renderDay(date)
          const color =
            date === today ? 'font-bold text-stone-50' : date.slice(0, 7) === thisMonth ? 'text-stone-200' : 'text-stone-600'
          return (
            <button
              key={date}
              type="button"
              disabled={date > today}
              aria-pressed={date === selected}
              aria-current={date === today ? 'date' : undefined}
              aria-label={`${formatLongDate(date)}: ${status}`}
              onClick={() => onSelect(date)}
              className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-sm tabular-nums ${
                date === selected ? 'ring-2 ring-stone-300' : ''
              } ${color} disabled:opacity-30 enabled:active:bg-stone-800`}
            >
              {Number(date.slice(8))}
              {marks}
            </button>
          )
        })}
      </div>

      {footer}
    </section>
  )
}
