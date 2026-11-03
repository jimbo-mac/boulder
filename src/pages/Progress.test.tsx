import { fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { runsBetween } from '../lib/db/runs'
import type { WeeklyMileage } from '../lib/metrics'
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

  it('shows an empty message when there are no runs', async () => {
    mockRunsBetween.mockResolvedValue([])
    render(<Progress />)
    expect(await screen.findByText('No runs in this range yet.')).toBeInTheDocument()
  })
})
