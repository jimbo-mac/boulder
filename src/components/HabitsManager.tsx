import { useState, type FormEvent } from 'react'
import { archiveHabit, createHabit, listHabits, renameHabit, setHabitTracking, type Habit } from '../lib/db/habits'
import { useAsync } from '../lib/useAsync'
import { errorMessage, inputClass, linkButtonClass } from './ui'

const smallButton =
  'h-11 shrink-0 rounded-lg border border-stone-700 px-3 text-sm text-stone-200 active:bg-stone-800 disabled:opacity-40'

/** Settings: add, rename, and archive the check-off habits on Log > Habits. */
export function HabitsManager() {
  const loaded = useAsync('habits:habit', () => listHabits('habit'))
  // Local copy so changes show right away.
  const [edited, setEdited] = useState<Habit[] | null>(null)
  const [newName, setNewName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (loaded.error) return <p className="text-sm text-red-300">Couldn&apos;t load habits: {loaded.error}</p>
  if (loaded.data === undefined) return <p className="text-stone-400">Loading…</p>

  // Screen time is built in; only check-off habits are managed here.
  const habits = (edited ?? loaded.data).filter((h) => h.tracking !== 'minutes')
  const all = edited ?? loaded.data

  async function run(action: () => Promise<Habit[]>) {
    setBusy(true)
    setError(null)
    try {
      setEdited(await action())
      return true
    } catch (err) {
      setError(errorMessage(err))
      return false
    } finally {
      setBusy(false)
    }
  }

  async function onAdd(e: FormEvent) {
    e.preventDefault()
    const name = newName.trim()
    if (!name) return
    const ok = await run(async () => [...all, await createHabit(name)])
    if (ok) setNewName('')
  }

  return (
    <div className="flex flex-col gap-3">
      {habits.length === 0 && <p className="text-sm text-stone-400">No habits yet. Add one below.</p>}
      <ul className="flex flex-col gap-2">
        {habits.map((habit) => (
          <HabitRow
            key={habit.id}
            habit={habit}
            busy={busy}
            onRename={(name) =>
              run(async () => {
                await renameHabit(habit.id, name)
                return all.map((h) => (h.id === habit.id ? { ...h, name: name.trim() } : h))
              })
            }
            onTracking={(tracking) =>
              void run(async () => {
                await setHabitTracking(habit.id, tracking)
                return all.map((h) => (h.id === habit.id ? { ...h, tracking } : h))
              })
            }
            onArchive={() => {
              if (!window.confirm(`Remove "${habit.name}"? It disappears from Log and Progress; its history is kept.`)) {
                return
              }
              void run(async () => {
                await archiveHabit(habit.id)
                return all.filter((h) => h.id !== habit.id)
              })
            }}
          />
        ))}
      </ul>

      <form onSubmit={(e) => void onAdd(e)} className="flex gap-2">
        <label htmlFor="new-habit" className="sr-only">
          New habit
        </label>
        <input
          id="new-habit"
          type="text"
          autoComplete="off"
          placeholder="e.g. Read 20 minutes"
          maxLength={60}
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className={inputClass}
        />
        <button type="submit" disabled={busy || newName.trim() === ''} className={smallButton}>
          Add
        </button>
      </form>

      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}

function HabitRow({
  habit,
  busy,
  onRename,
  onTracking,
  onArchive,
}: {
  habit: Habit
  busy: boolean
  onRename: (name: string) => Promise<boolean>
  onTracking: (tracking: 'check' | 'yesno') => void
  onArchive: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(habit.name)

  if (editing) {
    return (
      <li>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            void onRename(name).then((ok) => ok && setEditing(false))
          }}
        >
          <label htmlFor={`rename-${habit.id}`} className="sr-only">
            New name for {habit.name}
          </label>
          <input
            id={`rename-${habit.id}`}
            type="text"
            autoComplete="off"
            maxLength={60}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
          <button type="submit" disabled={busy || name.trim() === ''} className={smallButton}>
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setName(habit.name)
              setEditing(false)
            }}
            className={linkButtonClass}
          >
            Cancel
          </button>
        </form>
      </li>
    )
  }

  return (
    <li className="flex flex-col gap-1">
      <div className="flex items-center justify-between gap-2">
        <span className="min-w-0 truncate font-medium">{habit.name}</span>
        <span className="flex shrink-0 gap-2">
          <button
            type="button"
            aria-label={`Rename ${habit.name}`}
            onClick={() => setEditing(true)}
            disabled={busy}
            className={smallButton}
          >
            Rename
          </button>
          <button
            type="button"
            aria-label={`Remove ${habit.name}`}
            onClick={onArchive}
            disabled={busy}
            className={smallButton}
          >
            Remove
          </button>
        </span>
      </div>
      <label className="flex min-h-11 items-center gap-2 text-sm text-stone-400">
        <input
          type="checkbox"
          checked={habit.tracking === 'yesno'}
          disabled={busy}
          onChange={(e) => onTracking(e.target.checked ? 'yesno' : 'check')}
          className="h-5 w-5 accent-stone-100"
        />
        Log with ✓ / ✗ (record misses)
      </label>
    </li>
  )
}
