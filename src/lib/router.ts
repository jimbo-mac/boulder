import { useSyncExternalStore } from 'react'

/** Tiny hash router: the current screen lives in the URL as #/log, #/progress, ... */
export const ROUTES = ['log', 'progress', 'history', 'settings'] as const
export type Route = (typeof ROUTES)[number]

const DESKTOP_QUERY = '(min-width: 768px)'

export interface Location {
  route: Route
  /** `#/history/<id>`: the workout being edited. */
  workoutId: string | null
}

export function parseRoute(hash: string): Route | null {
  return parseLocation(hash)?.route ?? null
}

export function parseLocation(hash: string): Location | null {
  const [name, id, ...rest] = hash.replace(/^#\/?/, '').split('/')
  const route = ROUTES.find((r) => r === name)
  if (!route || rest.length > 0) return null
  if (id === undefined || id === '') return { route, workoutId: null }
  return route === 'history' ? { route, workoutId: decodeURIComponent(id) } : null
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

export function editWorkoutHref(workoutId: string): string {
  return `#/history/${encodeURIComponent(workoutId)}`
}

export function navigate(href: string): void {
  window.location.hash = href
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

// useSyncExternalStore needs a stable snapshot, so cache by hash.
let cached: { hash: string; location: Location } | null = null

function currentLocation(): Location {
  const hash = window.location.hash
  if (cached?.hash !== hash) {
    cached = { hash, location: parseLocation(hash) ?? { route: defaultRoute(), workoutId: null } }
  }
  return cached.location
}

export function useLocation(): Location {
  return useSyncExternalStore(subscribe, currentLocation)
}
