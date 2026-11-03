import { useSyncExternalStore } from 'react'

/** Tiny hash router: the current screen lives in the URL as #/log, #/progress, ... */
export const ROUTES = ['log', 'progress', 'history', 'settings'] as const
export type Route = (typeof ROUTES)[number]

const DESKTOP_QUERY = '(min-width: 768px)'

export function parseRoute(hash: string): Route | null {
  const name = hash.replace(/^#\/?/, '')
  return ROUTES.find((route) => route === name) ?? null
}

/** No screen in the URL: Log on phones, Progress on desktop. */
export function defaultRoute(): Route {
  const isDesktop =
    typeof window.matchMedia === 'function' && window.matchMedia(DESKTOP_QUERY).matches
  return isDesktop ? 'progress' : 'log'
}

export function routeHref(route: Route): string {
  return `#/${route}`
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

function currentRoute(): Route {
  return parseRoute(window.location.hash) ?? defaultRoute()
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, currentRoute)
}
