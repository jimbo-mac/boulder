import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runsBetween, type Run } from '../lib/db/runs'
import { getSettings } from '../lib/db/settings'
import type { PaceChartPoint } from '../components/PaceTrendChart'
import type { WeeklyMileage } from '../lib/metrics'
import { Progress } from './Progress'

vi.mock('../lib/db/runs', () => ({ runsBetween: vi.fn() }))
vi.mock('../lib/db/settings', () => ({ getSettings: vi.fn() }))
vi.mock('../components/LongRunChart', () => ({
  LongRunChart: ({ runs, prIds }: { runs: Run[]; prIds?: ReadonlySet<string> }) => (
    <p data-testid="long-chart">
      {runs.map((r) => `${r.date}=${r.distanceMi}${prIds?.has(r.workoutId) ? '(PR)' : ''}`).join(' ')}
    </p>
  ),
}))
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
  PaceTrendChart: ({ points }: { points: PaceChartPoint[] }) => (
    <p data-testid="pace-chart">{points.map((p) => `${p.date}@${p.pace}${p.pr ? '(PR)' : ''}`).join(' ')}</p>
  ),
}))
const mockRunsBetween = vi.mocked(runsBetween)
const mockGetSettings = vi.mocked(getSettings)
const noGoal = { goalRaceName: null, goalRaceDate: null, goalDistanceMi: null, goalTimeS: null }

describe('Progress (running)', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 12, 0)) // Wed Nov 4 2026
    mockGetSettings.mockReset().mockResolvedValue(noGoal)
    mockRunsBetween.mockReset().mockResolvedValue([
      { workoutId: 'a', date: '2026-10-27', distanceMi: 4, durationS: 2000, kind: 'base' },
      { workoutId: 'b', date: '2026-11-02', distanceMi: 6, durationS: 3000, kind: 'long' },
    ])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('defaults to 1 month (4 weeks) and fills empty weeks with 0', async () => {
    render(<Progress />)
    const items = await screen.findAllByRole('listitem')
    expect(mockRunsBetween).toHaveBeenCalledWith('2026-10-12', '2026-11-04')
    expect(items).toHaveLength(4)
    expect(items.at(-1)).toHaveTextContent('2026-11-02=6')
    expect(items.at(-2)).toHaveTextContent('2026-10-26=4')
    expect(items.at(0)).toHaveTextContent('2026-10-12=0')
  })

  it('shows this week, weekly average, and total', async () => {
    render(<Progress />)
    expect(await screen.findByText('6.0 mi')).toBeInTheDocument() // this week
    expect(screen.getByText('2.5 mi')).toBeInTheDocument() // 10 / 4
    expect(screen.getByText('10.0 mi')).toBeInTheDocument()
  })

  it('refetches when the range changes', async () => {
    render(<Progress />)
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('button', { name: '3m' }))
    await vi.waitFor(() =>
      expect(mockRunsBetween).toHaveBeenLastCalledWith('2026-08-10', '2026-11-04'),
    )
  })

  it('1w shows just this week', async () => {
    render(<Progress />)
    await screen.findAllByRole('listitem')
    fireEvent.click(screen.getByRole('button', { name: '1w' }))
    await vi.waitFor(() =>
      expect(mockRunsBetween).toHaveBeenLastCalledWith('2026-11-02', '2026-11-04'),
    )
  })

  it('offers Running, Lifting, Stretching, and Habits', async () => {
    render(<Progress />)
    const group = screen.getByRole('group', { name: 'Progress type' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['Running', 'Lifting', 'Stretching', 'Habits'])
    await screen.findAllByRole('listitem')
  })

  it('offers only 1w, 1m, and 3m', async () => {
    render(<Progress />)
    const group = await screen.findByRole('group', { name: 'Time range' })
    expect(within(group).getAllByRole('button').map((b) => b.textContent)).toEqual(['1w', '1m', '3m'])
    expect(within(group).getByRole('button', { name: '1m' })).toHaveAttribute('aria-pressed', 'true')
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
        '2026-10-20@600 2026-10-27@580(PR) 2026-11-03@560(PR) 2026-11-04@550(PR)',
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

  describe('run PRs', () => {
    const run = (id: string, date: string, distanceMi: number, durationS: number, kind: Run['kind']): Run => ({
      workoutId: id,
      date,
      distanceMi,
      durationS,
      kind,
    })

    it('marks long-run distance PRs and lists recent PRs newest first', async () => {
      mockRunsBetween.mockResolvedValue([
        run('l1', '2026-10-14', 8, 4800, 'long'),
        run('b1', '2026-10-15', 5, 2700, 'base'), // 9:00 baseline
        run('l2', '2026-10-21', 10, 6000, 'long'), // PR +2
        run('b2', '2026-10-22', 5.1, 2652, 'base'), // 8:40, PR
        run('l3', '2026-10-28', 9, 5400, 'long'),
      ])
      render(<Progress />)
      expect(await screen.findByTestId('long-chart')).toHaveTextContent('2026-10-14=8 2026-10-21=10(PR) 2026-10-28=9')
      const heading = screen.getByRole('heading', { name: 'Recent PRs' })
      const items = within(heading.closest('section') as HTMLElement).getAllByRole('listitem')
      expect(items).toHaveLength(2)
      expect(items[0]).toHaveTextContent('Base · fastest')
      expect(items[0]).toHaveTextContent('8:40 /mi')
      expect(items[0]).toHaveTextContent('5.10 mi · 0:20 faster')
      expect(items[1]).toHaveTextContent('Long · longest')
      expect(items[1]).toHaveTextContent('10.00 mi')
      expect(items[1]).toHaveTextContent('+2.00 mi')
    })

    it('judges PRs against all runs, not just the visible range', async () => {
      const old = run('old', '2026-03-01', 12, 7200, 'long')
      const recent = [run('l1', '2026-10-14', 8, 4800, 'long'), run('l2', '2026-10-21', 10, 6000, 'long')]
      mockRunsBetween.mockImplementation((from) => Promise.resolve(from === null ? [old, ...recent] : recent))
      render(<Progress />)
      await vi.waitFor(() => expect(mockRunsBetween).toHaveBeenCalledWith(null, '2026-11-04'))
      expect(await screen.findByTestId('long-chart')).toHaveTextContent('2026-10-14=8 2026-10-21=10')
      expect(screen.getByTestId('long-chart')).not.toHaveTextContent('(PR)')
      expect(screen.getByText(/No PRs in this range yet/)).toBeInTheDocument()
    })
  })

  it('charts only long runs in the long-run section', async () => {
    render(<Progress />)
    expect(await screen.findByTestId('long-chart')).toHaveTextContent('2026-11-02=6')
    expect(screen.getByTestId('long-chart')).not.toHaveTextContent('2026-10-27')
  })

  describe('goal card', () => {
    it('links to settings when no goal is set', async () => {
      render(<Progress />)
      expect(await screen.findByRole('link', { name: 'Set a goal race' })).toHaveAttribute(
        'href',
        '#/settings',
      )
    })

    it('shows goal, prediction from the best recent effort, and the gap', async () => {
      mockGetSettings.mockResolvedValue({
        goalRaceName: 'Spring Half',
        goalRaceDate: '2026-11-14',
        goalDistanceMi: 13.11,
        goalTimeS: 6000,
      })
      render(<Progress />)
      expect(await screen.findByText('Spring Half')).toBeInTheDocument()
      expect(screen.getByText(/10 days to go/)).toBeInTheDocument()
      expect(screen.getByText('1:40:00')).toBeInTheDocument()
      // Both runs are 8:20/mi; the 6 mi run extrapolates better, so it is the basis.
      expect(await screen.findByText(/6\.00 mi on Nov 2/)).toBeInTheDocument()
      expect(screen.getByText(/off goal/)).toBeInTheDocument()
      // Prediction looks at the last 8 weeks regardless of the range selector.
      expect(mockRunsBetween).toHaveBeenCalledWith('2026-09-10', '2026-11-04')
    })
  })

  it('shows an empty message when there are no runs', async () => {
    mockRunsBetween.mockResolvedValue([])
    render(<Progress />)
    expect(await screen.findByText('No runs in this range yet.')).toBeInTheDocument()
  })
})
