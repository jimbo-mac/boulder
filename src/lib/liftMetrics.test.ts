import { describe, expect, it } from 'vitest'
import { estimate1RM, liftPRs, oneRepMaxByDay, repsByDay, setVolume, totalVolume, weeklyVolume } from './metrics'

describe('repsByDay', () => {
  const set = (date: string, reps: number, isWarmup = false) => ({ date, weightLb: 0, reps, isWarmup })

  it('gives best set and total working reps per day, oldest first', () => {
    expect(
      repsByDay([set('2026-11-04', 10), set('2026-11-04', 8), set('2026-11-01', 7), set('2026-11-04', 5, true)]),
    ).toEqual([
      { date: '2026-11-01', bestSet: 7, totalReps: 7, workingSets: 1 },
      { date: '2026-11-04', bestSet: 10, totalReps: 18, workingSets: 2 },
    ])
  })
  it('skips days with only warm-ups', () => {
    expect(repsByDay([set('2026-11-01', 5, true)])).toEqual([])
  })
  it('rejects invalid reps', () => {
    expect(() => repsByDay([set('2026-11-01', 0)])).toThrow(RangeError)
  })
})

describe('estimate1RM (Epley)', () => {
  it('is weight × (1 + reps/30)', () => {
    expect(estimate1RM(225, 5).value).toBeCloseTo(262.5, 6)
    expect(estimate1RM(100, 10).value).toBeCloseTo(133.333, 3)
  })
  it('returns the weight itself for a single rep', () => {
    expect(estimate1RM(315, 1)).toEqual({ value: 315, lowConfidence: false })
  })
  it('flags more than 12 reps as low confidence', () => {
    expect(estimate1RM(100, 12).lowConfidence).toBe(false)
    expect(estimate1RM(100, 13).lowConfidence).toBe(true)
  })
  it('rejects zero/negative weight and invalid reps', () => {
    expect(() => estimate1RM(0, 5)).toThrow(RangeError)
    expect(() => estimate1RM(-10, 5)).toThrow(RangeError)
    expect(() => estimate1RM(100, 0)).toThrow(RangeError)
    expect(() => estimate1RM(100, 2.5)).toThrow(RangeError)
  })
})

describe('setVolume / totalVolume', () => {
  it('is weight × reps', () => {
    expect(setVolume({ weightLb: 135, reps: 10, isWarmup: false })).toBe(1350)
  })
  it('excludes warm-ups', () => {
    expect(setVolume({ weightLb: 95, reps: 5, isWarmup: true })).toBe(0)
  })
  it('allows bodyweight (0 lb) sets', () => {
    expect(setVolume({ weightLb: 0, reps: 10, isWarmup: false })).toBe(0)
  })
  it('rejects negative weight and invalid reps', () => {
    expect(() => setVolume({ weightLb: -5, reps: 5, isWarmup: false })).toThrow(RangeError)
    expect(() => setVolume({ weightLb: 100, reps: 0, isWarmup: false })).toThrow(RangeError)
  })
  it('sums working sets', () => {
    expect(
      totalVolume([
        { weightLb: 95, reps: 5, isWarmup: true },
        { weightLb: 135, reps: 5, isWarmup: false },
        { weightLb: 135, reps: 5, isWarmup: false },
      ]),
    ).toBe(1350)
  })
})

describe('oneRepMaxByDay', () => {
  const set = (date: string, weightLb: number, reps: number, isWarmup = false) => ({
    date,
    weightLb,
    reps,
    isWarmup,
  })

  it('keeps the best set per day, oldest first', () => {
    const points = oneRepMaxByDay([
      set('2026-11-03', 225, 5), // 262.5
      set('2026-11-01', 205, 5),
      set('2026-11-03', 245, 1), // 245
      set('2026-11-03', 235, 3), // 258.5
    ])
    expect(points.map((p) => p.date)).toEqual(['2026-11-01', '2026-11-03'])
    expect(points[1]).toMatchObject({ weightLb: 225, reps: 5, lowConfidence: false })
    expect(points[1]?.value).toBeCloseTo(262.5, 6)
  })

  it('ignores warm-ups and bodyweight sets', () => {
    expect(oneRepMaxByDay([set('2026-11-01', 315, 1, true), set('2026-11-01', 0, 10)])).toEqual([])
  })

  it('prefers a confident estimate over a higher low-confidence one', () => {
    const [point] = oneRepMaxByDay([set('2026-11-01', 135, 20), set('2026-11-01', 185, 5)])
    // 135 × 20 reps = 225 (low confidence) vs 185 × 5 = 215.8 (confident)
    expect(point).toMatchObject({ weightLb: 185, lowConfidence: false })
  })

  it('uses a low-confidence estimate when that is all there is', () => {
    const [point] = oneRepMaxByDay([set('2026-11-01', 50, 15)])
    expect(point).toMatchObject({ weightLb: 50, reps: 15, lowConfidence: true })
  })
})

describe('liftPRs', () => {
  const set = (date: string, weightLb: number, reps: number, isWarmup = false) => ({ date, weightLb, reps, isWarmup })

  it('marks days whose best est. 1RM beats every earlier day; the first day is a baseline', () => {
    const prs = liftPRs(
      [
        set('2026-11-01', 185, 5), // 215.8 baseline
        set('2026-11-03', 185, 5), // tie: not a PR
        set('2026-11-05', 195, 5), // 227.5 PR
        set('2026-11-05', 200, 3), // 220 (not the day's best)
        set('2026-11-08', 190, 5), // below best
        set('2026-11-10', 205, 5), // 239.2 PR
      ],
      'weight',
    )
    expect(prs.map((p) => [p.date, p.weightLb, p.reps])).toEqual([
      ['2026-11-05', 195, 5],
      ['2026-11-10', 205, 5],
    ])
    expect(prs[0]?.value).toBeCloseTo(227.5, 6)
    expect(prs[0]?.previousBest).toBeCloseTo(215.833, 3)
    expect(prs[1]?.previousBest).toBeCloseTo(227.5, 6)
  })

  it('ignores warm-ups, 0 lb sets, and sets over 12 reps', () => {
    const prs = liftPRs(
      [
        set('2026-11-01', 100, 5),
        set('2026-11-02', 300, 5, true), // warm-up
        set('2026-11-03', 0, 50), // bodyweight
        set('2026-11-04', 150, 15), // low-confidence
      ],
      'weight',
    )
    expect(prs).toEqual([])
  })

  it('does not let a low-confidence set become the baseline', () => {
    const prs = liftPRs([set('2026-11-01', 150, 20), set('2026-11-02', 100, 5)], 'weight')
    expect(prs).toEqual([]) // first counted day is Nov 2: a baseline
  })

  it('sorts by date first', () => {
    const prs = liftPRs([set('2026-11-05', 200, 5), set('2026-11-01', 185, 5)], 'weight')
    expect(prs.map((p) => p.date)).toEqual(['2026-11-05'])
  })

  it('uses most reps in a set for reps-only lifts', () => {
    const prs = liftPRs(
      [set('2026-11-01', 0, 8), set('2026-11-03', 0, 8), set('2026-11-05', 0, 10), set('2026-11-05', 0, 12, true)],
      'reps',
    )
    expect(prs).toEqual([{ date: '2026-11-05', value: 10, previousBest: 8, weightLb: 0, reps: 10 }])
  })

  it('is empty with no sets or one day', () => {
    expect(liftPRs([], 'weight')).toEqual([])
    expect(liftPRs([set('2026-11-01', 100, 5)], 'weight')).toEqual([])
  })
})

describe('weeklyVolume', () => {
  const set = (date: string, weightLb: number, reps: number, isWarmup = false) => ({ date, weightLb, reps, isWarmup })

  it('sums weight × reps per Monday week, zero-filling empty weeks', () => {
    // Mon Nov 2 2026 starts a week; Nov 16 week has nothing.
    expect(
      weeklyVolume(
        [set('2026-11-02', 100, 5), set('2026-11-08', 100, 5), set('2026-11-09', 50, 10), set('2026-11-09', 45, 10, true)],
        '2026-11-03',
        '2026-11-20',
        'weight',
      ),
    ).toEqual([
      { weekStart: '2026-11-02', value: 1000 },
      { weekStart: '2026-11-09', value: 500 },
      { weekStart: '2026-11-16', value: 0 },
    ])
  })

  it('sums reps for reps-only lifts', () => {
    expect(
      weeklyVolume([set('2026-11-02', 0, 8), set('2026-11-03', 0, 6), set('2026-11-03', 0, 5, true)], '2026-11-02', '2026-11-02', 'reps'),
    ).toEqual([{ weekStart: '2026-11-02', value: 14 }])
  })

  it('ignores sets outside the range', () => {
    expect(weeklyVolume([set('2026-10-01', 100, 5)], '2026-11-02', '2026-11-02', 'weight')).toEqual([
      { weekStart: '2026-11-02', value: 0 },
    ])
  })

  it('rounds away floating-point noise', () => {
    expect(weeklyVolume([set('2026-11-02', 0.1, 1), set('2026-11-02', 0.2, 1)], '2026-11-02', '2026-11-02', 'weight'))
      .toEqual([{ weekStart: '2026-11-02', value: 0.3 }])
  })

  it('rejects a backwards range and invalid sets', () => {
    expect(() => weeklyVolume([], '2026-11-20', '2026-11-02', 'weight')).toThrow(RangeError)
    expect(() => weeklyVolume([set('2026-11-02', -5, 5)], '2026-11-02', '2026-11-02', 'weight')).toThrow(RangeError)
    expect(() => weeklyVolume([set('2026-11-02', 0, 0)], '2026-11-02', '2026-11-02', 'reps')).toThrow(RangeError)
  })
})
