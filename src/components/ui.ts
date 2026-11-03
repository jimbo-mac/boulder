/** Shared Tailwind class strings. 16px text on inputs stops iOS from zooming in. */

export const inputClass =
  'h-12 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 text-base text-stone-100 placeholder:text-stone-500 focus:border-stone-400 focus:outline-none'

export const primaryButtonClass =
  'h-12 w-full rounded-lg bg-stone-100 text-base font-semibold text-stone-950 active:bg-stone-300 disabled:opacity-40'

export const secondaryButtonClass =
  'h-12 w-full rounded-lg border border-stone-700 text-base text-stone-200 active:bg-stone-800 disabled:opacity-40'

export const linkButtonClass = 'py-2 text-sm text-stone-400 underline underline-offset-4'

export const labelClass = 'text-sm font-medium text-stone-300'

export const cardClass = 'rounded-xl border border-stone-800 bg-stone-900 p-4'

/** Segmented control / chip: pass `selected` to style the active one. */
export function chipClass(selected: boolean): string {
  return `h-11 rounded-lg px-3 text-base font-medium transition-colors ${
    selected
      ? 'bg-stone-100 text-stone-950'
      : 'border border-stone-700 text-stone-300 active:bg-stone-800'
  }`
}

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String(err.message)
  }
  return 'Something went wrong. Try again.'
}
