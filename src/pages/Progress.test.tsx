import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runsBetween, type Run } from '../lib/db/runs'
import type { PacePoint, WeeklyMileage } from '../lib/metrics'
import { Progress } from './Progress'

vi.mock('../lib/db/runs', () => ({ runsBetween: vi.fn() }))
// Recharts needs real layout; render the data the chart receives instead.
vi.mock('../components/WeeklyMileageChart', () => ({
  WeeklyMileageChart: ({ data }: { data: WeeklyMileage[] }) => (
    <ol aria-label="chart data">
      {data.map((w) => (
        <li key={w.weekStart}>{`${w.weekStart}=${w.miles}`}</li>
      ))}
    </ol>
  ),
}))
vi.mock('../components/PaceTrendChart', () => ({
  PaceTrendChart: ({ points }: { points: PacePoint[] }) => (
    <p data-testid="pace-chart">{points.map((p) => `${p.date}@${p.pace}`).join(' ')}</p>
  ),
}))
const mockRunsBetween = vi.mocked(runsBetween)

describe('Progress (running)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0)) // Wed Nov 4 2026
    mockRunsBetween.mockReset().mockResolvedValue([
      { workoutId: 'a', date: '2026-10-27', distanceMi: 4, durationS: 2000, kind: 'base' },
      { workoutId: 'b', date: '2026-11-02', distanceMi: 6, durationS: 3000, kind: 'long' },
    ])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to 12 weeks and fills empty weeks with 0', async () => {
    render(<Progress />)
    const items = await screen.findAllByRole('listitem')
    expect(mockRunsBetween).toHaveBeenCalledWith('2026-08-17', '2026-11-04')
    expect(items).toHaveLength(12)
    expect(items.at(-1)).toHaveTextContent('2026-11-02=6')
    expect(items.at(-2)).toHaveTextContent('2026-10-26=4')
    expect(items.at(0)).toHaveTextContent('2026-08-17=0')
  })

  it('shows this week, weekly average, and total', async () => {
    render(<Progress />)
    expect(await screen.findByText('6.0 mi')).toBeInTheDocument() // this week
    expect(screen.getByText('0.8 mi')).toBeInTheDocument() // 10 / 12
    expect(screen.getByText('10.0 mi')).toBeInTheDocument()
  })

  it('refetches when the range changes', async () => {
    render(<Progress />)
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('button', { name: '4w' }))
    await vi.waitFor(() =>
      expect(mockRunsBetween).toHaveBeenLastCalledWith('2026-10-12', '2026-11-04'),
    )
  })

  it('"All" starts at the first run', async () => {
    render(<Progress />)
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('button', { name: 'All' }))
    await vi.waitFor(() => expect(mockRunsBetween).toHaveBeenLastCalledWith(null, '2026-11-04'))
    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(2))
  })

  describe('pace section', () => {
    const run = (id: string, date: string, durationS: number, kind: Run['kind']): Run => ({
      workoutId: id,
      date,
      distanceMi: 1,
      durationS,
      kind,
    })

    beforeEach(() => {
      mockRunsBetween.mockResolvedValue([
        run('a', '2026-10-20', 600, 'base'),
        run('b', '2026-10-22', 400, 'speed'),
        run('c', '2026-10-27', 580, 'base'),
        run('d', '2026-11-03', 560, 'base'),
        run('e', '2026-11-04', 550, 'base'),
      ])
    })

    it('defaults to Base runs and shows the improvement', async () => {
      render(<Progress />)
      expect(await screen.findByTestId('pace-chart')).toHaveTextContent(
        '2026-10-20@600 2026-10-27@580 2026-11-03@560 2026-11-04@550',
      )
      // first 2 avg 590, last 2 avg 555 -> 35s faster
      expect(screen.getByText('0:35 /mi faster')).toBeInTheDocument()
      // 5-run avg of all four base runs: 2290 / 4 = 572.5 -> 9:33
      expect(screen.getByText('9:33 /mi')).toBeInTheDocument()
    })

    it('switches run type', async () => {
      render(<Progress />)
      await screen.findByTestId('pace-chart')
      fireEvent.click(screen.getByRole('button', { name: 'Speed' }))
      expect(screen.getByTestId('pace-chart')).toHaveTextContent('2026-10-22@400')
      expect(screen.getByText('–')).toBeInTheDocument() // one run: nothing to compare
    })

    it('shows an empty message for a type with no runs', async () => {
      render(<Progress />)
      await screen.findByTestId('pace-chart')
      fireEvent.click(screen.getByRole('button', { name: 'Recovery' }))
      expect(screen.getByText('No recovery runs in this range yet.')).toBeInTheDocument()
    })
  })

  it('shows an empty message when there are no runs', async () => {
    mockRunsBetween.mockResolvedValue([])
    render(<Progress />)
    expect(await screen.findByText('No runs in this range yet.')).toBeInTheDocument()
  })
})
