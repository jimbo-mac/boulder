import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { archiveHabit, createHabit, listHabits, renameHabit, setHabitTracking, setWeeklyGoal } from '../lib/db/habits'
import { getSettings, saveSettings } from '../lib/db/settings'
import { Settings } from './Settings'

vi.mock('../lib/db/auth', () => ({ signOut: vi.fn() }))
vi.mock('../lib/db/habits', () => ({
  listHabits: vi.fn(),
  setWeeklyGoal: vi.fn(),
  createHabit: vi.fn(),
  renameHabit: vi.fn(),
  archiveHabit: vi.fn(),
  setHabitTracking: vi.fn(),
}))
const mockListHabits = vi.mocked(listHabits)
const mockSetWeeklyGoal = vi.mocked(setWeeklyGoal)
vi.mock('../lib/db/settings', () => ({
  EMPTY_SETTINGS: { goalRaceName: null, goalRaceDate: null, goalDistanceMi: null, goalTimeS: null },
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
}))
const mockGetSettings = vi.mocked(getSettings)
const mockSaveSettings = vi.mocked(saveSettings)
const empty = { goalRaceName: null, goalRaceDate: null, goalDistanceMi: null, goalTimeS: null }

const saveButton = () => screen.getByRole('button', { name: 'Save goal' })

describe('Settings goal race', () => {
  beforeEach(() => {
    mockListHabits.mockReset().mockResolvedValue([])
    mockGetSettings.mockReset().mockResolvedValue(empty)
    mockSaveSettings.mockReset().mockResolvedValue()
  })

  it('saves a preset distance and goal time, showing goal pace', async () => {
    render(<Settings email="me@example.com" />)
    fireEvent.change(await screen.findByLabelText(/Race name/), { target: { value: ' Spring Half ' } })
    fireEvent.change(screen.getByLabelText(/Race date/), { target: { value: '2027-03-14' } })
    fireEvent.click(screen.getByRole('button', { name: 'Half' }))
    fireEvent.change(screen.getByLabelText('Goal time'), { target: { value: '14000' } })
    expect(screen.getByLabelText('Goal time')).toHaveValue('1:40:00')
    expect(screen.getByText('7:38 /mi')).toBeInTheDocument() // 6000 / 13.11
    fireEvent.click(saveButton())
    expect(await screen.findByRole('status')).toHaveTextContent('Goal saved.')
    expect(mockSaveSettings).toHaveBeenCalledWith({
      goalRaceName: 'Spring Half',
      goalRaceDate: '2027-03-14',
      goalDistanceMi: 13.11,
      goalTimeS: 6000,
    })
  })

  it('needs both distance and time', async () => {
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: '10K' }))
    expect(screen.getByText('Set both a distance and a goal time.')).toBeInTheDocument()
    expect(saveButton()).toBeDisabled()
  })

  it('supports a custom distance', async () => {
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Other' }))
    fireEvent.change(screen.getByLabelText('Custom distance (mi)'), { target: { value: '8' } })
    fireEvent.change(screen.getByLabelText('Goal time'), { target: { value: '10000' } })
    fireEvent.click(saveButton())
    await vi.waitFor(() =>
      expect(mockSaveSettings).toHaveBeenCalledWith(
        expect.objectContaining({ goalDistanceMi: 8, goalTimeS: 3600 }),
      ),
    )
  })

  it('pre-fills a saved goal', async () => {
    mockGetSettings.mockResolvedValue({
      goalRaceName: 'Fall Marathon',
      goalRaceDate: '2027-10-10',
      goalDistanceMi: 26.22,
      goalTimeS: 4 * 3600,
    })
    render(<Settings email="me@example.com" />)
    expect(await screen.findByDisplayValue('Fall Marathon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Marathon' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByLabelText('Goal time')).toHaveValue('4:00:00')
  })

  it('clears the goal', async () => {
    mockGetSettings.mockResolvedValue({
      goalRaceName: null,
      goalRaceDate: null,
      goalDistanceMi: 3.11,
      goalTimeS: 1500,
    })
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Clear goal' }))
    expect(await screen.findByRole('status')).toHaveTextContent('Goal cleared.')
    expect(mockSaveSettings).toHaveBeenCalledWith(empty)
    expect(screen.getByLabelText('Goal time')).toHaveValue('')
  })

  it('shows the signed-in email', async () => {
    render(<Settings email="me@example.com" />)
    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
  })
})

describe('Settings stretching goals', () => {
  beforeEach(() => {
    mockGetSettings.mockReset().mockResolvedValue(empty)
    mockListHabits.mockReset().mockImplementation((kind) =>
      Promise.resolve(
        kind === 'stretch'
          ? [
              { id: 'p', name: 'Posture', tracking: 'check' as const, weeklyGoal: 3 },
              { id: 'g', name: 'General', tracking: 'check' as const, weeklyGoal: 7 },
            ]
          : [],
      ),
    )
    mockSetWeeklyGoal.mockReset().mockResolvedValue()
  })

  it('raises and lowers a goal, saving each change, within 1–7', async () => {
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Raise Posture goal' }))
    expect(screen.getByText('4 / week')).toBeInTheDocument()
    expect(mockSetWeeklyGoal).toHaveBeenLastCalledWith('p', 4)
    fireEvent.click(screen.getByRole('button', { name: 'Lower Posture goal' }))
    expect(mockSetWeeklyGoal).toHaveBeenLastCalledWith('p', 3)
    expect(screen.getByRole('button', { name: 'Raise General goal' })).toBeDisabled()
  })

  it('reverts and explains when saving fails', async () => {
    mockSetWeeklyGoal.mockRejectedValue(new Error('offline'))
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Raise Posture goal' }))
    expect(await screen.findByText("Couldn't save goal: offline")).toBeInTheDocument()
    expect(screen.getByText('3 / week')).toBeInTheDocument()
  })
})

describe('Settings habits', () => {
  const read = { id: 'h1', name: 'Read', tracking: 'check' as const, weeklyGoal: 3 }
  const screenTime = { id: 'st', name: 'Screen time', tracking: 'minutes' as const, weeklyGoal: 3 }

  beforeEach(() => {
    mockGetSettings.mockReset().mockResolvedValue(empty)
    mockListHabits.mockReset().mockImplementation((kind) => Promise.resolve(kind === 'habit' ? [read, screenTime] : []))
    vi.mocked(createHabit).mockReset()
    vi.mocked(renameHabit).mockReset().mockResolvedValue()
    vi.mocked(archiveHabit).mockReset().mockResolvedValue()
  })

  it('lists check-off habits but not built-in screen time', async () => {
    render(<Settings email="me@example.com" />)
    expect(await screen.findByText('Read')).toBeInTheDocument()
    expect(screen.queryByText('Screen time')).not.toBeInTheDocument()
  })

  it('adds a habit', async () => {
    vi.mocked(createHabit).mockResolvedValue({ id: 'h2', name: 'Meditate', tracking: 'check', weeklyGoal: 3 })
    render(<Settings email="me@example.com" />)
    fireEvent.change(await screen.findByLabelText('New habit'), { target: { value: ' Meditate ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByText('Meditate')).toBeInTheDocument()
    expect(createHabit).toHaveBeenCalledWith('Meditate')
    expect(screen.getByLabelText('New habit')).toHaveValue('')
  })

  it('explains a duplicate name and keeps what was typed', async () => {
    vi.mocked(createHabit).mockRejectedValue(new Error('You already have a habit called "Read".'))
    render(<Settings email="me@example.com" />)
    fireEvent.change(await screen.findByLabelText('New habit'), { target: { value: 'Read' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('You already have a habit called "Read".')
    expect(screen.getByLabelText('New habit')).toHaveValue('Read')
  })

  it('renames a habit', async () => {
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Rename Read' }))
    fireEvent.change(screen.getByLabelText('New name for Read'), { target: { value: 'Read 20 min' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('Read 20 min')).toBeInTheDocument()
    expect(renameHabit).toHaveBeenCalledWith('h1', 'Read 20 min')
  })

  it('removes a habit only after confirming', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    render(<Settings email="me@example.com" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Remove Read' }))
    expect(archiveHabit).not.toHaveBeenCalled()
    confirm.mockReturnValue(true)
    fireEvent.click(screen.getByRole('button', { name: 'Remove Read' }))
    await waitFor(() => expect(screen.queryByText('Read')).not.toBeInTheDocument())
    expect(archiveHabit).toHaveBeenCalledWith('h1')
    confirm.mockRestore()
  })

  it('switches a habit to ✓ / ✗ logging and back', async () => {
    vi.mocked(setHabitTracking).mockReset().mockResolvedValue()
    render(<Settings email="me@example.com" />)
    const box = await screen.findByRole('checkbox', { name: 'Log Read with ✓ / ✗' })
    expect(box).not.toBeChecked()
    fireEvent.click(box)
    await waitFor(() => expect(box).toBeChecked())
    expect(setHabitTracking).toHaveBeenCalledWith('h1', 'yesno')
    fireEvent.click(box)
    await waitFor(() => expect(box).not.toBeChecked())
    expect(setHabitTracking).toHaveBeenLastCalledWith('h1', 'check')
  })
})
