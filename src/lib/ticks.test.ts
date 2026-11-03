import { describe, expect, it } from 'vitest'
import { paceTicks } from './ticks'

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
