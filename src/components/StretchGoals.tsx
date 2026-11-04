import { useState } from 'react'
import { listHabits, setWeeklyGoal, type Habit } from '../lib/db/habits'
import { useAsync } from '../lib/useAsync'
import { errorMessage } from './ui'

const stepClass =
  'h-11 w-11 rounded-lg border border-stone-700 text-xl text-stone-200 active:bg-stone-800 disabled:opacity-30'

/** Days-per-week goal for each stretching routine. Saves on every tap. */
export function StretchGoals() {
  const habits = useAsync('habits:stretch', () => listHabits('stretch'))
  const [goals, setGoals] = useState<ReadonlyMap<string, number>>(new Map())
  const [error, setError] = useState<string | null>(null)

  if (habits.error) return <p className="text-sm text-red-300">Couldn&apos;t load routines: {habits.error}</p>
  if (habits.data === undefined) return <p className="text-stone-400">Loading…</p>

  function change(habit: Habit, current: number, delta: number) {
    const next = Math.min(7, Math.max(1, current + delta))
    if (next === current) return
    setError(null)
    setGoals((prev) => new Map(prev).set(habit.id, next))
    setWeeklyGoal(habit.id, next).catch((err: unknown) => {
      setGoals((prev) => new Map(prev).set(habit.id, current))
      setError(errorMessage(err))
    })
  }

  return (
    <div className="flex flex-col gap-3">
      {habits.data.map((habit) => {
        const goal = goals.get(habit.id) ?? habit.weeklyGoal
        return (
          <div key={habit.id} className="flex items-center justify-between gap-3">
            <span className="font-medium">{habit.name}</span>
            <div className="flex items-center gap-3">
              <button
                type="button"
                aria-label={`Lower ${habit.name} goal`}
                disabled={goal <= 1}
                onClick={() => change(habit, goal, -1)}
                className={stepClass}
              >
                −
              </button>
              <span className="w-20 text-center tabular-nums" aria-live="polite">
                {goal} / week
              </span>
              <button
                type="button"
                aria-label={`Raise ${habit.name} goal`}
                disabled={goal >= 7}
                onClick={() => change(habit, goal, 1)}
                className={stepClass}
              >
                +
              </button>
            </div>
          </div>
        )
      })}
      {error && (
        <p role="alert" className="text-sm text-red-300">
          Couldn&apos;t save goal: {error}
        </p>
      )}
    </div>
  )
}
