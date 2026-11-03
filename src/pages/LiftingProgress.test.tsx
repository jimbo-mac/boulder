import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatePoint } from '../components/DateLineChart'
import { listExercises, setsForExercise } from '../lib/db/lifts'
import { LiftingProgress } from './LiftingProgress'

vi.mock('../lib/db/lifts', () => ({ listExercises: vi.fn(), setsForExercise: vi.fn() }))
vi.mock('../components/DateLineChart', () => ({
  DateLineChart: ({ points }: { points: DatePoint[] }) => (
    <p data-testid="chart">
      {points.map((p) => `${p.date}=${Math.round(p.value)}${p.hollow ? '(rough)' : ''}`).join(' ')}
    </p>
  ),
}))
const mockList = vi.mocked(listExercises)
const mockSets = vi.mocked(setsForExercise)

const squat = { id: 'sq', name: 'Back Squat', category: 'squat' as const }
const bench = { id: 'bp', name: 'Bench Press', category: 'push' as const }

describe('LiftingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
    mockList.mockReset().mockResolvedValue([squat, bench])
    mockSets.mockReset().mockImplementation((id) =>
      Promise.resolve(
        id === 'sq'
          ? [
              { date: '2026-10-20', weightLb: 135, reps: 5, isWarmup: true },
              { date: '2026-10-20', weightLb: 205, reps: 5, isWarmup: false }, // 239
              { date: '2026-11-03', weightLb: 225, reps: 5, isWarmup: false }, // 262.5
            ]
          : [{ date: '2026-11-01', weightLb: 95, reps: 15, isWarmup: false }], // 142.5, rough
      ),
    )
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('charts best est. 1RM per day for the first exercise, with figures', async () => {
    render(<LiftingProgress />)
    expect(await screen.findByTestId('chart')).toHaveTextContent('2026-10-20=239 2026-11-03=263')
    expect(mockSets).toHaveBeenCalledWith('sq', '2026-08-17', '2026-11-04')
    expect(screen.getAllByText('263 lb')).toHaveLength(2) // latest and best
    expect(screen.getByText('+23 lb')).toBeInTheDocument()
  })

  it('switches exercise and marks rough estimates', async () => {
    render(<LiftingProgress />)
    await screen.findByTestId('chart')
    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: 'bp' } })
    expect(await screen.findByText('2026-11-01=143(rough)')).toBeInTheDocument()
    expect(screen.getByText(/Hollow dots are rough/)).toBeInTheDocument()
  })

  it('prompts to log a lift when there are no exercises', async () => {
    mockList.mockResolvedValue([])
    render(<LiftingProgress />)
    expect(await screen.findByRole('link', { name: 'Log a lift workout' })).toBeInTheDocument()
  })
})
