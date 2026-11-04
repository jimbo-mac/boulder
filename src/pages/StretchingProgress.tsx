import { useMemo, useState } from 'react'
import { habitColor } from '../components/habitColors'
import { RangePicker } from '../components/RangePicker'
import { WeekGrid } from '../components/WeekGrid'
import { cardClass } from '../components/ui'
import { todayLocal, weekStart, type ISODate } from '../lib/dates'
import { allChecks, listHabits, type Habit } from '../lib/db/habits'
import { goalStreak, goalWeeks } from '../lib/metrics'
import { DEFAULT_RANGE, rangeStart, type RangeValue } from '../lib/ranges'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'

function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
    </div>
  )
}

const weeksText = (n: number) => `${n} ${n === 1 ? 'week' : 'weeks'}`

/** Progress > Stretching: read-only week grids, weekly goal record, and streaks. */
export function StretchingProgress() {
  const habits = useAsync('habits:stretch', () => listHabits('stretch'))
  if (habits.error) return <LoadError message={habits.error} />
  if (habits.data === undefined) return <p className="text-stone-400">Loading…</p>
  // Mounted once the routines are known, so it never requests checks for no habits.
  return <Routines list={habits.data} />
}

function LoadError({ message }: { message: string }) {
  return (
    <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
      Couldn&apos;t load stretching: {message}
    </p>
  )
}

function Routines({ list }: { list: Habit[] }) {
  const today = todayLocal()
  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE)
  // All history: streaks can reach back past the selected range.
  const checks = useAsync(`checks:all:${list.map((h) => h.id).join(',')}`, () => allChecks(list.map((h) => h.id)))

  const datesByHabit = useMemo(() => {
    const map = new Map<string, ISODate[]>()
    for (const check of checks.data ?? []) {
      const dates = map.get(check.habitId) ?? []
      dates.push(check.date)
      map.set(check.habitId, dates)
    }
    return map
  }, [checks.data])

  if (checks.error) return <LoadError message={checks.error} />
  if (checks.data === undefined) return <p className="text-stone-400">Loading…</p>

  const from = rangeStart(range, today) ?? weekStart(today)

  return (
    <div className="flex flex-col gap-4">
      <RangePicker value={range} onChange={setRange} />
      {list.map((habit, i) => (
        <RoutineCard
          key={habit.id}
          habit={habit}
          color={habitColor(i)}
          dates={datesByHabit.get(habit.id) ?? []}
          from={from}
          today={today}
        />
      ))}
      <p className="text-xs text-stone-500">
        ✓ goal met · – missed · · this week, in progress. Weeks are judged against the current goal.{' '}
        <a href={routeHref('settings')} className="underline underline-offset-4">
          Change goals
        </a>
      </p>
    </div>
  )
}

function RoutineCard({
  habit,
  color,
  dates,
  from,
  today,
}: {
  habit: Habit
  color: string
  dates: ISODate[]
  from: ISODate
  today: ISODate
}) {
  const weeks = goalWeeks(dates, from, today, habit.weeklyGoal)
  const current = weeks.at(-1)
  const streak = goalStreak(dates, today, habit.weeklyGoal)
  // Finished weeks, plus this week once its goal is met.
  const counted = weeks.filter((w) => w.complete || w.met)
  const met = counted.filter((w) => w.met).length
  const doneSet = new Set(dates)

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="flex items-center gap-2 font-semibold">
          <svg width="10" height="10" aria-hidden="true">
            <rect width="10" height="10" rx="2" fill={color} />
          </svg>
          {habit.name}
        </h2>
        <p className="text-sm text-stone-400">Goal {habit.weeklyGoal}× a week</p>
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="This week" value={current ? `${current.done} of ${habit.weeklyGoal}` : '–'} />
        <Figure label="Week streak" value={weeksText(streak)} />
        <Figure label="Goal met" value={counted.length === 0 ? '–' : `${met} of ${weeksText(counted.length)}`} />
      </div>
      <WeekGrid
        name={habit.name}
        color={color}
        weeks={weeks.map((w) => ({
          weekStart: w.weekStart,
          done: w.done,
          mark: w.met ? '✓' : w.complete ? '–' : '·',
          result: w.met ? 'met' : w.complete ? 'missed' : 'in progress',
        }))}
        resultLabel="Goal"
        isDone={(date) => doneSet.has(date)}
        today={today}
      />
    </section>
  )
}
