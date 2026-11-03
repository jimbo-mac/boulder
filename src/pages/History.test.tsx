import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listRuns, type Run } from '../lib/db/runs'
import { History, PAGE_SIZE } from './History'

vi.mock('../lib/db/runs', () => ({ listRuns: vi.fn() }))
const mockListRuns = vi.mocked(listRuns)

function makeRun(i: number): Run {
  return { workoutId: `w${i}`, date: '2026-11-03', distanceMi: 5, durationS: 2730, kind: 'base' }
}

describe('History', () => {
  beforeEach(() => {
    mockListRuns.mockReset()
  })

  it('shows an empty state', async () => {
    mockListRuns.mockResolvedValue([])
    render(<History />)
    expect(await screen.findByText(/No runs yet/)).toBeInTheDocument()
  })

  it('lists runs with distance, time, pace, and type', async () => {
    mockListRuns.mockResolvedValue([makeRun(1)])
    render(<History />)
    expect(await screen.findByText('Tue, Nov 3, 2026')).toBeInTheDocument()
    expect(screen.getByText('Base')).toBeInTheDocument()
    expect(screen.getByText(/5\.00 mi/)).toBeInTheDocument()
    expect(screen.getByText('9:06 /mi')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('loads the next page', async () => {
    const firstPage = Array.from({ length: PAGE_SIZE }, (_, i) => makeRun(i))
    mockListRuns.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([makeRun(999)])
    render(<History />)
    fireEvent.click(await screen.findByRole('button', { name: 'Load more' }))
    await vi.waitFor(() => expect(screen.getAllByRole('listitem')).toHaveLength(PAGE_SIZE + 1))
    expect(mockListRuns).toHaveBeenLastCalledWith(PAGE_SIZE, PAGE_SIZE)
    expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument()
  })

  it('shows load errors', async () => {
    mockListRuns.mockRejectedValue(new Error('offline'))
    render(<History />)
    expect(await screen.findByRole('alert')).toHaveTextContent('offline')
  })
})
