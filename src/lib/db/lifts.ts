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

/** Save a lift workout and its sets atomically, in the given order. Returns the workout id. */
export async function logLift(date: ISODate, sets: readonly NewLiftSet[]): Promise<string> {
  const { data, error } = await supabase.rpc('log_lift', {
    p_date: date,
    p_sets: sets.map((set) => ({
      exercise_id: set.exerciseId,
      weight_lb: set.weightLb,
      reps: set.reps,
      is_warmup: set.isWarmup,
    })),
  })
  if (error) throw error
  return data
}

export interface DatedSet extends LiftSet {
  date: ISODate
}

/** All sets of one exercise with `from <= date <= to` (omit `from` for all time), oldest first. */
export async function setsForExercise(
  exerciseId: string,
  from: ISODate | null,
  to: ISODate,
): Promise<DatedSet[]> {
  let query = supabase
    .from('sets')
    .select('weight_lb, reps, is_warmup, set_order, workouts!inner(date)')
    .eq('exercise_id', exerciseId)
    .lte('workouts.date', to)
  if (from) query = query.gte('workouts.date', from)
  const { data, error } = await query
  if (error) throw error
  return data
    .map((row) => ({
      date: row.workouts.date,
      order: row.set_order,
      weightLb: Number(row.weight_lb),
      reps: row.reps,
      isWarmup: row.is_warmup,
    }))
    .sort((a, b) => (a.date === b.date ? a.order - b.order : a.date < b.date ? -1 : 1))
    .map(({ order: _order, ...set }) => set)
}
