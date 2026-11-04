import { fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { allChecks, listHabits } from '../lib/db/habits'
import { StretchingProgress } from './StretchingProgress'

vi.mock('../lib/db/habits', () => ({ listHabits: vi.fn(), allChecks: vi.fn() }))
const mockList = vi.mocked(listHabits)
const mockChecks = vi.mocked(allChecks)

const p = (date: string) => ({ habitId: 'p', date })
const g = (date: string) => ({ habitId: 'g', date })

function card(name: string): HTMLElement {
  return screen.getByRole('heading', { name }).closest('section') as HTMLElement
}
function figure(name: string, label: string): string | null | undefined {
  return within(card(name)).getByText(label).nextElementSibling?.textContent
}

describe('StretchingProgress', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] })
    vi.setSystemTime(new Date(2026, 10, 4, 9, 0)) // Wed Nov 4 2026; 1m = weeks of Oct 12, 19, 26, Nov 2
    mockList.mockReset().mockResolvedValue([
      { id: 'p', name: 'Posture', weeklyGoal: 2 },
      { id: 'g', name: 'General', weeklyGoal: 3 },
    ])
    const saved = [
      // Posture (2/wk): met, met, missed, met (this week).
      p('2026-10-12'), p('2026-10-13'), p('2026-10-19'), p('2026-10-20'), p('2026-10-26'), p('2026-11-02'), p('2026-11-03'),
      // General (3/wk): an older met week, then missed, met, met, and 1 so far this week.
      g('2026-09-28'), g('2026-09-29'), g('2026-09-30'),
      g('2026-10-12'),
      g('2026-10-19'), g('2026-10-20'), g('2026-10-21'),
      g('2026-10-27'), g('2026-10-28'), g('2026-10-29'),
      g('2026-11-02'),
    ]
    // Like the real query: only the habits asked for.
    mockChecks.mockReset().mockImplementation((ids) => Promise.resolve(saved.filter((c) => ids.includes(c.habitId))))
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('shows this week, the week streak, and weeks the goal was met', async () => {
    render(<StretchingProgress />)
    await screen.findByRole('heading', { name: 'Posture' })
    expect(mockChecks).toHaveBeenCalledWith(['p', 'g'])

    expect(figure('Posture', 'This week')).toBe('2 of 2')
    expect(figure('Posture', 'Week streak')).toBe('1 week') // this week met; Oct 26 missed
    expect(figure('Posture', 'Goal met')).toBe('3 of 4 weeks') // this week counts once met

    expect(figure('General', 'This week')).toBe('1 of 3')
    expect(figure('General', 'Week streak')).toBe('2 weeks') // through last week
    expect(figure('General', 'Goal met')).toBe('2 of 3 weeks') // this week still in progress
  })

  it('lays out each week with days done and the goal result', async () => {
    render(<StretchingProgress />)
    await screen.findByRole('heading', { name: 'Posture' })
    const table = within(card('Posture')).getByRole('table', { name: 'Posture by week' })
    const rows = within(table)
      .getAllByRole('row')
      .slice(1)
      .map((r) => r.textContent)
    expect(rows).toEqual(['Oct 122met', 'Oct 192met', 'Oct 261missed', 'Nov 22met'])
    const general = within(card('General')).getByRole('table', { name: 'General by week' })
    expect(within(general).getAllByRole('row').at(-1)).toHaveTextContent('Nov 21in progress')
  })

  it('follows the range buttons; streaks still use all history', async () => {
    render(<StretchingProgress />)
    await screen.findByRole('heading', { name: 'General' })
    fireEvent.click(screen.getByRole('button', { name: '1w' }))
    expect(within(card('General')).getAllByRole('row')).toHaveLength(2) // header + this week
    expect(figure('General', 'Goal met')).toBe('–') // nothing finished yet
    expect(figure('General', 'Week streak')).toBe('2 weeks')
    expect(figure('Posture', 'Goal met')).toBe('1 of 1 week')

    fireEvent.click(screen.getByRole('button', { name: '3m' }))
    expect(within(card('General')).getAllByRole('row')).toHaveLength(14) // header + 13 weeks
  })

  it('labels the grid with each month once and the day each week starts', async () => {
    render(<StretchingProgress />)
    await screen.findByRole('heading', { name: 'Posture' })
    const header = (name: string) => {
      const grid = card(name).querySelector('[aria-hidden="true"].grid') as HTMLElement
      return [...grid.children].slice(0, 12).map((el) => el.textContent)
    }
    // 1m: Oct 12, 19, 26 and Nov 2 → "Oct" spans 3 weeks, "Nov" 1.
    expect(header('Posture').slice(0, 3)).toEqual(['', 'Oct', 'Nov'])
    expect(header('Posture').slice(3, 8)).toEqual(['', '12', '19', '26', '2'])

    fireEvent.click(screen.getByRole('button', { name: '3m' }))
    // Aug 10 → Nov 2: Aug, Sep, Oct, Nov, each named once.
    expect(header('Posture').slice(0, 5)).toEqual(['', 'Aug', 'Sep', 'Oct', 'Nov'])
  })

  it('shows an error if loading fails', async () => {
    mockChecks.mockRejectedValue(new Error('offline'))
    render(<StretchingProgress />)
    expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load stretching: offline")
  })
})
