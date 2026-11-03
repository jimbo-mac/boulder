import { afterEach, describe, expect, it, vi } from 'vitest'
import { defaultRoute, parseRoute } from './router'

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
