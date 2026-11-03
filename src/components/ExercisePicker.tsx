import { useState } from 'react'
import { createExercise } from '../lib/db/lifts'
import { CATEGORIES, normalizeName, pickerOptions, type Category, type Exercise } from '../lib/exercises'
import { errorMessage, inputClass } from './ui'

const optionClass =
  'flex h-12 w-full items-center justify-between rounded-lg px-3 text-left text-base active:bg-stone-800'

/** Type-ahead exercise search with suggestions and "create new". */
export function ExercisePicker({
  catalog,
  loading,
  loadError,
  onPick,
  onCancel,
}: {
  catalog: Exercise[]
  loading: boolean
  loadError: string | null
  onPick: (exercise: Exercise, isNew: boolean) => void
  onCancel: () => void
}) {
  const [query, setQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = pickerOptions(catalog, query)

  async function create(name: string, category: Category) {
    setBusy(true)
    setError(null)
    try {
      onPick(await createExercise(name, category), true)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  return (
    <section className="flex flex-col gap-2 rounded-xl border border-stone-700 bg-stone-900 p-3">
      <div className="flex gap-2">
        <input
          type="search"
          aria-label="Search exercises"
          placeholder="Search or add exercise"
          autoFocus
          autoComplete="off"
          enterKeyHint="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className={inputClass}
        />
        <button type="button" onClick={onCancel} className="h-12 px-2 text-sm text-stone-400">
          Cancel
        </button>
      </div>

      {loading && <p className="px-3 py-2 text-sm text-stone-400">Loading exercises…</p>}
      {loadError && <p className="px-3 py-2 text-sm text-red-300">Couldn&apos;t load exercises: {loadError}</p>}

      <ul className="flex max-h-80 flex-col overflow-y-auto">
        {options.matches.map((exercise) => (
          <li key={exercise.id}>
            <button type="button" disabled={busy} onClick={() => onPick(exercise, false)} className={optionClass}>
              {exercise.name}
            </button>
          </li>
        ))}
        {options.suggestions.map((suggestion) => (
          <li key={suggestion.name}>
            <button
              type="button"
              disabled={busy}
              onClick={() => void create(suggestion.name, suggestion.category)}
              className={`${optionClass} text-stone-300`}
            >
              {suggestion.name}
              <span className="text-xs text-stone-500">suggested</span>
            </button>
          </li>
        ))}
      </ul>

      {options.canCreate && (
        <div className="flex flex-col gap-2 border-t border-stone-800 pt-3">
          <p className="px-1 text-sm text-stone-300">
            Create <span className="font-semibold">“{normalizeName(query)}”</span> as:
          </p>
          <div className="grid grid-cols-3 gap-2">
            {CATEGORIES.map((category) => (
              <button
                key={category.value}
                type="button"
                disabled={busy}
                onClick={() => void create(query, category.value)}
                className="h-11 rounded-lg border border-stone-700 text-sm text-stone-200 active:bg-stone-800"
              >
                {category.label}
              </button>
            ))}
          </div>
        </div>
      )}

      {error && (
        <p role="alert" className="px-1 text-sm text-red-300">
          {error}
        </p>
      )}
    </section>
  )
}
