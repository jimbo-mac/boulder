import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { deleteWorkout, getWorkout } from '../lib/db/history'
import { listExercises, updateLift } from '../lib/db/lifts'
import { updateRun } from '../lib/db/runs'
import { DRAFT_STORAGE_KEY } from '../lib/liftDraft'
import { EditWorkout } from './EditWorkout'

vi.mock('../lib/db/history', () => ({ getWorkout: vi.fn(), deleteWorkout: vi.fn() }))
vi.mock('../lib/db/runs', () => ({ logRun: vi.fn(), updateRun: vi.fn() }))
vi.mock('../lib/db/lifts', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
  logLift: vi.fn(),
  updateLift: vi.fn(),
}))
const mockGet = vi.mocked(getWorkout)
const mockDelete = vi.mocked(deleteWorkout)
const mockUpdateRun = vi.mocked(updateRun)
const mockUpdateLift = vi.mocked(updateLift)
const mockList = vi.mocked(listExercises)

const squat = { id: 'ex-squat', name: 'Back Squat', category: 'squat' as const, tracking: 'weight' as const }

describe('EditWorkout', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 18, 0))
    window.localStorage.clear()
    window.location.hash = '#/history/w1'
    mockGet.mockReset()
    mockDelete.mockReset().mockResolvedValue()
    mockUpdateRun.mockReset().mockResolvedValue()
    mockUpdateLift.mockReset().mockResolvedValue()
    mockList.mockReset().mockResolvedValue([squat])
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    window.localStorage.clear()
  })

  it('edits a run and goes back to History', async () => {
    mockGet.mockResolvedValue({
      type: 'run',
      workoutId: 'w1',
      run: { date: '2026-11-02', distanceMi: 5, durationS: 2730, kind: 'base' },
    })
    render(<EditWorkout workoutId="w1" />)

    expect(await screen.findByLabelText('Distance (mi)')).toHaveValue('5')
    expect(screen.getByLabelText('Time')).toHaveValue('45:30')
    expect(screen.getByRole('button', { name: 'Base' })).toHaveAttribute('aria-pressed', 'true')

    fireEvent.change(screen.getByLabelText('Distance (mi)'), { target: { value: '5.5' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(window.location.hash).toBe('#/history'))
    expect(mockUpdateRun).toHaveBeenCalledWith('w1', {
      date: '2026-11-02',
      distanceMi: 5.5,
      durationS: 2730,
      kind: 'base',
    })
  })

  it('edits a lift: add a forgotten set, without touching the in-progress draft', async () => {
    const inProgress = JSON.stringify({ date: '2026-11-04', blocks: [] })
    window.localStorage.setItem(DRAFT_STORAGE_KEY, inProgress)
    mockGet.mockResolvedValue({
      type: 'lift',
      workoutId: 'w1',
      date: '2026-11-03',
      sets: [{ exerciseId: 'ex-squat', exerciseName: 'Back Squat', weightLb: 185, reps: 5, isWarmup: false }],
    })
    render(<EditWorkout workoutId="w1" />)

    expect(await screen.findByLabelText('Back Squat set 1 weight (lb)')).toHaveValue('185')
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last set' }))
    fireEvent.change(screen.getByLabelText('Back Squat set 2 reps'), { target: { value: '4' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(window.location.hash).toBe('#/history'))
    expect(mockUpdateLift).toHaveBeenCalledWith('w1', '2026-11-03', [
      { exerciseId: 'ex-squat', weightLb: 185, reps: 5, isWarmup: false },
      { exerciseId: 'ex-squat', weightLb: 185, reps: 4, isWarmup: false },
    ])
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBe(inProgress)
    expect(screen.queryByRole('button', { name: 'Discard workout' })).not.toBeInTheDocument()
  })

  it('deletes only after confirming', async () => {
    mockGet.mockResolvedValue({
      type: 'run',
      workoutId: 'w1',
      run: { date: '2026-11-02', distanceMi: 5, durationS: 2730, kind: 'base' },
    })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<EditWorkout workoutId="w1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete workout' }))
    expect(mockDelete).not.toHaveBeenCalled()

    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Delete workout' }))
    await waitFor(() => expect(window.location.hash).toBe('#/history'))
    expect(mockDelete).toHaveBeenCalledWith('w1')
  })

  it('shows an error and stays put if delete fails', async () => {
    mockGet.mockResolvedValue({
      type: 'run',
      workoutId: 'w1',
      run: { date: '2026-11-02', distanceMi: 5, durationS: 2730, kind: 'base' },
    })
    mockDelete.mockRejectedValue(new Error('offline'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    render(<EditWorkout workoutId="w1" />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete workout' }))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't delete: offline")
    expect(window.location.hash).toBe('#/history/w1')
  })

  it('says so when the workout is gone', async () => {
    mockGet.mockResolvedValue(null)
    render(<EditWorkout workoutId="w1" />)
    expect(await screen.findByText(/doesn.t exist anymore/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Delete workout' })).not.toBeInTheDocument()
  })
})
