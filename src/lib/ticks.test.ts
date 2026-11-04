import { describe, expect, it } from 'vitest'
import { evenTicks, minuteTicks, paceTicks } from './ticks'

describe('paceTicks', () => {
  it('uses the finest step that fits', () => {
    // 8:10 .. 8:50 -> 15s steps from 8:00 to 9:00 = 5 ticks
    expect(paceTicks(490, 530)).toEqual([480, 495, 510, 525, 540])
  })
  it('widens the step for big ranges', () => {
    // 7:00 .. 11:00 -> 1m steps
    expect(paceTicks(420, 660)).toEqual([420, 480, 540, 600, 660])
  })
  it('gives a flat series some room', () => {
    expect(paceTicks(540, 540)).toEqual([540, 555])
  })
  it('rejects bad ranges', () => {
    expect(() => paceTicks(600, 500)).toThrow(RangeError)
    expect(() => paceTicks(Number.NaN, 500)).toThrow(RangeError)
  })
})

describe('minuteTicks', () => {
  it('steps by 30 minutes up to 1.5 hours', () => {
    expect(minuteTicks(0)).toEqual([0, 30])
    expect(minuteTicks(45)).toEqual([0, 30, 60])
    expect(minuteTicks(90)).toEqual([0, 30, 60, 90])
  })
  it('steps hourly up to 6 hours, then every 2 hours', () => {
    expect(minuteTicks(135)).toEqual([0, 60, 120, 180])
    expect(minuteTicks(360)).toEqual([0, 60, 120, 180, 240, 300, 360])
    expect(minuteTicks(500)).toEqual([0, 120, 240, 360, 480, 600])
  })
  it('rejects negative or non-finite input', () => {
    expect(() => minuteTicks(-1)).toThrow(RangeError)
    expect(() => minuteTicks(Number.NaN)).toThrow(RangeError)
  })
})

describe('evenTicks', () => {
  it('keeps everything when there are few items', () => {
    expect(evenTicks([1, 2, 3], 4)).toEqual([1, 2, 3])
  })
  it('spreads picks evenly, always including first and last', () => {
    const days = Array.from({ length: 24 }, (_, i) => i)
    expect(evenTicks(days, 4)).toEqual([0, 8, 15, 23])
    expect(evenTicks(Array.from({ length: 91 }, (_, i) => i), 4)).toEqual([0, 30, 60, 90])
  })
  it('handles max 1 and rejects bad max', () => {
    expect(evenTicks(['a', 'b'], 1)).toEqual(['a'])
    expect(evenTicks([], 4)).toEqual([])
    expect(() => evenTicks([1], 0)).toThrow(RangeError)
  })
})
