import { useEffect, useState } from 'react'
import { ExercisePicker } from '../components/ExercisePicker'
import {
  errorMessage,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { todayLocal } from '../lib/dates'
import { listExercises, logLift } from '../lib/db/lifts'
import type { Exercise } from '../lib/exercises'
import {
  addBlankSet,
  addExercise,
  checkDraft,
  emptyDraft,
  loadDraft,
  removeExercise,
  removeSet,
  repeatLastSet,
  setDate,
  storeDraft,
  updateSet,
  type DraftBlock,
  type LiftDraft,
} from '../lib/liftDraft'
import { useAsync } from '../lib/useAsync'

const smallInput =
  'h-12 w-full min-w-0 rounded-lg border border-stone-700 bg-stone-900 px-2 text-center text-lg tabular-nums text-stone-100 placeholder:text-stone-600 focus:border-stone-400 focus:outline-none'

export function LiftForm() {
  const today = todayLocal()
  const [draft, setDraft] = useState<LiftDraft>(() => loadDraft() ?? emptyDraft(today))
  const catalog = useAsync('exercises', listExercises)
  const [created, setCreated] = useState<Exercise[]>([])
  const [picking, setPicking] = useState(false)
  const [problems, setProblems] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [saved, setSaved] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Keep the in-progress workout on the device after every change.
  useEffect(() => storeDraft(draft), [draft])

  const exercises = [...(catalog.data ?? []), ...created.filter((c) => !catalog.data?.some((e) => e.id === c.id))]

  function edit(fn: (d: LiftDraft) => LiftDraft) {
    setDraft(fn)
    setSaved(null)
    setError(null)
    setProblems([])
  }

  function onPick(exercise: Exercise, isNew: boolean) {
    if (isNew) setCreated((list) => [...list, exercise])
    edit((d) => addExercise(d, exercise))
    setPicking(false)
  }

  async function onSave() {
    const check = checkDraft(draft, today)
    if (!check.ok) {
      setProblems(check.problems)
      return
    }
    setBusy(true)
    setError(null)
    try {
      await logLift(draft.date, check.sets)
      const exerciseWord = check.exerciseCount === 1 ? 'exercise' : 'exercises'
      const setWord = check.sets.length === 1 ? 'set' : 'sets'
      setSaved(`Saved: ${check.exerciseCount} ${exerciseWord} · ${check.sets.length} ${setWord}`)
      setDraft(emptyDraft(draft.date))
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function onDiscard() {
    if (window.confirm('Discard this workout? Its sets will be deleted.')) {
      edit((d) => emptyDraft(d.date))
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <label htmlFor="lift-date" className={labelClass}>
          Date
        </label>
        <input
          id="lift-date"
          type="date"
          max={today}
          value={draft.date}
          onChange={(e) => {
            const date = e.target.value
            edit((d) => setDate(d, date))
          }}
          className={inputClass}
        />
      </div>

      {draft.blocks.map((block) => (
        <ExerciseBlock
          key={block.id}
          block={block}
          onChange={(fn) => edit(fn)}
        />
      ))}

      {picking ? (
        <ExercisePicker
          catalog={exercises}
          loading={catalog.data === undefined && !catalog.error}
          loadError={catalog.error}
          onPick={onPick}
          onCancel={() => setPicking(false)}
        />
      ) : (
        <button type="button" onClick={() => setPicking(true)} className={secondaryButtonClass}>
          + Add exercise
        </button>
      )}

      {problems.length > 0 && (
        <ul role="alert" className="flex flex-col gap-1 rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          {problems.map((problem) => (
            <li key={problem}>{problem}</li>
          ))}
        </ul>
      )}

      {draft.blocks.length > 0 && (
        <>
          <button type="button" onClick={() => void onSave()} disabled={busy} className={primaryButtonClass}>
            {busy ? 'Saving…' : 'Save workout'}
          </button>
          <button type="button" onClick={onDiscard} disabled={busy} className={`${linkButtonClass} self-center`}>
            Discard workout
          </button>
        </>
      )}

      {saved && (
        <p role="status" className="rounded-lg bg-emerald-950 px-4 py-3 text-sm text-emerald-200">
          {saved}
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t save: {error}. Your sets are still here.
        </p>
      )}
    </div>
  )
}

function ExerciseBlock({
  block,
  onChange,
}: {
  block: DraftBlock
  onChange: (fn: (d: LiftDraft) => LiftDraft) => void
}) {
  return (
    <section className="flex flex-col gap-3 rounded-xl border border-stone-800 bg-stone-900 p-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">{block.exerciseName}</h2>
        <button
          type="button"
          onClick={() => onChange((d) => removeExercise(d, block.id))}
          className="h-10 px-2 text-sm text-stone-400"
          aria-label={`Remove ${block.exerciseName}`}
        >
          Remove
        </button>
      </div>

      {block.sets.length > 0 && (
        <div className="grid grid-cols-[1.5rem_1fr_1rem_1fr_2.75rem_2.75rem] items-center gap-x-2 gap-y-2">
          <span />
          <span className="text-center text-xs text-stone-500">lb</span>
          <span />
          <span className="text-center text-xs text-stone-500">reps</span>
          <span className="text-center text-xs text-stone-500">warm-up</span>
          <span />
          {block.sets.map((set, i) => {
            const label = `${block.exerciseName} set ${i + 1}`
            return (
              <div key={set.id} className="contents">
                <span className="text-sm text-stone-500 tabular-nums">{i + 1}</span>
                <input
                  aria-label={`${label} weight (lb)`}
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={set.weight}
                  onChange={(e) => {
                    const weight = e.target.value
                    onChange((d) => updateSet(d, block.id, set.id, { weight }))
                  }}
                  className={smallInput}
                />
                <span className="text-center text-stone-500">×</span>
                <input
                  aria-label={`${label} reps`}
                  type="text"
                  inputMode="numeric"
                  autoComplete="off"
                  placeholder="0"
                  value={set.reps}
                  onChange={(e) => {
                    const reps = e.target.value.replace(/\D/g, '')
                    onChange((d) => updateSet(d, block.id, set.id, { reps }))
                  }}
                  className={smallInput}
                />
                <button
                  type="button"
                  aria-label={`${label} warm-up`}
                  aria-pressed={set.warmup}
                  onClick={() => onChange((d) => updateSet(d, block.id, set.id, { warmup: !set.warmup }))}
                  className={`h-11 rounded-lg text-sm font-semibold ${
                    set.warmup ? 'bg-amber-200 text-stone-950' : 'border border-stone-700 text-stone-500'
                  }`}
                >
                  W
                </button>
                <button
                  type="button"
                  aria-label={`Delete ${label}`}
                  onClick={() => onChange((d) => removeSet(d, block.id, set.id))}
                  className="h-11 rounded-lg text-xl text-stone-500 active:bg-stone-800"
                >
                  ×
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange((d) => repeatLastSet(d, block.id))}
          className="h-11 rounded-lg bg-stone-800 text-sm font-medium text-stone-100 active:bg-stone-700"
        >
          Repeat last set
        </button>
        <button
          type="button"
          onClick={() => onChange((d) => addBlankSet(d, block.id))}
          className="h-11 rounded-lg border border-stone-700 text-sm font-medium text-stone-300 active:bg-stone-800"
        >
          + Empty set
        </button>
      </div>
    </section>
  )
}
