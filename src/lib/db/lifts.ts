import type { ISODate } from '../dates'
import { isCategory, isTracking, normalizeName, type Category, type Exercise, type Tracking } from '../exercises'
import type { LiftSet } from '../metrics'
import { supabase } from './client'

export async function listExercises(): Promise<Exercise[]> {
  const { data, error } = await supabase
    .from('exercises')
    .select('id, name, category, tracking')
    .order('name', { ascending: true })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    category: isCategory(row.category) ? row.category : 'other',
    tracking: isTracking(row.tracking) ? row.tracking : 'weight',
  }))
}

export async function createExercise(
  name: string,
  category: Category,
  tracking: Tracking,
): Promise<Exercise> {
  const { data, error } = await supabase
    .from('exercises')
    .insert({ name: normalizeName(name), category, tracking })
    .select('id, name, category')
    .single()
  if (error) {
    if (error.code === '23505') throw new Error(`You already have an exercise called "${normalizeName(name)}".`)
    throw error
  }
  return { id: data.id, name: data.name, category, tracking }
}

export interface NewLiftSet extends LiftSet {
  exerciseId: string
}

function toSetsJson(sets: readonly NewLiftSet[]) {
  return sets.map((set) => ({
    exercise_id: set.exerciseId,
    weight_lb: set.weightLb,
    reps: set.reps,
    is_warmup: set.isWarmup,
  }))
}

/** Save a lift workout and its sets atomically, in the given order. Returns the workout id. */
export async function logLift(date: ISODate, sets: readonly NewLiftSet[]): Promise<string> {
  const { data, error } = await supabase.rpc('log_lift', {
    p_date: date,
    p_sets: toSetsJson(sets),
  })
  if (error) throw error
  return data
}

/** Replace a saved lift workout's date and all of its sets, atomically. */
export async function updateLift(
  workoutId: string,
  date: ISODate,
  sets: readonly NewLiftSet[],
): Promise<void> {
  const { error } = await supabase.rpc('update_lift', {
    p_workout_id: workoutId,
    p_date: date,
    p_sets: toSetsJson(sets),
  })
  if (error) throw error
}

export interface DatedSet extends LiftSet {
  date: ISODate
  exerciseId: string
}

/** Supabase returns at most 1000 rows per request; page well under that. */
const PAGE = 1000

/**
 * Every set you've logged, oldest first (by date, then set order). PRs need full
 * history, so the Lifting tab loads this once and filters by exercise and range locally.
 */
export async function allSets(): Promise<DatedSet[]> {
  const rows: { date: ISODate; order: number; set: DatedSet }[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('sets')
      .select('id, exercise_id, weight_lb, reps, is_warmup, set_order, workouts!inner(date)')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    for (const row of data) {
      rows.push({
        date: row.workouts.date,
        order: row.set_order,
        set: {
          date: row.workouts.date,
          exerciseId: row.exercise_id,
          weightLb: Number(row.weight_lb),
          reps: row.reps,
          isWarmup: row.is_warmup,
        },
      })
    }
    if (data.length < PAGE) break
  }
  return rows
    .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
    .map((row) => row.set)
}
