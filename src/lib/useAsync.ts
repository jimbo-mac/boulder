import { useEffect, useRef, useState } from 'react'
import { errorMessage } from './errors'

export interface AsyncState<T> {
  /** Latest loaded value. While reloading for a new key, the previous value is kept. */
  data: T | undefined
  /** The key `data` was loaded for. */
  dataKey: string | undefined
  loading: boolean
  error: string | null
}

/**
 * Run `load` whenever `key` changes. Only the newest request may update state,
 * so a slow old response can never overwrite a newer one.
 */
export function useAsync<T>(key: string, load: () => Promise<T>): AsyncState<T> {
  const [result, setResult] = useState<{ key: string; data?: T; error: string | null } | null>(
    null,
  )
  const latestKey = useRef(key)

  useEffect(() => {
    latestKey.current = key
    load().then(
      (data) => {
        if (latestKey.current === key) setResult({ key, data, error: null })
      },
      (err: unknown) => {
        if (latestKey.current === key) setResult({ key, error: errorMessage(err) })
      },
    )
    // `load` is a fresh closure every render; `key` is what identifies the request.
  }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  const loading = result?.key !== key
  return {
    data: result?.data,
    dataKey: result?.key,
    loading,
    error: loading ? null : (result?.error ?? null),
  }
}
