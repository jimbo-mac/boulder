import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listHistory, type HistoryEntry } from '../lib/db/history'
import { History, PAGE_SIZE } from './History'

vi.mock('../lib/db/history', () => ({ listHistory: vi.fn() }))
const mockListHistory = vi.mocked(listHistory)

function makeRun(i: number): HistoryEntry {
  return {
    type: 'run',
    workoutId: `w${i}`,
    date: '2026-11-03',
    distanceMi: 5,
    durationS: 2730,
    kind: 'base',
  }
}

describe('History', () => {
  beforeEach(() => {
    mockListHistory.mockReset()
  })

  it('shows an empty state', async () => {
    mockListHistory.mockResolvedValue([])
    render(<History />)
    expect(await screen.findByText(/No workouts yet/)).toBeInTheDocument()
  })

  it('lists runs with distance, time, pace, and type', async () => {
    mockListHistory.mockResolvedValue([makeRun(1)])
    render(<History />)
    expect(await screen.findByText('Tue, Nov 3, 2026')).toBeInTheDocument()
    expect(screen.getByText('Base run')).toBeInTheDocument()
    expect(screen.getByText(/5\.00 mi/)).toBeInTheDocument()
    expect(screen.getByText('9:06 /mi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('lists lifts with exercises, working sets, and volume (warm-ups excluded)', async () => {
    mockListHistory.mockResolvedValue([
      {
        type: 'lift',
        workoutId: 'l1',
        date: '2026-11-02',
        exercises: ['Back Squat', 'Bench Press'],
        sets: [
          { weightLb: 135, reps: 5, isWarmup: true },
          { weightLb: 225, reps: 5, isWarmup: false },
          { weightLb: 185, reps: 5, isWarmup: false },
        ],
      },
    ])
    render(<History />)
    expect(await screen.findByText('Back Squat, Bench Press')).toBeInTheDocument()
    expect(screen.getByText('2 sets')).toBeInTheDocument()
    expect(screen.getByText('2,050 lb')).toBeInTheDocument()
  })

  it('loads the next page', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) => makeRun(i))
    mockListHistory.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([makeRun(999)])
    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE + 1))
    expect(mockListHistory).toHaveBeenLastCalledWith(PAGE_SIZE, PAGE_SIZE)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows load errors', async () => {
    mockListHistory.mockRejectedValue(new Error('offline'))
    render(<History />)
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})
