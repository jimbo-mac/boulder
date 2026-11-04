import { useState } from 'react'
import { chipClass } from '../components/ui'
import { loadDraft } from '../lib/liftDraft'
import { LiftForm } from './LiftForm'
import { RunForm } from './RunForm'
export function Log() {
  // Reopen on Lift if a lift workout is in progress.
  const [mode, setMode] = useState<'run' | 'lift'>(() => (loadDraft() ? 'lift' : 'run'))

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Workout type">
        <button
          type="button"
          aria-pressed={mode === 'run'}
          onClick={() => setMode('run')}
          className={chipClass(mode === 'run')}
        >
          Run
        </button>
        <button
          type="button"
          aria-pressed={mode === 'lift'}
          onClick={() => setMode('lift')}
          className={chipClass(mode === 'lift')}
        >
          Lift
        </button>
      </div>
      {mode === 'run' ? <RunForm /> : <LiftForm />}
    </div>
  )
}
