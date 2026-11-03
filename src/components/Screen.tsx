import type { ReactNode } from 'react'

/** Full-height centered column used by simple screens (sign-in, loading). */
export function Screen({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center bg-stone-950 px-6 py-10 text-stone-100">
      <div className="flex w-full max-w-sm flex-col gap-6">{children}</div>
    </main>
  )
}
