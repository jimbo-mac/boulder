import { useState } from 'react'
import { Screen } from '../components/Screen'
import { signOut } from '../lib/db/auth'

/** Placeholder signed-in screen until the real pages arrive in slice 3. */
export function Home({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)

  return (
    <Screen>
      <header className="text-center">
        <h1 className="text-5xl font-bold tracking-tight">Boulder</h1>
        <p className="mt-2 text-stone-400 italic">One must imagine Sisyphus happy.</p>
      </header>
      <p className="text-center text-stone-300">Signed in as {email}</p>
      <button
        type="button"
        onClick={() => signOut().catch((err: unknown) => setError(String(err)))}
        className="h-12 w-full rounded-lg border border-stone-700 text-base text-stone-200 active:bg-stone-800"
      >
        Sign out
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </Screen>
  )
}
