import type { ISODate } from '../dates'
import { isRunKind, type RunKind } from '../runKinds'
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
