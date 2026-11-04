import { useMemo, useRef, useState } from 'react'
import { addDays, monthGrid, monthStart, todayLocal, weekStart, type ISODate } from './dates'
import { checksBetween, setMark, setMinutes, type Habit, type HabitCheck } from './db/habits'
import { errorMessage } from './errors'
import { useAsync } from './useAsync'

/**
 * A habit's entry for a day: null = nothing logged. `done` is false for a day
 * marked missed (✗); `minutes` is null except for minutes habits.
 */
export type DayEntry = { minutes: number | null; done: boolean } | null

const entryKey = (habitId: string, date: ISODate) => `${habitId}|${date}`

/**
 * State behind the Stretch and Habits forms: the selected day, the visible month,
 * that month's entries, and instant saves. A change shows at once; if saving fails
 * it is undone and `saveError` says why. Saves for one habit-day run in order,
 * so a quick check-uncheck lands correctly.
 */
export function useHabitDays(
  list: readonly Habit[],
  /** Older entries (e.g. all history, for streaks); the visible month's fresh load wins. */
  history: readonly HabitCheck[] = [],
) {
  const today = todayLocal()
  const [selected, setSelected] = useState<ISODate>(today)
  const [month, setMonth] = useState<ISODate>(monthStart(today))

  const weeks = monthGrid(month)
  const selectedWeek = weekStart(selected)
  // The visible grid plus the selected day's week (it may be in another month).
  const gridFrom = weeks[0]?.[0] ?? month
  const gridTo = weeks.at(-1)?.[6] ?? month
  const weekEnd = addDays(selectedWeek, 6)
  const from = selectedWeek < gridFrom ? selectedWeek : gridFrom
  const to = weekEnd > gridTo ? weekEnd : gridTo

  const ids = list.map((h) => h.id)
  const checksKey = `checks:${ids.join(',')}:${from}..${to}`
  const checks = useAsync(checksKey, () => checksBetween(ids, from, to))
  // While another month loads, the previous month's data is still around: ignore it.
  const fresh = checks.dataKey === checksKey ? checks.data : undefined

  const [overrides, setOverrides] = useState<ReadonlyMap<string, DayEntry>>(new Map())
  const [saveError, setSaveError] = useState<string | null>(null)
  const queue = useRef(new Map<string, Promise<void>>())

  const loaded = useMemo(() => {
    const map = new Map<string, DayEntry>()
    for (const c of history) map.set(entryKey(c.habitId, c.date), { minutes: c.minutes, done: c.done })
    if (fresh) {
      // The window's load is the truth for its days, including days since cleared.
      for (let d = from; d <= to; d = addDays(d, 1)) for (const id of ids) map.delete(entryKey(id, d))
      for (const c of fresh) map.set(entryKey(c.habitId, c.date), { minutes: c.minutes, done: c.done })
    }
    return map
    // ids/from/to are part of checksKey, so `fresh` changes whenever they do.
  }, [fresh, history]) // eslint-disable-line react-hooks/exhaustive-deps

  function entry(habitId: string, date: ISODate): DayEntry {
    const k = entryKey(habitId, date)
    return overrides.has(k) ? (overrides.get(k) ?? null) : (loaded.get(k) ?? null)
  }

  function save(habitId: string, date: ISODate, next: DayEntry, write: () => Promise<void>) {
    if (date > today) return
    const k = entryKey(habitId, date)
    const previous = entry(habitId, date)
    setSaveError(null)
    setOverrides((prev) => new Map(prev).set(k, next))
    const chained = (queue.current.get(k) ?? Promise.resolve()).then(() =>
      write().catch((err: unknown) => {
        setOverrides((prev) => new Map(prev).set(k, previous))
        setSaveError(errorMessage(err))
      }),
    )
    queue.current.set(k, chained)
  }

  return {
    today,
    selected,
    setSelected,
    month,
    setMonth,
    goToToday: () => {
      setSelected(today)
      setMonth(monthStart(today))
    },
    loading: checks.loading,
    loadError: checks.error,
    saveError,
    entry,
    isDone: (habitId: string, date: ISODate) => entry(habitId, date)?.done === true,
    isMissed: (habitId: string, date: ISODate) => entry(habitId, date)?.done === false,
    /** Check off a check habit, or undo it. */
    toggle: (habit: Habit, date: ISODate) => {
      const done = entry(habit.id, date)?.done !== true
      save(habit.id, date, done ? { minutes: null, done: true } : null, () => setMark(habit.id, date, done ? 'done' : null))
    },
    /** Mark a ✓ / ✗ habit done or missed, or clear the day with null. */
    setDayMark: (habit: Habit, date: ISODate, mark: 'done' | 'missed' | null) => {
      save(habit.id, date, mark === null ? null : { minutes: null, done: mark === 'done' }, () =>
        setMark(habit.id, date, mark),
      )
    },
    /** Record minutes for a minutes habit, or clear the day with null. */
    setDayMinutes: (habit: Habit, date: ISODate, minutes: number | null) => {
      save(habit.id, date, minutes === null ? null : { minutes, done: true }, () => setMinutes(habit.id, date, minutes))
    },
  }
}
