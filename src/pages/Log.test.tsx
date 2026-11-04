import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { listHabits, checksBetween } from '../lib/db/habits'
import { logRun } from '../lib/db/runs'
import { Log } from './Log'

vi.mock('../lib/db/runs', () => ({ logRun: vi.fn(), updateRun: vi.fn() }))
vi.mock('../lib/db/lifts', () => ({ listExercises: vi.fn(), createExercise: vi.fn(), logLift: vi.fn(), updateLift: vi.fn() }))
vi.mock('../lib/db/habits', () => ({ listHabits: vi.fn(), checksBetween: vi.fn(), setMark: vi.fn() }))
const mockLogRun = vi.mocked(logRun)

function fill({ distance, time }: { distance?: string; time?: string }) {
  if (distance !== undefined) {
    fireEvent.change(screen.getByLabelText('Distance (mi)'), { target: { value: distance } })
  }
  if (time !== undefined) {
    fireEvent.change(screen.getByLabelText('Time'), { target: { value: time } })
  }
}

const saveButton = () => screen.getByRole('button', { name: 'Save run' })

describe('Log run form', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 3, 18, 0)) // Tue Nov 3 2026, local
    mockLogRun.mockReset().mockResolvedValue('workout-id')
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults the date to today (local)', () => {
    render(<Log />)
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-03')
  })

  it('formats the time as you type and shows live pace', () => {
    render(<Log />)
    fill({ distance: '5', time: '4530' })
    expect(screen.getByLabelText('Time')).toHaveValue('45:30')
    expect(screen.getByText('9:06')).toBeInTheDocument()
  })

  it('needs distance, time, and type before saving', () => {
    render(<Log />)
    expect(saveButton()).toBeDisabled()
    fill({ distance: '5', time: '4530' })
    expect(saveButton()).toBeDisabled()
    fireEvent.click(screen.getByRole('button', { name: 'Base' }))
    expect(saveButton()).toBeEnabled()
  })

  it('rejects invalid times', () => {
    render(<Log />)
    fill({ distance: '5', time: '4575' })
    fireEvent.click(screen.getByRole('button', { name: 'Base' }))
    expect(screen.getByText('Minutes and seconds must be under 60.')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('rejects zero distance', () => {
    render(<Log />)
    fill({ distance: '0', time: '4530' })
    fireEvent.click(screen.getByRole('button', { name: 'Base' }))
    expect(saveButton()).toBeDisabled()
  })

  it('rejects future dates', () => {
    render(<Log />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-04' } })
    expect(screen.getByText(/isn.t in the future/)).toBeInTheDocument()
  })

  it('saves in canonical units, confirms, and resets all but the date', async () => {
    render(<Log />)
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-11-01' } })
    fill({ distance: '6.2', time: '10500' })
    fireEvent.click(screen.getByRole('button', { name: 'Long' }))
    fireEvent.click(saveButton())

    expect(await screen.findByRole('status')).toHaveTextContent(
      'Saved: Long · 6.20 mi · 1:05:00 · 10:29 /mi',
    )
    expect(screen.getByRole('link', { name: 'Edit' })).toHaveAttribute('href', '#/history/workout-id')
    expect(mockLogRun).toHaveBeenCalledWith({
      date: '2026-11-01',
      distanceMi: 6.2,
      durationS: 3900,
      kind: 'long',
    })
    expect(screen.getByLabelText('Distance (mi)')).toHaveValue('')
    expect(screen.getByLabelText('Time')).toHaveValue('')
    expect(screen.getByLabelText('Date')).toHaveValue('2026-11-01')
    expect(saveButton()).toBeDisabled()
  })

  it('shows an error and keeps the input if saving fails', async () => {
    mockLogRun.mockRejectedValue(new Error('network down'))
    render(<Log />)
    fill({ distance: '5', time: '4530' })
    fireEvent.click(screen.getByRole('button', { name: 'Recovery' }))
    fireEvent.click(saveButton())
    expect(await screen.findByRole('alert')).toHaveTextContent('network down')
    expect(screen.getByLabelText('Distance (mi)')).toHaveValue('5')
  })
})

describe('Log Stretch option', () => {
  it('sits next to Run, Lift, and Habits and opens the stretching check-offs', async () => {
    vi.mocked(listHabits).mockResolvedValue([{ id: 'p', name: 'Posture', tracking: 'check' as const, weeklyGoal: 3 }])
    vi.mocked(checksBetween).mockResolvedValue([])
    render(<Log />)
    const group = screen.getByRole('group', { name: 'Workout type' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Run', 'Lift', 'Stretch', 'Habits'])
    fireEvent.click(screen.getByRole('button', { name: 'Stretch' }))
    expect(screen.getByRole('button', { name: 'Stretch' })).toHaveAttribute('aria-pressed', 'true')
    expect(await screen.findByRole('button', { name: /^Posture/ })).toBeInTheDocument()
  })
})
