import type { ISODate } from '../dates'
import { isRunKind, type RunKind } from '../runKinds'
import { supabase } from './client'

export interface Run {
  workoutId: string
  date: ISODate
  distanceMi: number
  durationS: number
  kind: RunKind
}

export interface NewRun {
  date: ISODate
  distanceMi: number
  durationS: number
  kind: RunKind
}

/** Save a run (workout + run rows) atomically. Returns the new workout id. */
export async function logRun(run: NewRun): Promise<string> {
  const { data, error } = await supabase.rpc('log_run', {
    p_date: run.date,
    p_distance_mi: run.distanceMi,
    p_duration_s: run.durationS,
    p_run_kind: run.kind,
  })
  if (error) throw error
  return data
}

const RUN_SELECT = 'id, date, created_at, runs!inner(distance_mi, duration_s, run_kind)' as const

function baseQuery() {
  return supabase
    .from('workouts')
    .select(RUN_SELECT)
    .eq('type', 'run')
}

type RunRow = {
  id: string
  date: string
  runs: { distance_mi: number; duration_s: number; run_kind: string } | null
}

function toRun(row: RunRow): Run {
  const run = row.runs
  if (!run || !isRunKind(run.run_kind)) {
    throw new Error(`Workout ${row.id} has missing or invalid run data`)
  }
  return {
    workoutId: row.id,
    date: row.date,
    distanceMi: Number(run.distance_mi),
    durationS: run.duration_s,
    kind: run.run_kind,
  }
}

/** Runs with `from <= date <= to`, oldest first. Omit `from` for all time. */
export async function runsBetween(from: ISODate | null, to: ISODate): Promise<Run[]> {
  let query = baseQuery().lte('date', to)
  if (from) query = query.gte('date', from)
  const { data, error } = await query.order('date', { ascending: true })
  if (error) throw error
  return data.map(toRun)
}
