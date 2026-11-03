import { act, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
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

const fakeSession = { user: { email: 'me@example.com' } } as Session

describe('App auth gate', () => {
  beforeEach(() => {
    emit = () => {}
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

  it('shows the app when signed in, and returns to sign-in after sign-out', () => {
    render(<App />)
    act(() => emit(fakeSession))
    expect(screen.getByText('Signed in as me@example.com')).toBeInTheDocument()
    act(() => emit(null))
    expect(screen.getByRole('button', { name: 'Email me a code' })).toBeInTheDocument()
  })
})
