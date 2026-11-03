/**
 * The lift workout being logged. Kept as plain strings (what's typed), saved to
 * localStorage after every change so it survives the tab being closed mid-workout.
 */
import { isValidISODate, type ISODate } from './dates'
import type { Exercise, Tracking } from './exercises'
import type { NewLiftSet } from './db/lifts'

export interface DraftSet {
  id: string
  weight: string
  reps: string
  warmup: boolean
}

export interface DraftBlock {
  id: string
  exerciseId: string
  exerciseName: string
  sets: DraftSet[]
}

export interface LiftDraft {
  date: ISODate
  blocks: DraftBlock[]
}

let counter = 0
/** Unique enough for React keys within one draft. */
export function newId(): string {
  counter += 1
  return `${Date.now().toString(36)}-${counter.toString(36)}`
}

export function emptyDraft(date: ISODate): LiftDraft {
  return { date, blocks: [] }
}

export function isEmptyDraft(draft: LiftDraft): boolean {
  return draft.blocks.length === 0
}

function blankSet(): DraftSet {
  return { id: newId(), weight: '', reps: '', warmup: false }
}

function mapBlock(draft: LiftDraft, blockId: string, fn: (block: DraftBlock) => DraftBlock): LiftDraft {
  return { ...draft, blocks: draft.blocks.map((b) => (b.id === blockId ? fn(b) : b)) }
}

export function setDate(draft: LiftDraft, date: ISODate): LiftDraft {
  return { ...draft, date }
}

/** Add an exercise with one blank set. */
export function addExercise(draft: LiftDraft, exercise: Exercise): LiftDraft {
  return {
    ...draft,
    blocks: [
      ...draft.blocks,
      { id: newId(), exerciseId: exercise.id, exerciseName: exercise.name, sets: [blankSet()] },
    ],
  }
}

export function removeExercise(draft: LiftDraft, blockId: string): LiftDraft {
  return { ...draft, blocks: draft.blocks.filter((b) => b.id !== blockId) }
}

export function addBlankSet(draft: LiftDraft, blockId: string): LiftDraft {
  return mapBlock(draft, blockId, (b) => ({ ...b, sets: [...b.sets, blankSet()] }))
}

/** Duplicate the last set (weight, reps, warm-up flag). Adds a blank set if there is none. */
export function repeatLastSet(draft: LiftDraft, blockId: string): LiftDraft {
  return mapBlock(draft, blockId, (b) => {
    const last = b.sets.at(-1)
    return { ...b, sets: [...b.sets, last ? { ...last, id: newId() } : blankSet()] }
  })
}

export function updateSet(
  draft: LiftDraft,
  blockId: string,
  setId: string,
  patch: Partial<Omit<DraftSet, 'id'>>,
): LiftDraft {
  return mapBlock(draft, blockId, (b) => ({
    ...b,
    sets: b.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)),
  }))
}

export function removeSet(draft: LiftDraft, blockId: string, setId: string): LiftDraft {
  return mapBlock(draft, blockId, (b) => ({ ...b, sets: b.sets.filter((s) => s.id !== setId) }))
}

/** Weight in lb: >= 0, < 10000, up to 2 decimals. Accepts a comma decimal. */
export function parseWeight(input: string): number | null {
  const normalized = input.trim().replace(',', '.')
  if (!/^(\d{1,4}(\.\d{0,2})?|\.\d{1,2})$/.test(normalized)) return null
  return Number(normalized)
}

/** Whole reps, 1–999. */
export function parseReps(input: string): number | null {
  const trimmed = input.trim()
  if (!/^\d{1,3}$/.test(trimmed)) return null
  const reps = Number(trimmed)
  return reps >= 1 ? reps : null
}

export type DraftCheck =
  | { ok: true; sets: NewLiftSet[]; exerciseCount: number }
  | { ok: false; problems: string[] }

/**
 * Turn the draft into sets to save. Completely blank set rows are skipped;
 * half-filled rows are errors, so nothing is silently dropped.
 */
export function checkDraft(
  draft: LiftDraft,
  today: ISODate,
  /** Looked up from the catalog (not stored in the draft), so older drafts still work. */
  trackingOf: (exerciseId: string) => Tracking = () => 'weight',
): DraftCheck {
  const problems: string[] = []
  if (!isValidISODate(draft.date) || draft.date > today) {
    problems.push("Pick a date that isn't in the future.")
  }
  const sets: NewLiftSet[] = []
  let exerciseCount = 0
  for (const block of draft.blocks) {
    let blockSets = 0
    const repsOnly = trackingOf(block.exerciseId) === 'reps'
    block.sets.forEach((set, i) => {
      if (repsOnly) {
        // Reps-only exercises (pull-ups): weight is ignored and stored as 0.
        if (set.reps.trim() === '') return
        const reps = parseReps(set.reps)
        if (reps === null) {
          problems.push(`${block.exerciseName}, set ${i + 1}: enter reps.`)
          return
        }
        sets.push({ exerciseId: block.exerciseId, weightLb: 0, reps, isWarmup: set.warmup })
        blockSets += 1
        return
      }
      if (set.weight.trim() === '' && set.reps.trim() === '') return
      const weightLb = parseWeight(set.weight)
      const reps = parseReps(set.reps)
      if (weightLb === null || reps === null) {
        problems.push(`${block.exerciseName}, set ${i + 1}: enter weight (0 for bodyweight) and reps.`)
        return
      }
      sets.push({ exerciseId: block.exerciseId, weightLb, reps, isWarmup: set.warmup })
      blockSets += 1
    })
    if (blockSets > 0) exerciseCount += 1
  }
  if (problems.length === 0 && sets.length === 0) problems.push('Add at least one set.')
  return problems.length > 0 ? { ok: false, problems } : { ok: true, sets, exerciseCount }
}

// --- Persistence ---------------------------------------------------------------

export const DRAFT_STORAGE_KEY = 'boulder.liftDraft.v1'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function parseDraftSet(value: unknown): DraftSet | null {
  if (!isRecord(value)) return null
  const { id, weight, reps, warmup } = value
  if (typeof id !== 'string' || typeof weight !== 'string' || typeof reps !== 'string') return null
  if (typeof warmup !== 'boolean') return null
  return { id, weight, reps, warmup }
}

function parseDraftBlock(value: unknown): DraftBlock | null {
  if (!isRecord(value)) return null
  const { id, exerciseId, exerciseName, sets } = value
  if (typeof id !== 'string' || typeof exerciseId !== 'string' || typeof exerciseName !== 'string') {
    return null
  }
  if (!Array.isArray(sets)) return null
  const parsed = sets.map(parseDraftSet)
  if (parsed.some((s) => s === null)) return null
  return { id, exerciseId, exerciseName, sets: parsed.filter((s): s is DraftSet => s !== null) }
}

/** Parse stored JSON defensively; anything malformed is treated as no draft. */
export function parseDraft(json: string | null): LiftDraft | null {
  if (!json) return null
  let value: unknown
  try {
    value = JSON.parse(json)
  } catch {
    return null
  }
  if (!isRecord(value) || typeof value.date !== 'string' || !Array.isArray(value.blocks)) return null
  const blocks = value.blocks.map(parseDraftBlock)
  if (blocks.some((b) => b === null)) return null
  return { date: value.date, blocks: blocks.filter((b): b is DraftBlock => b !== null) }
}

export function loadDraft(): LiftDraft | null {
  try {
    return parseDraft(window.localStorage.getItem(DRAFT_STORAGE_KEY))
  } catch {
    return null // storage unavailable (private mode, etc.)
  }
}

export function storeDraft(draft: LiftDraft | null): void {
  try {
    if (draft === null || isEmptyDraft(draft)) window.localStorage.removeItem(DRAFT_STORAGE_KEY)
    else window.localStorage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(draft))
  } catch {
    // Storage full or unavailable: the draft just won't survive a reload.
  }
}
