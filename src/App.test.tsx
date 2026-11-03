import { act, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { Session } from './lib/db/auth'
import App from './App'

let emit: (session: Session | null) => void = () => {}

vi.mock('./lib/db/auth', () => ({
  onSessionChange: (cb: (session: Session | null) => void) => {
    emit = cb
    return () => {}
  },
  sendCode: vi.fn(),
  verifyCode: vi.fn(),
  signOut: vi.fn(),
}))

vi.mock('./lib/db/settings', () => ({
  EMPTY_SETTINGS: {},
  getSettings: vi.fn().mockResolvedValue({
    goalRaceName: null,
    goalRaceDate: null,
    goalDistanceMi: null,
    goalTimeS: null,
  }),
  saveSettings: vi.fn(),
}))

vi.mock('./lib/db/runs', () => ({
  logRun: vi.fn(),
  runsBetween: vi.fn().mockResolvedValue([]),
}))

vi.mock('./lib/db/history', () => ({ listHistory: vi.fn().mockResolvedValue([]) }))

vi.mock('./lib/db/lifts', () => ({
  listExercises: vi.fn().mockResolvedValue([]),
  createExercise: vi.fn(),
  logLift: vi.fn(),
  setsForExercise: vi.fn().mockResolvedValue([]),
}))

const fakeSession = { user: { email: 'me@example.com' } } as Session

describe('App', () => {
  beforeEach(() => {
    emit = () => {}
    window.location.hash = ''
  })
  afterEach(() => {
    window.location.hash = ''
  })

  it('shows loading until the session is known', () => {
    render(<App />)
    expect(screen.getByText('Loading…')).toBeInTheDocument()
  })

  it('shows the sign-in screen when signed out', () => {
    render(<App />)
    act(() => emit(null))
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeInTheDocument()
  })

  it('opens on the Log screen on a phone when signed in', () => {
    render(<App />)
    act(() => emit(fakeSession))
    expect(screen.getByRole('button', { name: 'Save run' })).toBeInTheDocument()
  })

  it('switches screens when the hash changes', async () => {
    render(<App />)
    act(() => emit(fakeSession))
    act(() => {
      window.location.hash = '#/settings'
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    })
    expect(await screen.findByText('me@example.com')).toBeInTheDocument()
  })

  it('returns to sign-in after signing out', () => {
    render(<App />)
    act(() => emit(fakeSession))
    act(() => emit(null))
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeInTheDocument()
  })
})
