import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { DatePoint } from '../components/DateLineChart'
import type { WeekValue } from '../components/WeeklyBarChart'
import { allSets, listExercises, type DatedSet } from '../lib/db/lifts'
import { LiftingProgress } from './LiftingProgress'

vi.mock('../lib/db/lifts', () => ({ listExercises: vi.fn(), allSets: vi.fn() }))
vi.mock('../components/DateLineChart', () => ({
  DateLineChart: ({ points }: { points: DatePoint[] }) => (
    <p data-testid="chart">
      {points.map((p) => `${p.date}=${Math.round(p.value)}${p.hollow ? '(rough)' : ''}${p.pr ? '(PR)' : ''}`).join(' ')}
    </p>
  ),
}))
const mockList = vi.mocked(listExercises)
vi.mock('../components/WeeklyBarChart', () => ({
  WeeklyBarChart: ({ data }: { data: WeekValue[] }) => (
    <p data-testid="volume">
      {data
        .filter((w) => w.value > 0)
        .map((w) => `${w.weekStart}=${w.value}`)
        .join(' ')}
    </p>
  ),
}))
const mockSets = vi.mocked(allSets)

const set = (exerciseId: string, date: string, weightLb: number, reps: number, isWarmup = false): DatedSet => ({
  exerciseId,
  date,
  weightLb,
  reps,
  isWarmup,
})

const squat = { id: 'sq', name: 'Back Squat', category: 'squat' as const, tracking: 'weight' as const }
const bench = { id: 'bp', name: 'Bench Press', category: 'push' as const, tracking: 'weight' as const }
const pullup = { id: 'pu', name: 'Pull-up', category: 'pull' as const, tracking: 'reps' as const }

describe('LiftingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0))
    mockList.mockReset().mockResolvedValue([squat, bench, pullup])
    mockSets.mockReset().mockResolvedValue([
      set('sq', '2026-10-20', 135, 5, true),
      set('sq', '2026-10-20', 205, 5), // 239
      set('pu', '2026-10-28', 0, 8),
      set('pu', '2026-10-28', 0, 6),
      set('bp', '2026-11-01', 95, 15), // 142.5, rough
      set('sq', '2026-11-03', 225, 5), // 262.5
      set('pu', '2026-11-03', 0, 11),
      set('pu', '2026-11-03', 0, 9),
    ])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('charts best est. 1RM per day for the first exercise, with figures', async () => {
    render(<LiftingProgress />)
    expect(await screen.findByTestId('chart')).toHaveTextContent('2026-10-20=239 2026-11-03=263(PR)')
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

  it('charts reps per set for reps-only exercises', async () => {
    render(<LiftingProgress />)
    await screen.findByTestId('chart')
    fireEvent.change(screen.getByLabelText('Exercise'), { target: { value: 'pu' } })
    expect(await screen.findByText('2026-10-28=8 2026-11-03=11(PR)')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Reps per set' })).toBeInTheDocument()
    expect(screen.getAllByText('11 reps')).toHaveLength(3) // latest best set, best set, and the PR list
    expect(screen.getByText(/20 total/)).toBeInTheDocument()
    expect(screen.getByText('+3')).toBeInTheDocument()
    expect(screen.getByTestId('volume')).toHaveTextContent('2026-10-26=14 2026-11-02=20')
  })

  it('charts weekly volume for the selected exercise, warm-ups excluded', async () => {
    render(<LiftingProgress />)
    // 205×5 = 1025 (warm-up excluded); 225×5 = 1125
    expect(await screen.findByTestId('volume')).toHaveTextContent('2026-10-19=1025 2026-11-02=1125')
  })

  it('lists recent PRs across exercises, newest first; first sessions are baselines', async () => {
    render(<LiftingProgress />)
    const heading = await screen.findByRole('heading', { name: 'Recent PRs' })
    const items = within(heading.closest('section') as HTMLElement).getAllByRole('listitem')
    expect(items).toHaveLength(2) // bench has one session: no PR
    expect(items[0]).toHaveTextContent('Back Squat')
    expect(items[0]).toHaveTextContent('225 × 5')
    expect(items[0]).toHaveTextContent('est. 1RM 263 lb (+23)')
    expect(items[1]).toHaveTextContent('Pull-up')
    expect(items[1]).toHaveTextContent('11 reps')
    expect(items[1]).toHaveTextContent('+3 on best set')
  })

  it('judges PRs against all history, not just the visible range', async () => {
    mockSets.mockResolvedValue([
      set('sq', '2026-03-01', 315, 5), // older than 12 weeks, heavier
      set('sq', '2026-10-20', 205, 5),
      set('sq', '2026-11-03', 225, 5),
    ])
    render(<LiftingProgress />)
    expect(await screen.findByTestId('chart')).toHaveTextContent('2026-10-20=239 2026-11-03=263')
    expect(screen.getByTestId('chart')).not.toHaveTextContent('(PR)')
    expect(screen.getByText(/No PRs in this range yet/)).toBeInTheDocument()
  })

  it('prompts to log a lift when there are no exercises', async () => {
    mockList.mockResolvedValue([])
    render(<LiftingProgress />)
    expect(await screen.findByRole('link', { name: 'Log a lift workout' })).toBeInTheDocument()
  })
})
