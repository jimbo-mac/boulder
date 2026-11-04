import { lazy, Suspense } from 'react'
import { AppShell } from './components/AppShell'
import { AuthGate } from './components/AuthGate'
import { useLocation, type Location } from './lib/router'
import { EditWorkout } from './pages/EditWorkout'
import { History } from './pages/History'
import { Log } from './pages/Log'
import { Settings } from './pages/Settings'

// Charts (Recharts) are big; load them only when Progress is opened.
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })))

function Page({ location, email }: { location: Location; email: string }) {
  switch (location.route) {
    case 'log':
      return <Log />
    case 'progress':
      return (
        <Suspense fallback={<p className="text-stone-400">Loading…</p>}>
          <Progress />
        </Suspense>
      )
    case 'history':
      return location.workoutId ? (
        <EditWorkout key={location.workoutId} workoutId={location.workoutId} />
      ) : (
        <History />
      )
    case 'settings':
      return <Settings email={email} />
  }
}

function SignedInApp({ email }: { email: string }) {
  const location = useLocation()
  return (
    <AppShell route={location.route}>
      <Page location={location} email={email} />
    </AppShell>
  )
}

export default function App() {
  return <AuthGate>{(session) => <SignedInApp email={session.user.email ?? ''} />}</AuthGate>
}
