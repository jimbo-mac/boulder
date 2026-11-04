import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allChecks, checksBetween, listHabits, setMark, setMinutes, type HabitCheck } from '../lib/db/habits'
import { HabitsForm } from './HabitsForm'

vi.mock('../lib/db/habits', () => ({
  listHabits: vi.fn(),
  allChecks: vi.fn(),
  checksBetween: vi.fn(),
  setMark: vi.fn(),
  setMinutes: vi.fn(),
}))

const read = { id: 'r', name: 'Read', tracking: 'check' as const, weeklyGoal: 3 }
const screenTime = { id: 'st', name: 'Screen time', tracking: 'minutes' as const, weeklyGoal: 3 }

// Today is Wed Nov 4 2026. Read was done Nov 2 and 3 (a 2-day streak through yesterday)
// and Oct 25–31 (a longer run, outside the first week of the month view).
const saved: HabitCheck[] = [
  ...['2026-10-30', '2026-10-31', '2026-11-02', '2026-11-03'].map((date) => ({ habitId: 'r', date, minutes: null, done: true })),
  { habitId: 'st', date: '2026-11-03', minutes: 150, done: true },
]

const habitButton = (name: string) => screen.getByRole('button', { name: new RegExp(`^${name}`) })
const day = (label: string) => screen.getByRole('button', { name: new RegExp(`^${label}:`) })

describe('HabitsForm', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0))
    vi.mocked(listHabits).mockReset().mockResolvedValue([read, screenTime])
    vi.mocked(allChecks)
      .mockReset()
      .mockImplementation((ids) => Promise.resolve(saved.filter((c) => ids.includes(c.habitId))))
    vi.mocked(checksBetween)
      .mockReset()
      .mockImplementation((ids, from, to) =>
        Promise.resolve(saved.filter((c) => ids.includes(c.habitId) && c.date >= from && c.date <= to)),
      )
    vi.mocked(setMark).mockReset().mockResolvedValue()
    vi.mocked(setMinutes).mockReset().mockResolvedValue()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows each habit with its streak, and checking today extends it', async () => {
    render(<HabitsForm />)
    await waitFor(() => expect(habitButton('Read')).toHaveTextContent('2 days in a row'))
    expect(allChecks).toHaveBeenCalledWith(['r']) // streak history: check-off habits only
    fireEvent.click(habitButton('Read'))
    expect(habitButton('Read')).toHaveAttribute('aria-pressed', 'true')
    expect(habitButton('Read')).toHaveTextContent('3 days in a row')
    await waitFor(() => expect(setMark).toHaveBeenCalledWith('r', '2026-11-04', 'done'))
  })

  it('logs screen time as hours:minutes', async () => {
    render(<HabitsForm />)
    const field = await screen.findByLabelText('Screen time (hours:minutes)')
    expect(screen.getByText('Not logged for this day.')).toBeInTheDocument()
    fireEvent.change(field, { target: { value: '215' } })
    expect(field).toHaveValue('2:15')
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Saved: 2h 15m')).toBeInTheDocument()
    await waitFor(() => expect(setMinutes).toHaveBeenCalledWith('st', '2026-11-04', 135))
  })

  it('rejects impossible times', async () => {
    render(<HabitsForm />)
    const field = await screen.findByLabelText('Screen time (hours:minutes)')
    fireEvent.change(field, { target: { value: '275' } })
    expect(screen.getByText(/Minutes must be under 60/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled()
  })

  it('shows and clears a past day’s screen time', async () => {
    render(<HabitsForm />)
    await waitFor(() => expect(day('Tue, Nov 3, 2026')).toHaveAccessibleName(/Screen time 2h 30m/))
    fireEvent.click(day('Tue, Nov 3, 2026'))
    expect(screen.getByLabelText('Screen time (hours:minutes)')).toHaveValue('2:30')
    expect(screen.getByText('Saved: 2h 30m')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }))
    expect(await screen.findByText('Not logged for this day.')).toBeInTheDocument()
    await waitFor(() => expect(setMinutes).toHaveBeenCalledWith('st', '2026-11-03', null))
  })

  it('marks the calendar with how many habits were done', async () => {
    render(<HabitsForm />)
    await waitFor(() => expect(day('Mon, Nov 2, 2026')).toHaveAccessibleName(/Read done/))
    expect(day('Mon, Nov 2, 2026')).toHaveTextContent('2✓')
    expect(day('Sun, Nov 1, 2026')).toHaveAccessibleName(/Read not done, Screen time not logged/)
    expect(screen.getByText('This month: Read 2 days')).toBeInTheDocument()
  })

  it('points to Settings when there are no check-off habits yet', async () => {
    vi.mocked(listHabits).mockResolvedValue([screenTime])
    render(<HabitsForm />)
    expect(await screen.findByRole('link', { name: 'Add one in Settings' })).toHaveAttribute('href', '#/settings')
  })

  it('undoes a check and explains when saving fails', async () => {
    vi.mocked(setMark).mockRejectedValue(new Error('offline'))
    render(<HabitsForm />)
    await waitFor(() => expect(habitButton('Read')).toHaveTextContent('2 days in a row'))
    fireEvent.click(habitButton('Read'))
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't save: offline")
    expect(habitButton('Read')).toHaveAttribute('aria-pressed', 'false')
  })

  describe('a ✓ / ✗ habit', () => {
    const devil = { id: 'd', name: '😈', tracking: 'yesno' as const, weeklyGoal: 3 }
    const mark = (name: 'done' | 'missed') => screen.getByRole('button', { name: `😈: ${name}` })

    beforeEach(() => {
      vi.mocked(listHabits).mockResolvedValue([devil, screenTime])
      saved.push(
        { habitId: 'd', date: '2026-11-02', minutes: null, done: true },
        { habitId: 'd', date: '2026-11-03', minutes: null, done: true },
        { habitId: 'd', date: '2026-11-01', minutes: null, done: false },
      )
    })
    afterEach(() => {
      saved.splice(-3, 3)
    })

    it('marks today done, extending the streak', async () => {
      render(<HabitsForm />)
      const row = await screen.findByRole('group', { name: '😈' })
      await waitFor(() => expect(row).toHaveTextContent('2 days in a row'))
      expect(allChecks).toHaveBeenCalledWith(['d']) // full history for its streak
      fireEvent.click(mark('done'))
      expect(mark('done')).toHaveAttribute('aria-pressed', 'true')
      expect(row).toHaveTextContent('3 days in a row')
      await waitFor(() => expect(setMark).toHaveBeenCalledWith('d', '2026-11-04', 'done'))
    })

    it('marks today missed, ending the streak; tapping ✗ again clears it', async () => {
      render(<HabitsForm />)
      const row = await screen.findByRole('group', { name: '😈' })
      await waitFor(() => expect(row).toHaveTextContent('2 days in a row'))
      fireEvent.click(mark('missed'))
      expect(mark('missed')).toHaveAttribute('aria-pressed', 'true')
      expect(row).toHaveTextContent('No streak yet')
      await waitFor(() => expect(setMark).toHaveBeenCalledWith('d', '2026-11-04', 'missed'))

      fireEvent.click(mark('missed'))
      expect(mark('missed')).toHaveAttribute('aria-pressed', 'false')
      expect(row).toHaveTextContent('2 days in a row')
      await waitFor(() => expect(setMark).toHaveBeenLastCalledWith('d', '2026-11-04', null))
    })

    it('shows a past miss on the calendar', async () => {
      render(<HabitsForm />)
      await waitFor(() => expect(day('Sun, Nov 1, 2026')).toHaveAccessibleName(/😈 missed/))
      fireEvent.click(day('Sun, Nov 1, 2026'))
      expect(mark('missed')).toHaveAttribute('aria-pressed', 'true')
    })
  })
})
