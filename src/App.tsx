import { lazy, Suspense } from 'react'
import { AppShell } from './components/AppShell'
import { AuthGate } from './components/AuthGate'
import { useRoute, type Route } from './lib/router'
import { History } from './pages/History'
import { Log } from './pages/Log'
import { Settings } from './pages/Settings'

// Charts (Recharts) are big; load them only when Progress is opened.
const Progress = lazy(() => import('./pages/Progress').then((m) => ({ default: m.Progress })))

function Page({ route, email }: { route: Route; email: string }) {
  switch (route) {
    case 'log':
      return <Log />
    case 'progress':
      return (
        <Suspense fallback={<p className="text-stone-400">Loading…</p>}>
          <Progress />
        </Suspense>
      )
    case 'history':
      return <History />
    case 'settings':
      return <Settings email={email} />
  }
}

function SignedInApp({ email }: { email: string }) {
  const route = useRoute()
  return (
    <AppShell route={route}>
      <Page route={route} email={email} />
    </AppShell>
  )
}

export default function App() {
  return <AuthGate>{(session) => <SignedInApp email={session.user.email ?? ''} />}</AuthGate>
}
