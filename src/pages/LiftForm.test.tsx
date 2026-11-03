import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createExercise, listExercises, logLift } from '../lib/db/lifts'
import { DRAFT_STORAGE_KEY } from '../lib/liftDraft'
import { Log } from './Log'

vi.mock('../lib/db/runs', () => ({ logRun: vi.fn() }))
vi.mock('../lib/db/lifts', () => ({
  listExercises: vi.fn(),
  createExercise: vi.fn(),
  logLift: vi.fn(),
}))
const mockList = vi.mocked(listExercises)
const mockCreate = vi.mocked(createExercise)
const mockLogLift = vi.mocked(logLift)

const squat = { id: 'ex-squat', name: 'Goblet Squat', category: 'squat' as const, tracking: 'weight' as const }
const pullup = { id: 'ex-pu', name: 'Pull-up', category: 'pull' as const, tracking: 'reps' as const }

async function startLiftWithSquat() {
  render(<Log />)
  fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
  fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
  fireEvent.click(await screen.findByRole('button', { name: 'Goblet Squat' }))
}

const weight = (n: number) => screen.getByLabelText(`Goblet Squat set ${n} weight (lb)`)
const reps = (n: number) => screen.getByLabelText(`Goblet Squat set ${n} reps`)

describe('Lift logging', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 18, 0))
    window.localStorage.clear()
    mockList.mockReset().mockResolvedValue([squat, pullup])
    mockCreate.mockReset()
    mockLogLift.mockReset().mockResolvedValue('workout-id')
  })
  afterEach(() => {
    vi.useRealTimers()
    window.localStorage.clear()
  })

  it('logs sets with repeat-last-set and a warm-up, then clears the draft', async () => {
    await startLiftWithSquat()
    fireEvent.change(weight(1), { target: { value: '45' } })
    fireEvent.change(reps(1), { target: { value: '10' } })
    fireEvent.click(screen.getByRole('button', { name: 'Goblet Squat set 1 warm-up' }))
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last set' }))
    fireEvent.click(screen.getByRole('button', { name: 'Goblet Squat set 2 warm-up' })) // un-warm-up
    fireEvent.change(weight(2), { target: { value: '70' } })
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last set' }))
    expect(weight(3)).toHaveValue('70')

    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Saved: 1 exercise · 3 sets')
    expect(mockLogLift).toHaveBeenCalledWith('2026-11-04', [
      { exerciseId: 'ex-squat', weightLb: 45, reps: 10, isWarmup: true },
      { exerciseId: 'ex-squat', weightLb: 70, reps: 10, isWarmup: false },
      { exerciseId: 'ex-squat', weightLb: 70, reps: 10, isWarmup: false },
    ])
    expect(screen.queryByText('Goblet Squat')).not.toBeInTheDocument()
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('keeps the workout on the device and reopens it on Lift', async () => {
    const { unmount } = render(<Log />)
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Goblet Squat' }))
    fireEvent.change(weight(1), { target: { value: '50' } })
    unmount()

    render(<Log />)
    expect(screen.getByRole('button', { name: 'Lift' })).toHaveAttribute('aria-pressed', 'true')
    expect(weight(1)).toHaveValue('50')
  })

  it('reports half-filled sets instead of saving', async () => {
    await startLiftWithSquat()
    fireEvent.change(weight(1), { target: { value: '50' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Goblet Squat, set 1: enter weight')
    expect(mockLogLift).not.toHaveBeenCalled()
  })

  it('keeps the sets if saving fails', async () => {
    mockLogLift.mockRejectedValue(new Error('offline'))
    await startLiftWithSquat()
    fireEvent.change(weight(1), { target: { value: '50' } })
    fireEvent.change(reps(1), { target: { value: '8' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
    expect(weight(1)).toHaveValue('50')
  })

  it('creates a suggested exercise from the picker', async () => {
    mockCreate.mockResolvedValue({ id: 'ex-bench', name: 'Bench Press', category: 'push', tracking: 'weight' })
    render(<Log />)
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    fireEvent.change(await screen.findByLabelText('Search exercises'), { target: { value: 'bench' } })
    fireEvent.click(screen.getByRole('button', { name: /^Bench Press/ }))
    expect(await screen.findByLabelText('Bench Press set 1 weight (lb)')).toBeInTheDocument()
    expect(mockCreate).toHaveBeenCalledWith('Bench Press', 'push', 'weight')
  })

  it('logs a reps-only exercise without a weight box', async () => {
    render(<Log />)
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    fireEvent.click(await screen.findByRole('button', { name: 'Pull-up' }))
    expect(screen.queryByLabelText('Pull-up set 1 weight (lb)')).not.toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Pull-up set 1 reps'), { target: { value: '12' } })
    fireEvent.click(screen.getByRole('button', { name: 'Repeat last set' }))
    fireEvent.change(screen.getByLabelText('Pull-up set 2 reps'), { target: { value: '9' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save workout' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Saved: 1 exercise · 2 sets')
    expect(mockLogLift).toHaveBeenCalledWith('2026-11-04', [
      { exerciseId: 'ex-pu', weightLb: 0, reps: 12, isWarmup: false },
      { exerciseId: 'ex-pu', weightLb: 0, reps: 9, isWarmup: false },
    ])
  })

  it('creates a reps-only exercise', async () => {
    mockCreate.mockResolvedValue({ id: 'ex-dip', name: 'Dips', category: 'push', tracking: 'reps' })
    render(<Log />)
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    fireEvent.change(await screen.findByLabelText('Search exercises'), { target: { value: 'Dips' } })
    fireEvent.click(screen.getByRole('button', { name: 'Reps only' }))
    fireEvent.click(screen.getByRole('button', { name: 'Push' }))
    expect(await screen.findByLabelText('Dips set 1 reps')).toBeInTheDocument()
    expect(screen.queryByLabelText('Dips set 1 weight (lb)')).not.toBeInTheDocument()
    expect(mockCreate).toHaveBeenCalledWith('Dips', 'push', 'reps')
  })

  it('creates a brand-new exercise with a category', async () => {
    mockCreate.mockResolvedValue({ id: 'ex-ht', name: 'Hip Thrust', category: 'hinge', tracking: 'weight' })
    render(<Log />)
    fireEvent.click(screen.getByRole('button', { name: 'Lift' }))
    fireEvent.click(screen.getByRole('button', { name: '+ Add exercise' }))
    fireEvent.change(await screen.findByLabelText('Search exercises'), { target: { value: 'hip thrust' } })
    expect(screen.getByText('“hip thrust”')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Hinge' }))
    expect(await screen.findByLabelText('Hip Thrust set 1 weight (lb)')).toBeInTheDocument()
    expect(mockCreate).toHaveBeenCalledWith('hip thrust', 'hinge', 'weight')
  })
})
