import { afterEach, describe, expect, it } from 'vitest'
import {
  addBlankSet,
  addExercise,
  checkDraft,
  draftFromSets,
  DRAFT_STORAGE_KEY,
  emptyDraft,
  loadDraft,
  parseDraft,
  parseReps,
  parseWeight,
  removeExercise,
  removeSet,
  repeatLastSet,
  storeDraft,
  updateSet,
  type LiftDraft,
} from './liftDraft'

const squat = { id: 'ex-squat', name: 'Back Squat', category: 'squat' as const, tracking: 'weight' as const }
const bench = { id: 'ex-bench', name: 'Bench Press', category: 'push' as const, tracking: 'weight' as const }
const TODAY = '2026-11-04'

function draftWithSquat(): LiftDraft {
  return addExercise(emptyDraft(TODAY), squat)
}

function firstBlock(draft: LiftDraft) {
  const block = draft.blocks[0]
  if (!block) throw new Error('no block')
  return block
}

describe('editing a draft', () => {
  it('adds an exercise with one blank set', () => {
    const block = firstBlock(draftWithSquat())
    expect(block.exerciseName).toBe('Back Squat')
    expect(block.sets).toHaveLength(1)
    expect(block.sets[0]).toMatchObject({ weight: '', reps: '', warmup: false })
  })

  it('repeats the last set with a new id', () => {
    let draft = draftWithSquat()
    const block = firstBlock(draft)
    const setId = block.sets[0]!.id
    draft = updateSet(draft, block.id, setId, { weight: '225', reps: '5', warmup: true })
    draft = repeatLastSet(draft, block.id)
    const sets = firstBlock(draft).sets
    expect(sets).toHaveLength(2)
    expect(sets[1]).toMatchObject({ weight: '225', reps: '5', warmup: true })
    expect(sets[1]!.id).not.toBe(setId)
  })

  it('repeat on an exercise with no sets adds a blank one', () => {
    let draft = draftWithSquat()
    const block = firstBlock(draft)
    draft = removeSet(draft, block.id, block.sets[0]!.id)
    draft = repeatLastSet(draft, block.id)
    expect(firstBlock(draft).sets[0]).toMatchObject({ weight: '', reps: '' })
  })

  it('adds blank sets and removes sets and exercises', () => {
    let draft = draftWithSquat()
    const block = firstBlock(draft)
    draft = addBlankSet(draft, block.id)
    expect(firstBlock(draft).sets).toHaveLength(2)
    draft = removeSet(draft, block.id, firstBlock(draft).sets[0]!.id)
    expect(firstBlock(draft).sets).toHaveLength(1)
    draft = removeExercise(draft, block.id)
    expect(draft.blocks).toEqual([])
  })

  it('only changes the targeted exercise', () => {
    let draft = addExercise(draftWithSquat(), bench)
    const benchBlock = draft.blocks[1]!
    draft = repeatLastSet(draft, benchBlock.id)
    expect(firstBlock(draft).sets).toHaveLength(1)
    expect(draft.blocks[1]!.sets).toHaveLength(2)
  })
})

describe('parseWeight / parseReps', () => {
  it('parses weights, including bodyweight 0 and comma decimals', () => {
    expect(parseWeight('225')).toBe(225)
    expect(parseWeight('22.5')).toBe(22.5)
    expect(parseWeight('22,5')).toBe(22.5)
    expect(parseWeight('0')).toBe(0)
  })
  it('rejects bad weights', () => {
    expect(parseWeight('')).toBeNull()
    expect(parseWeight('-5')).toBeNull()
    expect(parseWeight('10000')).toBeNull()
    expect(parseWeight('1.234')).toBeNull()
  })
  it('parses whole reps from 1', () => {
    expect(parseReps('5')).toBe(5)
    expect(parseReps('0')).toBeNull()
    expect(parseReps('2.5')).toBeNull()
    expect(parseReps('')).toBeNull()
  })
})

describe('checkDraft', () => {
  function filled(): LiftDraft {
    let draft = addExercise(draftWithSquat(), bench)
    const [s, b] = draft.blocks
    draft = updateSet(draft, s!.id, s!.sets[0]!.id, { weight: '135', reps: '5', warmup: true })
    draft = repeatLastSet(draft, s!.id)
    draft = updateSet(draft, s!.id, draft.blocks[0]!.sets[1]!.id, { weight: '225', warmup: false })
    draft = updateSet(draft, b!.id, b!.sets[0]!.id, { weight: '185', reps: '8' })
    return draft
  }

  it('produces sets in order', () => {
    const result = checkDraft(filled(), TODAY)
    expect(result).toEqual({
      ok: true,
      exerciseCount: 2,
      sets: [
        { exerciseId: 'ex-squat', weightLb: 135, reps: 5, isWarmup: true },
        { exerciseId: 'ex-squat', weightLb: 225, reps: 5, isWarmup: false },
        { exerciseId: 'ex-bench', weightLb: 185, reps: 8, isWarmup: false },
      ],
    })
  })

  it('skips completely blank rows', () => {
    let draft = filled()
    draft = addBlankSet(draft, draft.blocks[1]!.id)
    const result = checkDraft(draft, TODAY)
    expect(result.ok && result.sets).toHaveLength(3)
  })

  it('reports half-filled rows instead of dropping them', () => {
    let draft = draftWithSquat()
    const block = firstBlock(draft)
    draft = updateSet(draft, block.id, block.sets[0]!.id, { weight: '225' })
    expect(checkDraft(draft, TODAY)).toEqual({
      ok: false,
      problems: ['Back Squat, set 1: enter weight (0 for bodyweight) and reps.'],
    })
  })

  it('needs at least one set', () => {
    expect(checkDraft(draftWithSquat(), TODAY)).toEqual({ ok: false, problems: ['Add at least one set.'] })
  })

  it('saves reps-only exercises with weight 0 and needs only reps', () => {
    const pullup = { id: 'ex-pu', name: 'Pull-up', category: 'pull' as const, tracking: 'reps' as const }
    let draft = addExercise(emptyDraft(TODAY), pullup)
    const block = firstBlock(draft)
    draft = updateSet(draft, block.id, block.sets[0]!.id, { reps: '12' })
    draft = repeatLastSet(draft, block.id)
    draft = addBlankSet(draft, block.id) // blank: skipped
    const trackingOf = (id: string): 'reps' | 'weight' => (id === 'ex-pu' ? 'reps' : 'weight')
    expect(checkDraft(draft, TODAY, trackingOf)).toEqual({
      ok: true,
      exerciseCount: 1,
      sets: [
        { exerciseId: 'ex-pu', weightLb: 0, reps: 12, isWarmup: false },
        { exerciseId: 'ex-pu', weightLb: 0, reps: 12, isWarmup: false },
      ],
    })
  })

  it('reports bad reps on reps-only exercises', () => {
    const pullup = { id: 'ex-pu', name: 'Pull-up', category: 'pull' as const, tracking: 'reps' as const }
    let draft = addExercise(emptyDraft(TODAY), pullup)
    const block = firstBlock(draft)
    draft = updateSet(draft, block.id, block.sets[0]!.id, { reps: '0' })
    expect(checkDraft(draft, TODAY, () => 'reps')).toEqual({
      ok: false,
      problems: ['Pull-up, set 1: enter reps.'],
    })
  })

  it('rejects future dates', () => {
    const draft = { ...filled(), date: '2026-11-05' }
    expect(checkDraft(draft, TODAY).ok).toBe(false)
  })
})

describe('draft storage', () => {
  afterEach(() => {
    window.localStorage.clear()
  })

  it('round-trips through localStorage', () => {
    const draft = draftWithSquat()
    storeDraft(draft)
    expect(loadDraft()).toEqual(draft)
  })

  it('removes the stored draft when empty', () => {
    storeDraft(draftWithSquat())
    storeDraft(emptyDraft(TODAY))
    expect(window.localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull()
  })

  it('treats malformed data as no draft', () => {
    expect(parseDraft('not json')).toBeNull()
    expect(parseDraft('{"date": 5, "blocks": []}')).toBeNull()
    expect(parseDraft('{"date": "2026-11-04", "blocks": [{"id": 1}]}')).toBeNull()
    expect(parseDraft(null)).toBeNull()
  })
})

describe('draftFromSets', () => {
  const squat = { exerciseId: 'sq', exerciseName: 'Back Squat' }
  const pullUp = { exerciseId: 'pu', exerciseName: 'Pull-up' }

  it('groups back-to-back sets of one exercise into a block, keeping order', () => {
    const draft = draftFromSets('2026-11-03', [
      { ...squat, weightLb: 135, reps: 5, isWarmup: true },
      { ...squat, weightLb: 182.5, reps: 5, isWarmup: false },
      { ...pullUp, weightLb: 0, reps: 8, isWarmup: false },
      { ...squat, weightLb: 155, reps: 8, isWarmup: false },
    ])
    expect(draft.date).toBe('2026-11-03')
    expect(draft.blocks.map((b) => [b.exerciseName, b.sets.length])).toEqual([
      ['Back Squat', 2],
      ['Pull-up', 1],
      ['Back Squat', 1],
    ])
    expect(draft.blocks[0]?.sets.map(({ weight, reps, warmup }) => ({ weight, reps, warmup }))).toEqual([
      { weight: '135', reps: '5', warmup: true },
      { weight: '182.5', reps: '5', warmup: false },
    ])
  })

  it('round-trips through checkDraft unchanged', () => {
    const saved = [
      { ...squat, weightLb: 182.5, reps: 5, isWarmup: false },
      { ...pullUp, weightLb: 0, reps: 8, isWarmup: false },
    ]
    const check = checkDraft(draftFromSets('2026-11-03', saved), '2026-11-04', (id) =>
      id === 'pu' ? 'reps' : 'weight',
    )
    expect(check).toEqual({
      ok: true,
      exerciseCount: 2,
      sets: saved.map(({ exerciseId, weightLb, reps, isWarmup }) => ({ exerciseId, weightLb, reps, isWarmup })),
    })
  })

  it('handles a workout with no sets', () => {
    expect(draftFromSets('2026-11-03', [])).toEqual({ date: '2026-11-03', blocks: [] })
  })
})
