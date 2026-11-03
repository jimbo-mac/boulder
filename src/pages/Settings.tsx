import { useState } from 'react'
import { cardClass, errorMessage, secondaryButtonClass } from '../components/ui'
import { signOut } from '../lib/db/auth'

export function Settings({ email }: { email: string }) {
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <h1 className="text-2xl font-bold tracking-tight">Settings</h1>
      <section className={cardClass}>
        <p className="text-sm text-stone-400">Signed in as</p>
        <p className="font-medium break-all">{email}</p>
      </section>
      <p className="text-sm text-stone-500">Goal race settings are coming soon.</p>
      <button
        type="button"
        onClick={() => signOut().catch((err: unknown) => setError(errorMessage(err)))}
        className={secondaryButtonClass}
      >
        Sign out
      </button>
      {error && (
        <p role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  )
}
