import { useState } from 'react'
import { MonthCalendar } from '../components/MonthCalendar'
import { cardClass, inputClass, linkButtonClass } from '../components/ui'
import { formatLongDate, monthGrid } from '../lib/dates'
import { allChecks, listHabits, type Habit, type HabitCheck } from '../lib/db/habits'
import { cleanHmDigits, formatHmDigits, formatMinutes, hmDigitsToMinutes, minutesToHmDigits } from '../lib/format'
import { dailyStreakWhere } from '../lib/metrics'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { useHabitDays } from '../lib/useHabitDays'

const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

/** Log > Habits: check off daily habits (with streaks) and log screen time. */
export function HabitsForm() {
  const habits = useAsync('habits:habit', async () => {
    const list = await listHabits('habit')
    // All history, so streaks can reach back past the visible month.
    const history = await allChecks(list.filter((h) => h.tracking === 'check').map((h) => h.id))
    return { list, history }
  })

  if (habits.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
        Couldn&apos;t load habits: {habits.error}
      </p>
    )
  }
  if (habits.data === undefined) return <p className="text-stone-400">Loading…</p>
  return <HabitDays list={habits.data.list} history={habits.data.history} />
}

function HabitDays({ list, history }: { list: Habit[]; history: HabitCheck[] }) {
  const days = useHabitDays(list, history)
  const { today, selected, month, isDone, entry } = days
  const checkHabits = list.filter((h) => h.tracking === 'check')
  const minuteHabits = list.filter((h) => h.tracking === 'minutes')
  const isToday = selected === today
  const monthDays = monthGrid(month)
    .flat()
    .filter((d) => d.slice(0, 7) === month.slice(0, 7))

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-baseline justify-between gap-3">
        <p className="font-medium">{isToday ? 'Today' : formatLongDate(selected)}</p>
        {!isToday && (
          <button type="button" onClick={days.goToToday} className="py-2 text-sm text-stone-400 underline underline-offset-4">
            Back to today
          </button>
        )}
      </div>

      {checkHabits.length === 0 ? (
        <p className="text-sm text-stone-400">
          No habits yet.{' '}
          <a href={routeHref('settings')} className="text-stone-200 underline underline-offset-4">
            Add one in Settings
          </a>
          .
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {checkHabits.map((habit) => {
            const done = isDone(habit.id, selected)
            const streak = dailyStreakWhere((d) => isDone(habit.id, d), today)
            return (
              <button
                key={habit.id}
                type="button"
                aria-pressed={done}
                onClick={() => days.toggle(habit, selected)}
                className={`flex h-16 items-center justify-between gap-3 rounded-xl border px-4 text-left transition-colors ${
                  done ? 'border-stone-100 bg-stone-100 text-stone-950' : 'border-stone-700 bg-stone-900 active:bg-stone-800'
                }`}
              >
                <span className="min-w-0">
                  <span className="block truncate text-lg font-semibold">{habit.name}</span>
                  <span className={`block text-sm tabular-nums ${done ? 'text-stone-700' : 'text-stone-400'}`}>
                    {streak > 0 ? `${daysText(streak)} in a row` : 'No streak yet'}
                  </span>
                </span>
                <span aria-hidden="true" className="text-2xl leading-none">
                  {done ? '✓' : ''}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {minuteHabits.map((habit) => {
        const current = entry(habit.id, selected)?.minutes ?? null
        return (
          <MinutesField
            // Re-start the field when the day or its saved value changes.
            key={`${habit.id}:${selected}:${current ?? 'none'}`}
            habit={habit}
            saved={current}
            onSave={(minutes) => days.setDayMinutes(habit, selected, minutes)}
          />
        )
      })}

      {days.saveError && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t save: {days.saveError}
        </p>
      )}

      <MonthCalendar
        label="Habits calendar"
        month={month}
        onMonthChange={days.setMonth}
        selected={selected}
        onSelect={days.setSelected}
        today={today}
        dimmed={days.loading}
        renderDay={(date) => {
          const done = checkHabits.filter((h) => isDone(h.id, date)).length
          const total = checkHabits.length
          const status = [
            ...checkHabits.map((h) => `${h.name} ${isDone(h.id, date) ? 'done' : 'not done'}`),
            ...minuteHabits.map((h) => {
              const minutes = entry(h.id, date)?.minutes
              return `${h.name} ${minutes == null ? 'not logged' : formatMinutes(minutes)}`
            }),
          ].join(', ')
          return {
            // Text, not color: how many of the day's habits were done.
            marks: (
              <span aria-hidden="true" className="h-3 text-[10px] leading-3 text-stone-400">
                {total > 0 && done === total ? '✓' : done > 0 ? `${done}/${total}` : ''}
              </span>
            ),
            status,
          }
        }}
        footer={
          <>
            {days.loadError && <p className="text-sm text-red-300">Couldn&apos;t load days: {days.loadError}</p>}
            {checkHabits.length > 0 && (
              <p className="text-sm text-stone-400">
                This month:{' '}
                {checkHabits
                  .map((h) => `${h.name} ${daysText(monthDays.filter((d) => isDone(h.id, d)).length)}`)
                  .join(' · ')}
              </p>
            )}
          </>
        }
      />

      <a href={routeHref('settings')} className="self-center py-2 text-sm text-stone-400 underline underline-offset-4">
        Add or change habits
      </a>
    </div>
  )
}

/** Hours:minutes for one day, typed like the run time field ("215" → 2:15). */
function MinutesField({
  habit,
  saved,
  onSave,
}: {
  habit: Habit
  saved: number | null
  onSave: (minutes: number | null) => void
}) {
  const [digits, setDigits] = useState(saved === null ? '' : minutesToHmDigits(saved))
  const minutes = hmDigitsToMinutes(digits)
  const invalid = digits !== '' && minutes === null
  const changed = minutes !== saved
  const id = `minutes-${habit.id}`

  return (
    <section className={`${cardClass} flex flex-col gap-2`}>
      <label htmlFor={id} className="font-semibold">
        {habit.name} <span className="text-sm font-normal text-stone-400">(hours:minutes)</span>
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="2:15"
          value={formatHmDigits(digits)}
          onChange={(e) => setDigits(cleanHmDigits(e.target.value))}
          className={`${inputClass} text-lg tabular-nums`}
        />
        <button
          type="button"
          disabled={minutes === null || !changed}
          onClick={() => onSave(minutes)}
          className="h-12 shrink-0 rounded-lg bg-stone-100 px-5 font-semibold text-stone-950 active:bg-stone-300 disabled:opacity-40"
        >
          Save
        </button>
      </div>
      {invalid && <p className="text-sm text-red-300">Minutes must be under 60, and the total under 24 hours.</p>}
      <div className="flex items-center justify-between gap-3 text-sm text-stone-400">
        <span role="status">{saved === null ? 'Not logged for this day.' : `Saved: ${formatMinutes(saved)}`}</span>
        {saved !== null && (
          <button type="button" onClick={() => onSave(null)} className={linkButtonClass}>
            Clear
          </button>
        )}
      </div>
    </section>
  )
}
