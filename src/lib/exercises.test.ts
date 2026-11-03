import { describe, expect, it } from 'vitest'
import { nameKey, normalizeName, pickerOptions, type Exercise } from './exercises'

const catalog: Exercise[] = [
  { id: '1', name: 'Bench Press', category: 'push' },
  { id: '2', name: 'Goblet Squat', category: 'squat' },
]

describe('nameKey / normalizeName', () => {
  it('ignores case and extra spaces', () => {
    expect(nameKey('  Back   SQUAT ')).toBe('back squat')
    expect(normalizeName('  Back   Squat ')).toBe('Back Squat')
  })
})

describe('pickerOptions', () => {
  it('lists the catalog and unowned suggestions for an empty query', () => {
    const options = pickerOptions(catalog, '')
    expect(options.matches.map((e) => e.name)).toEqual(['Bench Press', 'Goblet Squat'])
    expect(options.suggestions.map((s) => s.name)).not.toContain('Bench Press')
    expect(options.suggestions.map((s) => s.name)).toContain('Back Squat')
    expect(options.canCreate).toBe(false)
  })

  it('filters by substring, case-insensitively', () => {
    const options = pickerOptions(catalog, 'SQU')
    expect(options.matches.map((e) => e.name)).toEqual(['Goblet Squat'])
    expect(options.suggestions.map((s) => s.name)).toEqual(['Back Squat', 'Front Squat'])
  })

  it('ignores punctuation, spaces, and a plural s when searching', () => {
    for (const query of ['pullup', 'pull up', 'Pull-ups', 'pullups']) {
      expect(pickerOptions(catalog, query).suggestions.map((s) => s.name)).toContain('Pull-up')
    }
    expect(pickerOptions(catalog, 'curls').suggestions.map((s) => s.name)).toEqual([
      'Bicep Curl',
      'Reverse Curl',
    ])
  })

  it('offers create only for a new name', () => {
    expect(pickerOptions(catalog, 'Hip Thrust').canCreate).toBe(true)
    expect(pickerOptions(catalog, 'bench press ').canCreate).toBe(false)
    expect(pickerOptions(catalog, 'deadlift').canCreate).toBe(false) // it's a suggestion
  })
})
