import { AuthGate } from './components/AuthGate'
import { Home } from './pages/Home'

export default function App() {
  return <AuthGate>{(session) => <Home email={session.user.email ?? ''} />}</AuthGate>
}
