import { useRef, useState } from 'react'
import { cardClass, errorMessage } from '../components/ui'
import {
  addDays,
  addMonths,
  formatLongDate,
  formatMonth,
  monthGrid,
  monthStart,
  todayLocal,
  weekStart,
  type ISODate,
} from '../lib/dates'
import { checksBetween, listHabits, setCheck, type Habit } from '../lib/db/habits'
import { daysDoneInMonth, weeklyGoalProgress } from '../lib/metrics'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'

// Fixed order (dataviz palette slots 1–2, validated on the stone-900 card).
// Dot position (left/right) also identifies the routine, so color is never alone.
const HABIT_COLORS = ['#3987e5', '#d95926'] as const
const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'] as const

const key = (habitId: string, date: ISODate) => `${habitId}|${date}`

function colorOf(index: number): string {
  return HABIT_COLORS[index % HABIT_COLORS.length] ?? HABIT_COLORS[0]
}

function Dot({ color, size = 8, hollow = false }: { color: string; size?: number; hollow?: boolean }) {
  const r = size / 2 - 1
  return (
    <svg width={size} height={size} aria-hidden="true" className="shrink-0">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill={hollow ? 'none' : color}
        stroke={hollow ? '#44403c' : 'none'}
        strokeWidth={hollow ? 1 : 0}
      />
    </svg>
  )
}

/** Log > Stretch: check off each routine per day, see the month, track the weekly goal. */
export function StretchForm() {
  const today = todayLocal()
  const [selected, setSelected] = useState<ISODate>(today)
  const [month, setMonth] = useState<ISODate>(monthStart(today))
  const habits = useAsync('habits:stretch', () => listHabits('stretch'))

  const weeks = monthGrid(month)
  const selectedWeek = weekStart(selected)
  // The visible grid plus the selected day's week (it may be in another month).
  const gridFrom = weeks[0]?.[0] ?? month
  const gridTo = weeks.at(-1)?.[6] ?? month
  const from = selectedWeek < gridFrom ? selectedWeek : gridFrom
  const to = addDays(selectedWeek, 6) > gridTo ? addDays(selectedWeek, 6) : gridTo

  const list = habits.data ?? []
  const ids = list.map((h) => h.id)
  const checks = useAsync(`checks:${ids.join(',')}:${from}..${to}`, () => checksBetween(ids, from, to))

  // Toggles show at once; the saved truth overrides whatever was loaded.
  const [overrides, setOverrides] = useState<ReadonlyMap<string, boolean>>(new Map())
  const [saveError, setSaveError] = useState<string | null>(null)
  // One save at a time per habit-day, so a quick check-uncheck lands in order.
  const queue = useRef(new Map<string, Promise<void>>())

  const loaded = new Set((checks.data ?? []).map((c) => key(c.habitId, c.date)))
  const isDone = (habitId: string, date: ISODate) => overrides.get(key(habitId, date)) ?? loaded.has(key(habitId, date))
  const doneDates = (habitId: string, dates: readonly ISODate[]) => dates.filter((d) => isDone(habitId, d))

  function toggle(habit: Habit, date: ISODate) {
    if (date > today) return
    const k = key(habit.id, date)
    const done = !isDone(habit.id, date)
    setSaveError(null)
    setOverrides((prev) => new Map(prev).set(k, done))
    const previous = queue.current.get(k) ?? Promise.resolve()
    const next = previous.then(() =>
      setCheck(habit.id, date, done).catch((err: unknown) => {
        setOverrides((prev) => new Map(prev).set(k, !done))
        setSaveError(errorMessage(err))
      }),
    )
    queue.current.set(k, next)
  }

  if (habits.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
        Couldn&apos;t load stretching routines: {habits.error}
      </p>
    )
  }
  if (habits.data === undefined) return <p className="text-stone-400">Loading…</p>

  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i))
  const monthDays = weeks.flat().filter((d) => d.slice(0, 7) === month.slice(0, 7))
  const isToday = selected === today

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{isToday ? 'Today' : formatLongDate(selected)}</p>
        {!isToday && (
          <button
            type="button"
            onClick={() => {
              setSelected(today)
              setMonth(monthStart(today))
            }}
            className="py-2 text-sm text-stone-400 underline underline-offset-4"
          >
            Back to today
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {list.map((habit, i) => {
          const done = isDone(habit.id, selected)
          const progress = weeklyGoalProgress(doneDates(habit.id, weekDays), selected, habit.weeklyGoal)
          return (
            <button
              key={habit.id}
              type="button"
              aria-pressed={done}
              onClick={() => toggle(habit, selected)}
              className={`flex h-28 flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
                done ? 'border-stone-100 bg-stone-100 text-stone-950' : 'border-stone-700 bg-stone-900 active:bg-stone-800'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-lg font-semibold">
                  <Dot color={colorOf(i)} size={10} />
                  {habit.name}
                </span>
                <span aria-hidden="true" className="text-2xl leading-none">
                  {done ? '✓' : ''}
                </span>
              </span>
              <span className={`text-sm tabular-nums ${done ? 'text-stone-700' : 'text-stone-400'}`}>
                {progress.done} of {progress.goal} this week{progress.met && ' · goal met'}
              </span>
            </button>
          )
        })}
      </div>

      {saveError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t save: {saveError}
        </p>
      )}

      <section className={`${cardClass} flex flex-col gap-3`} aria-label="Stretching calendar">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, -1))}
            aria-label="Previous month"
            className="h-11 w-11 rounded-lg text-xl text-stone-300 active:bg-stone-800"
          >
            ‹
          </button>
          <h2 className="font-semibold">{formatMonth(month)}</h2>
          <button
            type="button"
            onClick={() => setMonth(addMonths(month, 1))}
            disabled={addMonths(month, 1) > today}
            aria-label="Next month"
            className="h-11 w-11 rounded-lg text-xl text-stone-300 active:bg-stone-800 disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <div className="flex gap-4 text-xs text-stone-400" aria-hidden="true">
          {list.map((habit, i) => (
            <span key={habit.id} className="flex items-center gap-1.5">
              <Dot color={colorOf(i)} />
              {habit.name}
            </span>
          ))}
        </div>

        <div className={`grid grid-cols-7 gap-1 transition-opacity ${checks.loading ? 'opacity-50' : ''}`}>
          {WEEKDAYS.map((d, i) => (
            <span key={i} className="text-center text-xs text-stone-500" aria-hidden="true">
              {d}
            </span>
          ))}
          {weeks.flat().map((date) => {
            const inMonth = date.slice(0, 7) === month.slice(0, 7)
            const future = date > today
            const status = list
              .map((h) => `${h.name} ${isDone(h.id, date) ? 'done' : 'not done'}`)
              .join(', ')
            return (
              <button
                key={date}
                type="button"
                disabled={future}
                aria-pressed={date === selected}
                aria-current={date === today ? 'date' : undefined}
                aria-label={`${formatLongDate(date)}: ${status}`}
                onClick={() => setSelected(date)}
                className={`flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-sm tabular-nums ${
                  date === selected ? 'ring-2 ring-stone-300' : ''
                } ${date === today ? 'font-bold text-stone-50' : inMonth ? 'text-stone-200' : 'text-stone-600'} disabled:opacity-30 enabled:active:bg-stone-800`}
              >
                {Number(date.slice(8))}
                <span className="flex gap-1">
                  {list.map((h, i) => (
                    <Dot key={h.id} color={colorOf(i)} hollow={!isDone(h.id, date)} />
                  ))}
                </span>
              </button>
            )
          })}
        </div>

        {checks.error && <p className="text-sm text-red-300">Couldn&apos;t load days: {checks.error}</p>}

        <p className="text-sm text-stone-400">
          This month:{' '}
          {list
            .map((h) => {
              const n = daysDoneInMonth(doneDates(h.id, monthDays), month)
              return `${h.name} ${n} ${n === 1 ? 'day' : 'days'}`
            })
            .join(' · ')}
        </p>
      </section>

      <a href={routeHref('settings')} className="self-center py-2 text-sm text-stone-400 underline underline-offset-4">
        Change weekly goals
      </a>
    </div>
  )
}
