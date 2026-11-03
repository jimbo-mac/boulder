import { useEffect, useState, type ReactNode } from 'react'
import { onSessionChange, type Session } from '../lib/db/auth'
import { SignIn } from '../pages/SignIn'
import { Screen } from './Screen'

/** Shows the sign-in screen until there is a session, then renders children. */
export function AuthGate({ children }: { children: (session: Session) => ReactNode }) {
  // undefined = still checking, null = signed out
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => onSessionChange(setSession), [])

  if (session === undefined) {
    return (
      <Screen>
        <p className="text-center text-stone-400">Loading…</p>
      </Screen>
    )
  }
  if (session === null) return <SignIn />
  return children(session)
}
