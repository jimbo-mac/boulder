import { Dot } from '../components/Dot'
import { habitColor as colorOf } from '../components/habitColors'
import { MonthCalendar } from '../components/MonthCalendar'
import { addDays, formatLongDate, monthGrid, weekStart } from '../lib/dates'
import { listHabits, type Habit } from '../lib/db/habits'
import { daysDoneInMonth, weeklyGoalProgress } from '../lib/metrics'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { useHabitDays } from '../lib/useHabitDays'

/** Log > Stretch: check off each routine per day, see the month, track the weekly goal. */
export function StretchForm() {
  const habits = useAsync('habits:stretch', () => listHabits('stretch'))

  if (habits.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
        Couldn&apos;t load stretching routines: {habits.error}
      </p>
    )
  }
  if (habits.data === undefined) return <p className="text-stone-400">Loading…</p>
  // Mounted once the routines are known, so it never requests checks for no habits.
  return <StretchDays list={habits.data} />
}

function StretchDays({ list }: { list: Habit[] }) {
  const days = useHabitDays(list)
  const { today, selected, month, isDone } = days

  const selectedWeek = weekStart(selected)
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(selectedWeek, i))
  const monthDays = monthGrid(month)
    .flat()
    .filter((d) => d.slice(0, 7) === month.slice(0, 7))
  const doneDates = (habitId: string, dates: readonly string[]) => dates.filter((d) => isDone(habitId, d))
  const isToday = selected === today

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{isToday ? 'Today' : formatLongDate(selected)}</p>
        {!isToday && (
          <button
            type="button"
            onClick={days.goToToday}
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
              onClick={() => days.toggle(habit, selected)}
              className={`flex h-28 flex-col justify-between rounded-xl border p-3 text-left transition-colors ${
                done ? 'border-stone-100 bg-stone-100 text-stone-950' : 'border-stone-700 bg-stone-900 active:bg-stone-800'
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className="flex items-center gap-2 text-lg font-semibold">
                  {/* Dot position (left/right) also identifies the routine in the calendar. */}
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

      {days.saveError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t save: {days.saveError}
        </p>
      )}

      <MonthCalendar
        label="Stretching calendar"
        month={month}
        onMonthChange={days.setMonth}
        selected={selected}
        onSelect={days.setSelected}
        today={today}
        dimmed={days.loading}
        legend={
          <div className="flex gap-4 text-xs text-stone-400" aria-hidden="true">
            {list.map((habit, i) => (
              <span key={habit.id} className="flex items-center gap-1.5">
                <Dot color={colorOf(i)} />
                {habit.name}
              </span>
            ))}
          </div>
        }
        renderDay={(date) => ({
          marks: (
            <span className="flex gap-1">
              {list.map((h, i) => (
                <Dot key={h.id} color={colorOf(i)} hollow={!isDone(h.id, date)} />
              ))}
            </span>
          ),
          status: list.map((h) => `${h.name} ${isDone(h.id, date) ? 'done' : 'not done'}`).join(', '),
        })}
        footer={
          <>
            {days.loadError && <p className="text-sm text-red-300">Couldn&apos;t load days: {days.loadError}</p>}
            <p className="text-sm text-stone-400">
              This month:{' '}
              {list
                .map((h) => {
                  const n = daysDoneInMonth(doneDates(h.id, monthDays), month)
                  return `${h.name} ${n} ${n === 1 ? 'day' : 'days'}`
                })
                .join(' · ')}
            </p>
          </>
        }
      />

      <a href={routeHref('settings')} className="self-center py-2 text-sm text-stone-400 underline underline-offset-4">
        Change weekly goals
      </a>
    </div>
  )
}
