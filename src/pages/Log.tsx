import { useState } from 'react'
import { chipClass } from '../components/ui'
import { loadDraft } from '../lib/liftDraft'
import { HabitsForm } from './HabitsForm'
import { LiftForm } from './LiftForm'
import { RunForm } from './RunForm'
import { StretchForm } from './StretchForm'

const MODES = [
  { value: 'run', label: 'Run' },
  { value: 'lift', label: 'Lift' },
  { value: 'stretch', label: 'Stretch' },
  { value: 'habits', label: 'Habits' },
] as const
type Mode = (typeof MODES)[number]['value']

export function Log() {
  // Reopen on Lift if a lift workout is in progress.
  const [mode, setMode] = useState<Mode>(() => (loadDraft() ? 'lift' : 'run'))

  return (
    <div className="mx-auto flex max-w-md flex-col gap-6">
      <div className="grid grid-cols-4 gap-2" role="group" aria-label="Workout type">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            onClick={() => setMode(option.value)}
            className={chipClass(mode === option.value, 'compact')}
          >
            {option.label}
          </button>
        ))}
      </div>
      {mode === 'run' && <RunForm />}
      {mode === 'lift' && <LiftForm />}
      {mode === 'stretch' && <StretchForm />}
      {mode === 'habits' && <HabitsForm />}
    </div>
  )
}
