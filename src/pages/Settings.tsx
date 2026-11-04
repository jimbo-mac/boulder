import { HabitsManager } from '../components/HabitsManager'
import { StretchGoals } from '../components/StretchGoals'
import { useState, type FormEvent } from 'react'
import {
  cardClass,
  chipClass,
  errorMessage,
  inputClass,
  labelClass,
  linkButtonClass,
  primaryButtonClass,
  secondaryButtonClass,
} from '../components/ui'
import { isValidISODate } from '../lib/dates'
import { signOut } from '../lib/db/auth'
import { EMPTY_SETTINGS, getSettings, saveSettings, type Settings as SettingsData } from '../lib/db/settings'
import {
  cleanDurationDigits,
  durationDigitsToSeconds,
  formatDurationDigits,
  formatPace,
  parseDistance,
  secondsToDurationDigits,
} from '../lib/format'
import { goalPace } from '../lib/metrics'
import { presetForDistance, RACE_DISTANCES, type RacePreset } from '../lib/races'
import { useAsync } from '../lib/useAsync'

export function Settings({ email }: { email: string }) {
  const settings = useAsync('settings', getSettings)
  const [signOutError, setSignOutError] = useState<string | null>(null)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>

      <section className={cardClass}>
        <h2 className="mb-4 font-semibold">Goal race</h2>
        {settings.error && (
          <p role="alert" className="text-sm text-red-300">
            Couldn&apos;t load settings: {settings.error}
          </p>
        )}
        {settings.data === undefined && !settings.error && <p className="text-stone-400">Loading…</p>}
        {settings.data && <GoalForm initial={settings.data} />}
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 font-semibold">Habits</h2>
        <p className="mb-4 text-sm text-stone-400">Daily check-offs on Log &gt; Habits. Screen time is built in.</p>
        <HabitsManager />
      </section>

      <section className={cardClass}>
        <h2 className="mb-1 font-semibold">Weekly stretching goals</h2>
        <p className="mb-4 text-sm text-stone-400">Days per week for each routine.</p>
        <StretchGoals />
      </section>

      <section className={cardClass}>
        <p className="text-sm text-stone-400">Signed in as</p>
        <p className="font-medium break-all">{email}</p>
      </section>
      <button
        type="button"
        onClick={() => signOut().catch((err: unknown) => setSignOutError(errorMessage(err)))}
        className={secondaryButtonClass}
      >
        Sign out
      </button>
      {signOutError && (
        <p role="alert" className="text-sm text-red-300">
          {signOutError}
        </p>
      )}
    </div>
  )
}

type DistanceChoice = RacePreset | 'custom' | null

function GoalForm({ initial }: { initial: SettingsData }) {
  const initialPreset = presetForDistance(initial.goalDistanceMi)
  const [name, setName] = useState(initial.goalRaceName ?? '')
  const [date, setDate] = useState(initial.goalRaceDate ?? '')
  const [choice, setChoice] = useState<DistanceChoice>(
    initialPreset ?? (initial.goalDistanceMi === null ? null : 'custom'),
  )
  const [custom, setCustom] = useState(
    initialPreset === null && initial.goalDistanceMi !== null ? String(initial.goalDistanceMi) : '',
  )
  const [timeDigits, setTimeDigits] = useState(
    initial.goalTimeS === null ? '' : secondsToDurationDigits(initial.goalTimeS),
  )
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState<{ kind: 'saved' | 'error'; text: string } | null>(null)

  const distanceMi =
    choice === null
      ? null
      : choice === 'custom'
        ? parseDistance(custom)
        : (RACE_DISTANCES.find((race) => race.value === choice)?.miles ?? null)
  const timeS = durationDigitsToSeconds(timeDigits)

  const problems: string[] = []
  if (date !== '' && !isValidISODate(date)) problems.push('Pick a valid race date.')
  if (choice === 'custom' && custom !== '' && distanceMi === null) {
    problems.push('Custom distance must be a number of miles, like 8 or 8.5.')
  }
  if (timeDigits !== '' && timeS === null) problems.push('Goal time: minutes and seconds must be under 60.')
  if ((distanceMi === null) !== (timeS === null) && problems.length === 0) {
    problems.push('Set both a distance and a goal time.')
  }
  const canSave = problems.length === 0 && !busy

  async function save(next: SettingsData, message: string) {
    setBusy(true)
    setStatus(null)
    try {
      await saveSettings(next)
      setStatus({ kind: 'saved', text: message })
    } catch (err) {
      setStatus({ kind: 'error', text: `Couldn't save: ${errorMessage(err)}` })
    } finally {
      setBusy(false)
    }
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSave) return
    void save(
      {
        goalRaceName: name.trim() === '' ? null : name.trim(),
        goalRaceDate: date === '' ? null : date,
        goalDistanceMi: distanceMi,
        goalTimeS: timeS,
      },
      'Goal saved.',
    )
  }

  function clearGoal() {
    setName('')
    setDate('')
    setChoice(null)
    setCustom('')
    setTimeDigits('')
    void save(EMPTY_SETTINGS, 'Goal cleared.')
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      <div className="flex flex-col gap-2">
        <label htmlFor="goal-name" className={labelClass}>
          Race name <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <input
          id="goal-name"
          type="text"
          maxLength={60}
          placeholder="Spring Half"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className={inputClass}
        />
      </div>

      <div className="flex flex-col gap-2">
        <label htmlFor="goal-date" className={labelClass}>
          Race date <span className="font-normal text-stone-500">(optional)</span>
        </label>
        <input
          id="goal-date"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className={inputClass}
        />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={`${labelClass} mb-2`}>Distance</legend>
        <div className="grid grid-cols-3 gap-2 md:grid-cols-5">
          {RACE_DISTANCES.map((race) => (
            <button
              key={race.value}
              type="button"
              aria-pressed={choice === race.value}
              onClick={() => setChoice(choice === race.value ? null : race.value)}
              className={chipClass(choice === race.value, 'compact')}
            >
              {race.label}
            </button>
          ))}
          <button
            type="button"
            aria-pressed={choice === 'custom'}
            onClick={() => setChoice(choice === 'custom' ? null : 'custom')}
            className={chipClass(choice === 'custom', 'compact')}
          >
            Other
          </button>
        </div>
        {choice === 'custom' && (
          <input
            aria-label="Custom distance (mi)"
            type="text"
            inputMode="decimal"
            placeholder="Miles"
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className={inputClass}
          />
        )}
      </fieldset>

      <div className="flex flex-col gap-2">
        <label htmlFor="goal-time" className={labelClass}>
          Goal time
        </label>
        <input
          id="goal-time"
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder="1:45:00"
          value={formatDurationDigits(timeDigits)}
          onChange={(e) => setTimeDigits(cleanDurationDigits(e.target.value))}
          className={`${inputClass} text-lg tabular-nums`}
        />
        {distanceMi !== null && timeS !== null && (
          <p className="text-sm text-stone-400">
            Goal pace{' '}
            <span className="font-semibold text-stone-100 tabular-nums">
              {formatPace(goalPace(timeS, distanceMi))} /mi
            </span>
          </p>
        )}
      </div>

      {problems.map((problem) => (
        <p key={problem} className="text-sm text-red-300">
          {problem}
        </p>
      ))}

      <button type="submit" disabled={!canSave} className={primaryButtonClass}>
        {busy ? 'Saving…' : 'Save goal'}
      </button>
      <button type="button" onClick={clearGoal} disabled={busy} className={`${linkButtonClass} self-center`}>
        Clear goal
      </button>

      {status && (
        <p
          role={status.kind === 'error' ? 'alert' : 'status'}
          className={`rounded-lg px-4 py-3 text-sm ${
            status.kind === 'error' ? 'bg-red-950 text-red-200' : 'bg-emerald-950 text-emerald-200'
          }`}
        >
          {status.text}
        </p>
      )}
    </form>
  )
}
