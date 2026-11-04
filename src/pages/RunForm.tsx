import { useState, type FormEvent } from 'react'
import { chipClass, errorMessage, inputClass, labelClass, primaryButtonClass } from '../components/ui'
import { isValidISODate, todayLocal } from '../lib/dates'
import { logRun, updateRun, type NewRun } from '../lib/db/runs'
import {
  cleanDurationDigits,
  durationDigitsToSeconds,
  formatDuration,
  formatDurationDigits,
  formatMiles,
  formatPace,
  parseDistance,
  secondsToDurationDigits,
} from '../lib/format'
import { pace } from '../lib/metrics'
import { editWorkoutHref } from '../lib/router'
import { RUN_KINDS, runKindLabel, type RunKind } from '../lib/runKinds'
import { SavedMessage } from '../components/SavedMessage'

export interface RunFormProps {
  /** Edit a saved run instead of logging a new one. */
  editing?: { workoutId: string; initial: NewRun; onSaved: () => void }
}

export function RunForm({ editing }: RunFormProps) {
  const today = todayLocal()
  const initial = editing?.initial
  const [date, setDate] = useState(initial?.date ?? today)
  const [distance, setDistance] = useState(initial ? String(initial.distanceMi) : '')
  const [durationDigits, setDurationDigits] = useState(initial ? secondsToDurationDigits(initial.durationS) : '')
  const [kind, setKind] = useState<RunKind | null>(initial?.kind ?? null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState<{ text: string; workoutId: string } | null>(null)

  const distanceMi = parseDistance(distance)
  const durationS = durationDigitsToSeconds(durationDigits)
  const dateOk = isValidISODate(date) && date <= today
  const livePace = distanceMi !== null && durationS !== null ? pace(durationS, distanceMi) : null
  const canSave = dateOk && distanceMi !== null && durationS !== null && kind !== null && !busy

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave || distanceMi === null || durationS === null || kind === null) return
    setBusy(true)
    setError(null)
    setSaved(null)
    try {
      const run = { date, distanceMi, durationS, kind }
      if (editing) {
        await updateRun(editing.workoutId, run)
        editing.onSaved()
        return
      }
      const workoutId = await logRun(run)
      setSaved({
        text: `Saved: ${runKindLabel(kind)} · ${formatMiles(distanceMi)} mi · ${formatDuration(durationS)} · ${formatPace(pace(durationS, distanceMi))} /mi`,
        workoutId,
      })
      setDistance('')
      setDurationDigits('')
      setKind(null)
    } catch (err) {
      setError(errorMessage(err))
    } finally {
      setBusy(false)
    }
  }

  function clearStatus() {
    setSaved(null)
    setError(null)
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="run-date" className={labelClass}>
          Date
        </label>
        <input
          id="run-date"
          type="date"
          max={today}
          value={date}
          onChange={(e) => {
            setDate(e.target.value)
            clearStatus()
          }}
          className={inputClass}
        />
        {!dateOk && <p className="text-sm text-red-300">Pick a date that isn&apos;t in the future.</p>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-2">
          <label htmlFor="run-distance" className={labelClass}>
            Distance (mi)
          </label>
          <input
            id="run-distance"
            type="text"
            inputMode="decimal"
            autoComplete="off"
            placeholder="5.00"
            value={distance}
            onChange={(e) => {
              setDistance(e.target.value)
              clearStatus()
            }}
            className={`${inputClass} text-lg tabular-nums`}
          />
        </div>
        <div className="flex flex-col gap-2">
          <label htmlFor="run-duration" className={labelClass}>
            Time
          </label>
          <input
            id="run-duration"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder="45:30"
            value={formatDurationDigits(durationDigits)}
            onChange={(e) => {
              setDurationDigits(cleanDurationDigits(e.target.value))
              clearStatus()
            }}
            className={`${inputClass} text-lg tabular-nums`}
          />
        </div>
      </div>

      {durationDigits !== '' && durationS === null && (
        <p className="-mt-2 text-sm text-red-300">Minutes and seconds must be under 60.</p>
      )}

      <p className="text-center text-stone-400" aria-live="polite">
        Avg pace{' '}
        <span className="text-2xl font-semibold text-stone-100 tabular-nums">
          {livePace === null ? '–:––' : formatPace(livePace)}
        </span>{' '}
        /mi
      </p>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>Type</legend>
        <div className="grid grid-cols-2 gap-2">
          {RUN_KINDS.map((option) => (
            <button
              key={option.value}
              type="button"
              aria-pressed={kind === option.value}
              onClick={() => {
                setKind(option.value)
                clearStatus()
              }}
              className={chipClass(kind === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
      </fieldset>

      <button type="submit" disabled={!canSave} className={primaryButtonClass}>
        {busy ? 'Saving…' : editing ? 'Save changes' : 'Save run'}
      </button>

      {saved && <SavedMessage text={saved.text} editHref={editWorkoutHref(saved.workoutId)} />}
      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t save: {error}
        </p>
      )}
    </form>
  )
}
