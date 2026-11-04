import { useState } from 'react'
import { errorMessage, linkButtonClass } from '../components/ui'
import { deleteWorkout, getWorkout } from '../lib/db/history'
import { draftFromSets } from '../lib/liftDraft'
import { navigate, routeHref } from '../lib/router'
import { useAsync } from '../lib/useAsync'
import { LiftForm } from './LiftForm'
import { RunForm } from './RunForm'

const backToHistory = () => navigate(routeHref('history'))

/** `#/history/<id>`: edit or delete a saved workout in the same form it was logged with. */
export function EditWorkout({ workoutId }: { workoutId: string }) {
  const workout = useAsync(`workout:${workoutId}`, () => getWorkout(workoutId))
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function onDelete() {
    if (!window.confirm('Delete this workout? This can’t be undone.')) return
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteWorkout(workoutId)
      backToHistory()
    } catch (err) {
      setDeleteError(errorMessage(err))
      setDeleting(false)
    }
  }

  const data = workout.data
  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="flex items-center justify-between gap-3">
        <h1 className="text-2xl font-bold tracking-tight">
          Edit {data?.type === 'run' ? 'run' : data?.type === 'lift' ? 'lift' : 'workout'}
        </h1>
        <a href={routeHref('history')} className={linkButtonClass}>
          Cancel
        </a>
      </div>

      {workout.error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          Couldn&apos;t load this workout: {workout.error}
        </p>
      )}
      {workout.loading && <p className="text-stone-400">Loading…</p>}
      {!workout.loading && data === null && (
        <p className="text-stone-400">
          This workout doesn&apos;t exist anymore.{' '}
          <a href={routeHref('history')} className="text-stone-200 underline underline-offset-4">
            Back to History
          </a>
        </p>
      )}

      {data?.type === 'run' && (
        <RunForm editing={{ workoutId, initial: data.run, onSaved: backToHistory }} />
      )}
      {data?.type === 'lift' && (
        <LiftForm
          editing={{ workoutId, initial: draftFromSets(data.date, data.sets), onSaved: backToHistory }}
        />
      )}

      {data && (
        <div className="flex flex-col gap-2 border-t border-stone-800 pt-4">
          <button
            type="button"
            onClick={() => void onDelete()}
            disabled={deleting}
            className="h-12 w-full rounded-lg border border-red-900 text-base text-red-300 active:bg-red-950 disabled:opacity-40"
          >
            {deleting ? 'Deleting…' : 'Delete workout'}
          </button>
          {deleteError && (
            <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
              Couldn&apos;t delete: {deleteError}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
