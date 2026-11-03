/** Human-readable message from anything thrown (Error, Supabase error object, ...). */
export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'object' && err !== null && 'message' in err) {
    return String(err.message)
  }
  return 'Something went wrong. Try again.'
}
