import { useMemo, useState } from 'react'
import { RangePicker } from '../components/RangePicker'
import { ScreenTimeChart } from '../components/ScreenTimeChart'
import { cardClass } from '../components/ui'
import { WeekGrid } from '../components/WeekGrid'
import { addDays, toDayNumber, todayLocal, weekStart, type ISODate } from '../lib/dates'
import { allChecks, listHabits, type Habit, type HabitCheck } from '../lib/db/habits'
import { formatMinutes } from '../lib/format'
import { averageMinutes, bestStreak, dailyMinutes, dailyStreak, MINUTES_AVERAGE_DAYS } from '../lib/metrics'
import { DEFAULT_RANGE, rangeStart, type RangeValue } from '../lib/ranges'
import { routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'

/** Color for check-off habit squares (palette slot 1; validated on stone-900). */
const HABIT_COLOR = '#3987e5'

const daysText = (n: number) => `${n} ${n === 1 ? 'day' : 'days'}`

function Figure({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div>
      <p className="text-xs text-stone-400">{label}</p>
      <p className="mt-1 text-lg font-semibold tabular-nums">{value}</p>
      {detail && <p className="text-xs text-stone-400">{detail}</p>}
    </div>
  )
}

/** Progress > Habits: streaks and week grids for check-offs, and the screen time trend. */
export function HabitsProgress() {
  const data = useAsync('habits:habit:all', async () => {
    const list = await listHabits('habit')
    return { list, checks: await allChecks(list.map((h) => h.id)) }
  })

  if (data.error) {
    return (
      <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
        Couldn&apos;t load habits: {data.error}
      </p>
    )
  }
  if (data.data === undefined) return <p className="text-stone-400">Loading…</p>
  return <Habits list={data.data.list} checks={data.data.checks} />
}

function Habits({ list, checks }: { list: Habit[]; checks: HabitCheck[] }) {
  const today = todayLocal()
  const [range, setRange] = useState<RangeValue>(DEFAULT_RANGE)
  const from = rangeStart(range, today) ?? weekStart(today)

  const byHabit = useMemo(() => {
    const map = new Map<string, HabitCheck[]>()
    for (const c of checks) {
      const forHabit = map.get(c.habitId) ?? []
      forHabit.push(c)
      map.set(c.habitId, forHabit)
    }
    return map
  }, [checks])

  // Tap-to-check and ✓ / ✗ habits.
  const checkHabits = list.filter((h) => h.tracking !== 'minutes')
  const minuteHabits = list.filter((h) => h.tracking === 'minutes')

  return (
    <div className="flex flex-col gap-4">
      <RangePicker value={range} onChange={setRange} />

      {minuteHabits.map((habit) => (
        <MinutesCard key={habit.id} habit={habit} entries={byHabit.get(habit.id) ?? []} from={from} today={today} />
      ))}

      {checkHabits.length === 0 && (
        <p className="text-sm text-stone-400">
          No habits to show yet.{' '}
          <a href={routeHref('settings')} className="text-stone-200 underline underline-offset-4">
            Add one in Settings
          </a>
          .
        </p>
      )}
      {checkHabits.map((habit) => (
        <CheckCard
          key={habit.id}
          habit={habit}
          dates={(byHabit.get(habit.id) ?? []).filter((c) => c.done).map((c) => c.date)}
          missedDates={(byHabit.get(habit.id) ?? []).filter((c) => !c.done).map((c) => c.date)}
          from={from}
          today={today}
        />
      ))}
    </div>
  )
}

function CheckCard({
  habit,
  dates,
  missedDates,
  from,
  today,
}: {
  habit: Habit
  /** Days done (✓). */
  dates: ISODate[]
  /** Days marked missed (✗); empty for tap-to-check habits. */
  missedDates: ISODate[]
  from: ISODate
  today: ISODate
}) {
  const done = new Set(dates)
  const missed = new Set(missedDates)
  const current = dailyStreak(dates, today, missedDates)
  const best = bestStreak(dates, today)
  const rangeDays = toDayNumber(today) - toDayNumber(from) + 1
  const doneInRange = dates.filter((d) => d >= from && d <= today).length

  const weeks: { weekStart: ISODate; done: number; mark: string }[] = []
  for (let week = weekStart(from); week <= today; week = addDays(week, 7)) {
    let n = 0
    for (let i = 0; i < 7; i++) if (done.has(addDays(week, i))) n += 1
    weeks.push({ weekStart: week, done: n, mark: String(n) })
  }

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="font-semibold">{habit.name}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Streak" value={daysText(current)} />
        <Figure label="Best streak" value={daysText(best)} />
        <Figure label="Done" value={`${doneInRange} of ${rangeDays}`} detail="days in range" />
      </div>
      <WeekGrid
        name={habit.name}
        color={HABIT_COLOR}
        weeks={weeks}
        isDone={(d) => done.has(d)}
        isMissed={(d) => missed.has(d)}
        today={today}
      />
      <p className="text-xs text-stone-500">
        Number under each week = days done.{habit.tracking === 'yesno' && ' ✗ = marked missed.'}
      </p>
    </section>
  )
}

function MinutesCard({
  habit,
  entries,
  from,
  today,
}: {
  habit: Habit
  entries: HabitCheck[]
  from: ISODate
  today: ISODate
}) {
  const logged = entries.flatMap((e) => (e.minutes === null ? [] : [{ date: e.date, minutes: e.minutes }]))
  const days = dailyMinutes(logged, from, today)
  const average = averageMinutes(logged, from, today)
  // The same number of days just before this range.
  const length = toDayNumber(today) - toDayNumber(from) + 1
  const previous = averageMinutes(logged, addDays(from, -length), addDays(from, -1))
  const change = average !== null && previous !== null ? average - previous : null
  const loggedDays = days.filter((d) => d.minutes !== null).length

  return (
    <section className={`${cardClass} flex flex-col gap-4`}>
      <h2 className="font-semibold">{habit.name}</h2>
      <div className="grid grid-cols-3 gap-2">
        <Figure label="Average" value={average === null ? '–' : formatMinutes(average)} detail="per day" />
        <Figure
          label="vs. before"
          value={change === null ? '–' : Math.round(change) === 0 ? 'Same' : formatMinutes(change)}
          detail={change === null ? 'not enough data' : Math.round(change) === 0 ? undefined : change < 0 ? 'less ↓' : 'more ↑'}
        />
        <Figure label="Logged" value={`${loggedDays} of ${days.length}`} detail="days" />
      </div>
      {loggedDays === 0 ? (
        <p className="py-10 text-center text-stone-400">No screen time logged in this range yet.</p>
      ) : (
        <ScreenTimeChart days={days} />
      )}
      <p className="text-xs text-stone-500">
        Averages count logged days only. &ldquo;vs. before&rdquo; compares with the same number of days just before
        this range. The line is a {MINUTES_AVERAGE_DAYS}-day average.
      </p>
    </section>
  )
}
