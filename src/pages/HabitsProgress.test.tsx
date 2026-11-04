import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allChecks, listHabits, type HabitCheck } from '../lib/db/habits'
import type { DailyMinutes } from '../lib/metrics'
import { HabitsProgress } from './HabitsProgress'

vi.mock('../lib/db/habits', () => ({ listHabits: vi.fn(), allChecks: vi.fn() }))
// Recharts needs real layout; show the data the chart receives instead.
vi.mock('../components/ScreenTimeChart', () => ({
  ScreenTimeChart: ({ days }: { days: DailyMinutes[] }) => (
    <p data-testid="screen-chart">
      {days
        .filter((d) => d.minutes !== null)
        .map((d) => `${d.date}=${d.minutes}`)
        .join(' ')}
    </p>
  ),
}))

const read = { id: 'r', name: 'Read', tracking: 'check' as const, weeklyGoal: 3 }
const screenTime = { id: 'st', name: 'Screen time', tracking: 'minutes' as const, weeklyGoal: 3 }

const check = (date: string): HabitCheck => ({ habitId: 'r', date, minutes: null, done: true })
const minutes = (date: string, m: number): HabitCheck => ({ habitId: 'st', date, minutes: m, done: true })

function card(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement
}
function figure(name: string, label: string): string | null | undefined {
  return within(card(name)).getByText(label).nextElementSibling?.textContent
}

describe('HabitsProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0)) // Wed Nov 4; 1m = Oct 12 – Nov 4 (24 days)
    vi.mocked(listHabits).mockReset().mockResolvedValue([read, screenTime])
    vi.mocked(allChecks)
      .mockReset()
      .mockResolvedValue([
        // A 10-day run in September (best streak), then Oct 30–31 and Nov 2–3.
        ...Array.from({ length: 10 }, (_, i) => check(`2026-09-${String(i + 1).padStart(2, '0')}`)),
        check('2026-10-30'),
        check('2026-10-31'),
        check('2026-11-02'),
        check('2026-11-03'),
        // Screen time: one day in the 24 days before the range, two in it.
        minutes('2026-10-01', 180),
        minutes('2026-10-20', 120),
        minutes('2026-11-03', 60),
      ])
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows the current and best streak and days done in range', async () => {
    render(<HabitsProgress />)
    await screen.findByRole('heading', { name: 'Read' })
    expect(figure('Read', 'Streak')).toBe('2 days') // through yesterday
    expect(figure('Read', 'Best streak')).toBe('10 days')
    expect(figure('Read', 'Done')).toBe('4 of 24')
    const rows = within(card('Read')).getAllByRole('row').slice(1).map((r) => r.textContent)
    expect(rows).toEqual(['Oct 120', 'Oct 190', 'Oct 262', 'Nov 22'])
  })

  it('shows screen time average, change vs before, and the chart', async () => {
    render(<HabitsProgress />)
    await screen.findByRole('heading', { name: 'Screen time' })
    expect(figure('Screen time', 'Average')).toBe('1h 30m') // (120 + 60) / 2
    expect(figure('Screen time', 'vs. before')).toBe('1h 30m') // 180 before
    expect(within(card('Screen time')).getByText('less ↓')).toBeInTheDocument()
    expect(figure('Screen time', 'Logged')).toBe('2 of 24')
    expect(screen.getByTestId('screen-chart')).toHaveTextContent('2026-10-20=120 2026-11-03=60')
  })

  it('follows the range buttons; streaks still use all history', async () => {
    render(<HabitsProgress />)
    await screen.findByRole('heading', { name: 'Read' })
    fireEvent.click(screen.getByRole('button', { name: '1w' }))
    expect(figure('Read', 'Done')).toBe('2 of 3') // Nov 2–4
    expect(figure('Read', 'Best streak')).toBe('10 days')
    expect(figure('Screen time', 'Average')).toBe('1h')
    expect(figure('Screen time', 'vs. before')).toBe('–') // nothing logged Oct 30 – Nov 1
  })

  it('says so when there is no screen time in range', async () => {
    vi.mocked(allChecks).mockResolvedValue([check('2026-11-03')])
    render(<HabitsProgress />)
    expect(await screen.findByText('No screen time logged in this range yet.')).toBeInTheDocument()
    expect(figure('Screen time', 'Average')).toBe('–')
  })

  it('points to Settings when there are no check-off habits', async () => {
    vi.mocked(listHabits).mockResolvedValue([screenTime])
    render(<HabitsProgress />)
    expect(await screen.findByRole('link', { name: 'Add one in Settings' })).toHaveAttribute('href', '#/settings')
  })

  it('marks ✗ days in the grid, counts only ✓ days, and a ✗ today ends the streak', async () => {
    const devil = { id: 'd', name: '😈', tracking: 'yesno' as const, weeklyGoal: 3 }
    vi.mocked(listHabits).mockResolvedValue([devil])
    const d = (date: string, done: boolean): HabitCheck => ({ habitId: 'd', date, minutes: null, done })
    vi.mocked(allChecks).mockResolvedValue([d('2026-11-02', true), d('2026-11-03', true), d('2026-11-04', false)])
    render(<HabitsProgress />)
    await screen.findByRole('heading', { name: '😈' })
    expect(figure('😈', 'Streak')).toBe('0 days')
    expect(figure('😈', 'Best streak')).toBe('2 days')
    expect(figure('😈', 'Done')).toBe('2 of 24')
    expect(within(card('😈')).getAllByText('✗')).toHaveLength(1)
    expect(within(card('😈')).getByText(/✗ = marked missed/)).toBeInTheDocument()
  })
})
