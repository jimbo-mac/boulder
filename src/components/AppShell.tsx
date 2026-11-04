import type { ReactNode } from 'react'
import { routeHref, type Route } from '../lib/router'

const TABS: { route: Route; label: string; icon: ReactNode }[] = [
  {
    route: 'log',
    label: 'Log',
    icon: <path d="M12 5v14M5 12h14" />,
  },
  {
    route: 'progress',
    label: 'Progress',
    icon: <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />,
  },
  {
    route: 'stretch',
    label: 'Stretch',
    // A figure with arms raised.
    icon: (
      <>
        <circle cx="12" cy="4" r="2" />
        <path d="M5 7l7 3 7-3M12 10v4M12 14l-4 7M12 14l4 7" />
      </>
    ),
  },
  {
    route: 'history',
    label: 'History',
    icon: <path d="M4 6h16M4 12h16M4 18h10" />,
  },
  {
    route: 'settings',
    label: 'Settings',
    icon: (
      <>
        <circle cx="12" cy="12" r="3" />
        <path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1" />
      </>
    ),
  },
]

function Icon({ children }: { children: ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className="h-6 w-6"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

/** Top tabs on desktop, bottom tab bar on phones (thumb reach). */
export function AppShell({ route, children }: { route: Route; children: ReactNode }) {
  return (
    <div className="min-h-dvh bg-stone-950 text-stone-100">
      <header className="hidden border-b border-stone-800 md:block">
        <nav
          aria-label="Main"
          className="mx-auto flex max-w-4xl items-center gap-1 px-6 py-3"
        >
          <span className="mr-6 text-xl font-bold tracking-tight">Boulder</span>
          {TABS.map((tab) => (
            <a
              key={tab.route}
              href={routeHref(tab.route)}
              aria-current={tab.route === route ? 'page' : undefined}
              className={`rounded-lg px-4 py-2 text-sm font-medium ${
                tab.route === route
                  ? 'bg-stone-800 text-stone-100'
                  : 'text-stone-400 hover:text-stone-200'
              }`}
            >
              {tab.label}
            </a>
          ))}
        </nav>
      </header>

      {/* Bottom padding clears the fixed phone tab bar and the iOS home indicator. */}
      <main className="mx-auto max-w-4xl px-4 pt-6 pb-[calc(5rem+env(safe-area-inset-bottom))] md:px-6 md:pb-10">
        {children}
      </main>

      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 border-t border-stone-800 bg-stone-950/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      >
        <div className="grid grid-cols-5">
          {TABS.map((tab) => (
            <a
              key={tab.route}
              href={routeHref(tab.route)}
              aria-current={tab.route === route ? 'page' : undefined}
              className={`flex h-16 flex-col items-center justify-center gap-1 text-xs font-medium ${
                tab.route === route ? 'text-stone-100' : 'text-stone-500'
              }`}
            >
              <Icon>{tab.icon}</Icon>
              {tab.label}
            </a>
          ))}
        </div>
      </nav>
    </div>
  )
}
