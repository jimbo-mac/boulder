import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { checksBetween, listHabits, setCheck } from '../lib/db/habits'
import { StretchForm } from './StretchForm'

vi.mock('../lib/db/habits', () => ({ listHabits: vi.fn(), checksBetween: vi.fn(), setCheck: vi.fn() }))
const mockList = vi.mocked(listHabits)
const mockChecks = vi.mocked(checksBetween)
const mockSet = vi.mocked(setCheck)

const posture = { id: 'p', name: 'Posture', weeklyGoal: 3 }
const general = { id: 'g', name: 'General', weeklyGoal: 2 }

const routine = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const day = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}:`) })

describe('StretchForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0)) // Wed Nov 4 2026
    mockList.mockReset().mockResolvedValue([posture, general])
    mockChecks.mockReset().mockResolvedValue([
      { habitId: 'p', date: '2026-11-02' },
      { habitId: 'p', date: '2026-11-03' },
      { habitId: 'g', date: '2026-11-03' },
      { habitId: 'g', date: '2026-10-29' },
    ])
    mockSet.mockReset().mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows this week against each goal and loads the visible month', async () => {
    render(<StretchForm />)
    await waitFor(() => expect(routine('Posture')).toHaveTextContent('2 of 3 this week'))
    expect(routine('General')).toHaveTextContent('1 of 2 this week')
    // Nov 2026 grid runs Mon Oct 26 – Sun Dec 6.
    expect(mockChecks).toHaveBeenCalledWith(['p', 'g'], '2026-10-26', '2026-12-06')
    expect(screen.getByRole('heading', { name: 'November 2026' })).toBeInTheDocument()
    expect(screen.getByText('This month: Posture 2 days · General 1 day')).toBeInTheDocument()
  })

  it('marks each day in the calendar', async () => {
    render(<StretchForm />)
    await waitFor(() => expect(day('Tue, Nov 3, 2026')).toHaveAccessibleName(/Posture done, General done/))
    expect(day('Mon, Nov 2, 2026')).toHaveAccessibleName(/Posture done, General not done/)
    expect(day('Thu, Oct 29, 2026')).toHaveAccessibleName(/Posture not done, General done/)
    expect(day('Wed, Nov 4, 2026')).toHaveAttribute('aria-current', 'date')
    expect(day('Thu, Nov 5, 2026')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Next month' })).toBeDisabled()
  })

  it('checks off today with one tap and can undo it', async () => {
    render(<StretchForm />)
    await waitFor(() => expect(routine('Posture')).toHaveTextContent('2 of 3'))
    fireEvent.click(routine('Posture'))
    expect(routine('Posture')).toHaveAttribute('aria-pressed', 'true')
    expect(routine('Posture')).toHaveTextContent('3 of 3 this week · goal met')
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith('p', '2026-11-04', true))

    fireEvent.click(routine('Posture'))
    expect(routine('Posture')).toHaveAttribute('aria-pressed', 'false')
    await waitFor(() => expect(mockSet).toHaveBeenLastCalledWith('p', '2026-11-04', false))
  })

  it('checks off a forgotten past day', async () => {
    render(<StretchForm />)
    await waitFor(() => expect(day('Mon, Nov 2, 2026')).toHaveAccessibleName(/General not done/))
    fireEvent.click(day('Mon, Nov 2, 2026'))
    expect(screen.getByText('Mon, Nov 2, 2026')).toBeInTheDocument()
    fireEvent.click(routine('General'))
    await waitFor(() => expect(mockSet).toHaveBeenCalledWith('g', '2026-11-02', true))
    expect(day('Mon, Nov 2, 2026')).toHaveAccessibleName(/General done/)

    fireEvent.click(screen.getByRole('button', { name: 'Back to today' }))
    expect(screen.getByText('Today')).toBeInTheDocument()
  })

  it('goes to the previous month, still loading the selected week', async () => {
    render(<StretchForm />)
    await screen.findByRole('heading', { name: 'November 2026' })
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }))
    expect(screen.getByRole('heading', { name: 'October 2026' })).toBeInTheDocument()
    // Oct grid is Sep 28 – Nov 1, plus today's week (Nov 2–8) for the goal progress.
    await waitFor(() => expect(mockChecks).toHaveBeenLastCalledWith(['p', 'g'], '2026-09-28', '2026-11-08'))
  })

  it('undoes the tap and explains when saving fails', async () => {
    mockSet.mockRejectedValue(new Error('offline'))
    render(<StretchForm />)
    await waitFor(() => expect(routine('General')).toHaveTextContent('1 of 2'))
    fireEvent.click(routine('General'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save: offline")
    expect(routine('General')).toHaveAttribute('aria-pressed', 'false')
  })
})
