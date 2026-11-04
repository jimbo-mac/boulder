import { describe, expect, it } from 'vitest'
import { daysDoneInMonth, goalPace, pace, paceTrend, predictRaceTime, riegel, runPRs, weeklyGoalProgress, weeklyMileage, type RunPRInput } from './metrics'

describe('riegel', () => {
  it('returns the same time for the same distance', () => {
    expect(riegel(1500, 3.1, 3.1)).toBe(1500)
  })
  it('scales by (D2/D1)^1.06', () => {
    // 25:00 5K -> 10K: 1500 * 2^1.06 = 3127.5
    expect(riegel(1500, 3.1, 6.2)).toBeCloseTo(1500 * 2 ** 1.06, 6)
    expect(riegel(1500, 3.1, 6.2)).toBeCloseTo(3127.5, 0)
  })
  it('rejects zero and negative inputs', () => {
    expect(() => riegel(0, 3.1, 6.2)).toThrow(RangeError)
    expect(() => riegel(1500, 0, 6.2)).toThrow(RangeError)
    expect(() => riegel(1500, 3.1, -1)).toThrow(RangeError)
  })
})

describe('goalPace', () => {
  it('is goal time over goal distance', () => {
    expect(goalPace(6000, 13.1)).toBeCloseTo(458.02, 2) // 1:40 half -> 7:38/mi
  })
  it('rejects zero inputs', () => {
    expect(() => goalPace(0, 13.1)).toThrow(RangeError)
    expect(() => goalPace(6000, 0)).toThrow(RangeError)
  })
})

describe('predictRaceTime', () => {
  const runs = [
    { date: '2026-10-01', distanceMi: 6, durationS: 3300 }, // 9:10/mi
    { date: '2026-10-08', distanceMi: 4, durationS: 2000 }, // 8:20/mi, best effort
    { date: '2026-10-10', distanceMi: 2, durationS: 840 }, // 7:00/mi but too short
  ]

  it('uses the run that predicts the fastest time', () => {
    const prediction = predictRaceTime(runs, 13.1)
    expect(prediction?.basedOn.date).toBe('2026-10-08')
    expect(prediction?.timeS).toBeCloseTo(riegel(2000, 4, 13.1), 6)
  })
  it('ignores runs shorter than the minimum distance', () => {
    expect(predictRaceTime([runs[2]!], 13.1)).toBeNull()
    expect(predictRaceTime([runs[2]!], 13.1, 1)?.basedOn.date).toBe('2026-10-10')
  })
  it('returns null with no runs', () => {
    expect(predictRaceTime([], 13.1)).toBeNull()
  })
  it('rejects a non-positive target', () => {
    expect(() => predictRaceTime(runs, 0)).toThrow(RangeError)
  })
})

describe('paceTrend', () => {
  // 1 mile runs make paces easy to read: durationS === pace.
  const mile = (date: string, durationS: number) => ({ date, distanceMi: 1, durationS })

  it('returns nothing for no runs', () => {
    expect(paceTrend([])).toEqual({ points: [], improvement: null })
  })

  it('has no improvement with a single run', () => {
    expect(paceTrend([mile('2026-11-01', 600)])).toEqual({
      points: [{ date: '2026-11-01', pace: 600, avg: 600 }],
      improvement: null,
    })
  })

  it('averages over a trailing window, partial at the start', () => {
    const runs = [
      mile('2026-11-01', 600),
      mile('2026-11-02', 570),
      mile('2026-11-03', 540),
      mile('2026-11-04', 510),
    ]
    expect(paceTrend(runs, 3).points.map((p) => p.avg)).toEqual([600, 585, 570, 540])
  })

  it('weights the average by distance, not by run count', () => {
    const runs = [
      { date: '2026-11-01', distanceMi: 1, durationS: 600 }, // 10:00
      { date: '2026-11-02', distanceMi: 9, durationS: 4500 }, // 8:20
    ]
    // (600 + 4500) / 10 = 510, not (600 + 500) / 2 = 550
    expect(paceTrend(runs).points[1]?.avg).toBe(510)
  })

  it('reports improvement as first-k pace minus last-k pace (positive = faster)', () => {
    const runs = [
      mile('2026-10-01', 600),
      mile('2026-10-02', 590),
      mile('2026-10-03', 560),
      mile('2026-10-04', 550),
    ]
    // k = min(5, 2) = 2: (600+590)/2 - (560+550)/2 = 40
    expect(paceTrend(runs).improvement).toBe(40)
  })

  it('reports slowing down as negative improvement', () => {
    const runs = [mile('2026-10-01', 500), mile('2026-10-02', 520)]
    expect(paceTrend(runs).improvement).toBe(-20)
  })

  it('caps k at the window size', () => {
    const paces = [700, 700, 600, 600, 600, 600, 600, 600, 500, 500]
    const runs = paces.map((p, i) => mile(`2026-10-${String(i + 1).padStart(2, '0')}`, p))
    // k = 2: (700+700)/2 - (500+500)/2 = 200
    expect(paceTrend(runs, 2).improvement).toBe(200)
  })

  it('rejects unsorted runs, invalid runs, and bad windows', () => {
    expect(() => paceTrend([mile('2026-11-02', 600), mile('2026-11-01', 600)])).toThrow(RangeError)
    expect(() => paceTrend([mile('2026-11-01', 0)])).toThrow(RangeError)
    expect(() => paceTrend([], 0)).toThrow(RangeError)
  })
})

describe('pace', () => {
  it('is seconds per mile', () => {
    expect(pace(2730, 5)).toBe(546)
    expect(pace(3600, 6.2)).toBeCloseTo(580.645, 3)
  })
  it('rejects zero, negative, and non-finite inputs', () => {
    expect(() => pace(0, 5)).toThrow(RangeError)
    expect(() => pace(2730, 0)).toThrow(RangeError)
    expect(() => pace(-1, 5)).toThrow(RangeError)
    expect(() => pace(2730, -5)).toThrow(RangeError)
    expect(() => pace(Number.NaN, 5)).toThrow(RangeError)
    expect(() => pace(2730, Number.POSITIVE_INFINITY)).toThrow(RangeError)
  })
})

describe('weeklyMileage', () => {
  it('sums runs per Monday-start week', () => {
    const runs = [
      { date: '2026-11-02', distanceMi: 3 }, // Mon
      { date: '2026-11-08', distanceMi: 5 }, // Sun, same week
      { date: '2026-11-09', distanceMi: 4 }, // next Mon
    ]
    expect(weeklyMileage(runs, '2026-11-02', '2026-11-09')).toEqual([
      { weekStart: '2026-11-02', miles: 8 },
      { weekStart: '2026-11-09', miles: 4 },
    ])
  })

  it('shows weeks with no runs as 0', () => {
    const runs = [
      { date: '2026-10-19', distanceMi: 3 },
      { date: '2026-11-04', distanceMi: 6 },
    ]
    expect(weeklyMileage(runs, '2026-10-19', '2026-11-04')).toEqual([
      { weekStart: '2026-10-19', miles: 3 },
      { weekStart: '2026-10-26', miles: 0 },
      { weekStart: '2026-11-02', miles: 6 },
    ])
  })

  it('returns all-zero weeks when there are no runs', () => {
    expect(weeklyMileage([], '2026-11-02', '2026-11-16')).toEqual([
      { weekStart: '2026-11-02', miles: 0 },
      { weekStart: '2026-11-09', miles: 0 },
      { weekStart: '2026-11-16', miles: 0 },
    ])
  })

  it('expands mid-week range ends to whole weeks and ignores runs outside', () => {
    const runs = [
      { date: '2026-10-25', distanceMi: 10 }, // Sun before range
      { date: '2026-10-28', distanceMi: 2 },
      { date: '2026-11-10', distanceMi: 10 }, // after range
    ]
    expect(weeklyMileage(runs, '2026-10-29', '2026-11-03')).toEqual([
      { weekStart: '2026-10-26', miles: 2 },
      { weekStart: '2026-11-02', miles: 0 },
    ])
  })

  it('handles a week that crosses the DST change', () => {
    const runs = [
      { date: '2026-10-31', distanceMi: 4 }, // Sat
      { date: '2026-11-01', distanceMi: 6 }, // Sun, DST ends
    ]
    expect(weeklyMileage(runs, '2026-10-26', '2026-11-01')).toEqual([
      { weekStart: '2026-10-26', miles: 10 },
    ])
  })

  it('rounds away floating-point noise', () => {
    const runs = [
      { date: '2026-11-02', distanceMi: 0.1 },
      { date: '2026-11-03', distanceMi: 0.2 },
    ]
    expect(weeklyMileage(runs, '2026-11-02', '2026-11-02')).toEqual([
      { weekStart: '2026-11-02', miles: 0.3 },
    ])
  })

  it('rejects an inverted range and invalid distances', () => {
    expect(() => weeklyMileage([], '2026-11-09', '2026-11-02')).toThrow(RangeError)
    expect(() =>
      weeklyMileage([{ date: '2026-11-02', distanceMi: 0 }], '2026-11-02', '2026-11-02'),
    ).toThrow(RangeError)
  })
})

describe('runPRs', () => {
  let n = 0
  const run = (date: string, kind: RunPRInput['kind'], distanceMi: number, durationS: number): RunPRInput => {
    n += 1
    return { workoutId: `r${n}`, date, kind, distanceMi, durationS }
  }

  it('long runs: a PR is a new longest distance; the first long run is a baseline', () => {
    const runs = [
      run('2026-10-04', 'long', 8, 4800),
      run('2026-10-11', 'long', 8, 4700), // tie on distance
      run('2026-10-18', 'long', 10, 6000), // PR
      run('2026-10-25', 'long', 9, 5000),
      run('2026-10-26', 'base', 12, 6000), // a longer base run doesn't count against long runs
      run('2026-11-01', 'long', 11, 6600), // PR
    ]
    expect(runPRs(runs).map((p) => [p.run.date, p.measure, p.value, p.previousBest])).toEqual([
      ['2026-10-18', 'distance', 10, 8],
      ['2026-11-01', 'distance', 11, 10],
    ])
  })

  it('other runs: fastest pace among earlier same-type runs within ±5% of the distance', () => {
    const runs = [
      run('2026-10-01', 'base', 5, 2700), // 9:00 baseline
      run('2026-10-03', 'base', 5.2, 2756), // 8:50, within 5% → PR
      run('2026-10-05', 'base', 3, 1500), // 8:20, but no earlier ~3 mi run → baseline
      run('2026-10-07', 'base', 5, 2650), // 8:50 tie → not a PR
      run('2026-10-09', 'speed', 5, 2400), // 8:00, first speed run → baseline
      run('2026-10-11', 'base', 4.76, 2380), // 8:20, but 5 mi is 0.24 away, just over 5% of 4.76 (0.238) → baseline
    ]
    const prs = runPRs(runs)
    expect(prs.map((p) => [p.run.date, p.measure])).toEqual([['2026-10-03', 'pace']])
    expect(prs[0]?.value).toBeCloseTo(530, 6)
    expect(prs[0]?.previousBest).toBeCloseTo(540, 6)
  })

  it('compares distance tolerance against the new run, inclusive at exactly 5%', () => {
    const runs = [run('2026-10-01', 'recovery', 4, 2400), run('2026-10-02', 'recovery', 4.2, 2400)]
    // |4.2 − 4| = 0.2 ≤ 5% of 4.2 = 0.21 → comparable, and faster → PR
    expect(runPRs(runs).map((p) => p.run.workoutId)).toEqual([runs[1]?.workoutId])
  })

  it('sorts by date first and returns the original run objects', () => {
    const later = run('2026-10-10', 'base', 5, 2500)
    const earlier = run('2026-10-01', 'base', 5, 2700)
    const prs = runPRs([later, earlier])
    expect(prs).toHaveLength(1)
    expect(prs[0]?.run).toBe(later)
  })

  it('is empty with no runs', () => {
    expect(runPRs([])).toEqual([])
  })

  it('rejects invalid runs', () => {
    expect(() => runPRs([run('2026-10-01', 'base', 0, 100)])).toThrow(RangeError)
  })
})

describe('weeklyGoalProgress', () => {
  // Week of Mon Nov 2 – Sun Nov 8, 2026.
  it('counts distinct days in the Monday-start week', () => {
    expect(
      weeklyGoalProgress(['2026-11-01', '2026-11-02', '2026-11-04', '2026-11-04', '2026-11-08', '2026-11-09'], '2026-11-05', 3),
    ).toEqual({ done: 3, goal: 3, met: true })
  })
  it('is not met below the goal, and is 0 for an empty week', () => {
    expect(weeklyGoalProgress(['2026-11-03'], '2026-11-02', 2)).toEqual({ done: 1, goal: 2, met: false })
    expect(weeklyGoalProgress([], '2026-11-02', 1)).toEqual({ done: 0, goal: 1, met: false })
  })
  it('counts past the goal', () => {
    expect(weeklyGoalProgress(['2026-11-02', '2026-11-03'], '2026-11-08', 1)).toEqual({ done: 2, goal: 1, met: true })
  })
  it('rejects goals outside 1–7', () => {
    expect(() => weeklyGoalProgress([], '2026-11-02', 0)).toThrow(RangeError)
    expect(() => weeklyGoalProgress([], '2026-11-02', 8)).toThrow(RangeError)
    expect(() => weeklyGoalProgress([], '2026-11-02', 2.5)).toThrow(RangeError)
  })
})

describe('daysDoneInMonth', () => {
  it('counts distinct days in the same month only', () => {
    expect(daysDoneInMonth(['2026-10-31', '2026-11-01', '2026-11-01', '2026-11-30', '2026-12-01'], '2026-11-15')).toBe(2)
    expect(daysDoneInMonth([], '2026-11-15')).toBe(0)
  })
})
