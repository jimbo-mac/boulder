import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { listHabits, setWeeklyGoal } from '../lib/db/habits'
import { getSettings, saveSettings } from '../lib/db/settings'
import { Settings } from './Settings'

vi.mock('../lib/db/auth', () => ({ signOut: vi.fn() }))
vi.mock('../lib/db/habits', () => ({ listHabits: vi.fn(), setWeeklyGoal: vi.fn() }))
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
    mockListHabits.mockReset().mockResolvedValue([
      { id: 'p', name: 'Posture', weeklyGoal: 3 },
      { id: 'g', name: 'General', weeklyGoal: 7 },
    ])
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
