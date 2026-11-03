import { useState, type FormEvent } from 'react'
import { Screen } from '../components/Screen'
import { sendCode, verifyCode } from '../lib/db/auth'

const input =
  'h-12 w-full rounded-lg border border-stone-700 bg-stone-900 px-4 text-base text-stone-100 placeholder:text-stone-500 focus:border-stone-400 focus:outline-none'
const primaryButton =
  'h-12 w-full rounded-lg bg-stone-100 text-base font-semibold text-stone-950 active:bg-stone-300 disabled:opacity-50'
const linkButton = 'py-2 text-sm text-stone-400 underline underline-offset-4'

function message(err: unknown): string {
  return err instanceof Error ? err.message : 'Something went wrong. Try again.'
}

export function SignIn() {
  const [step, setStep] = useState<'email' | 'code'>('email')
  const [email, setEmail] = useState('')
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function run(action: () => Promise<void>) {
    setBusy(true)
    setError(null)
    try {
      await action()
    } catch (err) {
      setError(message(err))
    } finally {
      setBusy(false)
    }
  }

  function onSendCode(e: FormEvent) {
    e.preventDefault()
    void run(async () => {
      await sendCode(email.trim().toLowerCase())
      setStep('code')
    })
  }

  function onVerify(e: FormEvent) {
    e.preventDefault()
    // On success AuthGate sees the new session and swaps this screen out.
    void run(() => verifyCode(email.trim().toLowerCase(), code.trim()))
  }

  return (
    <Screen>
      <header className="text-center">
        <h1 className="text-4xl font-bold tracking-tight">Boulder</h1>
        <p className="mt-2 text-stone-400 italic">One must imagine Sisyphus happy.</p>
      </header>

      {step === 'email' ? (
        <form onSubmit={onSendCode} className="flex flex-col gap-3">
          <label htmlFor="email" className="text-sm text-stone-300">
            Email
          </label>
          <input
            id="email"
            type="email"
            inputMode="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={input}
          />
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? 'Sending…' : 'Email me a code'}
          </button>
        </form>
      ) : (
        <form onSubmit={onVerify} className="flex flex-col gap-3">
          <label htmlFor="code" className="text-sm text-stone-300">
            Code sent to {email.trim()}
          </label>
          <input
            id="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6,10}"
            maxLength={10}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
            className={`${input} text-center text-2xl tracking-[0.4em]`}
          />
          <button type="submit" disabled={busy} className={primaryButton}>
            {busy ? 'Checking…' : 'Sign in'}
          </button>
          <div className="flex justify-between">
            <button
              type="button"
              className={linkButton}
              onClick={() => {
                setStep('email')
                setCode('')
                setError(null)
              }}
            >
              Different email
            </button>
            <button
              type="button"
              className={linkButton}
              disabled={busy}
              onClick={() => void run(() => sendCode(email.trim().toLowerCase()))}
            >
              Resend code
            </button>
          </div>
        </form>
      )}

      {error && (
        <p role="alert" className="rounded-lg bg-red-950 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
    </Screen>
  )
}
