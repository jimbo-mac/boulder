import type { ISODate } from '../dates'
import { isRunKind, type RunKind } from '../runKinds'
import type { NewRun } from './runs'
import { supabase } from './client'

export interface RunEntry {
  type: 'run'
  workoutId: string
  date: ISODate
  distanceMi: number
  durationS: number
  kind: RunKind
}

export interface LiftEntry {
  type: 'lift'
  workoutId: string
  date: ISODate
  /** Exercise names in the order they were done. */
  exercises: string[]
  sets: { weightLb: number; reps: number; isWarmup: boolean }[]
}

export type HistoryEntry = RunEntry | LiftEntry

const HISTORY_SELECT =
  'id, date, type, created_at, runs(distance_mi, duration_s, run_kind), sets(set_order, weight_lb, reps, is_warmup, exercises(name))' as const

/** All workouts, newest first. `offset`/`limit` page through History. */
export async function listHistory(offset: number, limit: number): Promise<HistoryEntry[]> {
  const { data, error } = await supabase
    .from('workouts')
    .select(HISTORY_SELECT)
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)
  if (error) throw error

  return data.flatMap((row): HistoryEntry[] => {
    if (row.type === 'run') {
      const run = row.runs
      if (!run || !isRunKind(run.run_kind)) return []
      return [
        {
          type: 'run',
          workoutId: row.id,
          date: row.date,
          distanceMi: Number(run.distance_mi),
          durationS: run.duration_s,
          kind: run.run_kind,
        },
      ]
    }
    const sets = [...row.sets].sort((a, b) => a.set_order - b.set_order)
    const exercises: string[] = []
    for (const set of sets) {
      const name = set.exercises?.name
      if (name && !exercises.includes(name)) exercises.push(name)
    }
    return [
      {
        type: 'lift',
        workoutId: row.id,
        date: row.date,
        exercises,
        sets: sets.map((s) => ({ weightLb: Number(s.weight_lb), reps: s.reps, isWarmup: s.is_warmup })),
      },
    ]
  })
}

export interface SavedSet {
  exerciseId: string
  exerciseName: string
  weightLb: number
  reps: number
  isWarmup: boolean
}

/** One saved workout, in the shape the Log forms edit. */
export type WorkoutDetail =
  | { type: 'run'; workoutId: string; run: NewRun }
  | { type: 'lift'; workoutId: string; date: ISODate; sets: SavedSet[] }

/** Load one workout for editing. Returns null if it doesn't exist (or isn't yours). */
export async function getWorkout(workoutId: string): Promise<WorkoutDetail | null> {
  const { data, error } = await supabase
    .from('workouts')
    .select(
      'id, date, type, runs(distance_mi, duration_s, run_kind), sets(set_order, weight_lb, reps, is_warmup, exercise_id, exercises(name))',
    )
    .eq('id', workoutId)
    .maybeSingle()
  if (error) throw error
  if (!data) return null

  if (data.type === 'run') {
    const run = data.runs
    if (!run || !isRunKind(run.run_kind)) return null
    return {
      type: 'run',
      workoutId: data.id,
      run: {
        date: data.date,
        distanceMi: Number(run.distance_mi),
        durationS: run.duration_s,
        kind: run.run_kind,
      },
    }
  }
  return {
    type: 'lift',
    workoutId: data.id,
    date: data.date,
    sets: [...data.sets]
      .sort((a, b) => a.set_order - b.set_order)
      .map((s) => ({
        exerciseId: s.exercise_id,
        exerciseName: s.exercises?.name ?? 'Exercise',
        weightLb: Number(s.weight_lb),
        reps: s.reps,
        isWarmup: s.is_warmup,
      })),
  }
}

/** Delete a workout; its run or sets are deleted with it. */
export async function deleteWorkout(workoutId: string): Promise<void> {
  const { data, error } = await supabase.from('workouts').delete().eq('id', workoutId).select('id')
  if (error) throw error
  if (data.length === 0) throw new Error('Workout not found.')
}
