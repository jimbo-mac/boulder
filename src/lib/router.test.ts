import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultRoute, editWorkoutHref, parseLocation, parseRoute } from './router'

describe('parseRoute', () => {
  it('reads known screens from the hash', () => {
    expect(parseRoute('#/log')).toBe('log')
    expect(parseRoute('#/history')).toBe('history')
    expect(parseRoute('#progress')).toBe('progress')
  })
  it('returns null for empty or unknown hashes', () => {
    expect(parseRoute('')).toBeNull()
    expect(parseRoute('#/')).toBeNull()
    expect(parseRoute('#/nope')).toBeNull()
  })
})

describe('parseLocation', () => {
  it('reads a workout id under History', () => {
    expect(parseLocation('#/history/abc-123')).toEqual({ route: 'history', workoutId: 'abc-123' })
    expect(parseLocation(editWorkoutHref('abc-123'))).toEqual({ route: 'history', workoutId: 'abc-123' })
  })
  it('has no workout id on plain screens', () => {
    expect(parseLocation('#/history')).toEqual({ route: 'history', workoutId: null })
    expect(parseLocation('#/history/')).toEqual({ route: 'history', workoutId: null })
  })
  it('rejects ids on other screens and extra segments', () => {
    expect(parseLocation('#/log/abc')).toBeNull()
    expect(parseLocation('#/history/abc/def')).toBeNull()
  })
})

describe('defaultRoute', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  function stubWidth(isDesktop: boolean) {
    vi.stubGlobal('matchMedia', (query: string) => ({ matches: isDesktop, media: query }))
  }

  it('is Log on phones', () => {
    stubWidth(false)
    expect(defaultRoute()).toBe('log')
  })
  it('is Progress on desktop', () => {
    stubWidth(true)
    expect(defaultRoute()).toBe('progress')
  })
})
