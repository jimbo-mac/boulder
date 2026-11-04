import { useState } from 'react'
import { chipClass } from '../components/ui'
import { LiftingProgress } from './LiftingProgress'
import { RunningProgress } from './RunningProgress'
import { StretchingProgress } from './StretchingProgress'

const TABS = [
  { value: 'running', label: 'Running' },
  { value: 'lifting', label: 'Lifting' },
  { value: 'stretching', label: 'Stretching' },
] as const
type Tab = (typeof TABS)[number]['value']

export function Progress() {
  const [tab, setTab] = useState<Tab>('running')

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2 md:max-w-md" role="group" aria-label="Progress type">
        {TABS.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={tab === option.value}
            onClick={() => setTab(option.value)}
            className={chipClass(tab === option.value, 'compact')}
          >
            {option.label}
          </button>
        ))}
      </div>
      {tab === 'running' && <RunningProgress />}
      {tab === 'lifting' && <LiftingProgress />}
      {tab === 'stretching' && <StretchingProgress />}
    </div>
  )
}
