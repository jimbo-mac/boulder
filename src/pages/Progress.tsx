import { useState } from 'react'
import { chipClass } from '../components/ui'
import { LiftingProgress } from './LiftingProgress'
import { RunningProgress } from './RunningProgress'

type Tab = 'running' | 'lifting'

export function Progress() {
  const [tab, setTab] = useState<Tab>('running')

  return (
    <div className="flex flex-col gap-5">
      <div className="grid max-w-xs grid-cols-2 gap-2" role="group" aria-label="Progress type">
        <button
          type="button"
          aria-pressed={tab === 'running'}
          onClick={() => setTab('running')}
          className={chipClass(tab === 'running')}
        >
          Running
        </button>
        <button
          type="button"
          aria-pressed={tab === 'lifting'}
          onClick={() => setTab('lifting')}
          className={chipClass(tab === 'lifting')}
        >
          Lifting
        </button>
      </div>
      {tab === 'running' ? <RunningProgress /> : <LiftingProgress />}
    </div>
  )
}
