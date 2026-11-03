import type { ISODate } from '../dates'
import { supabase } from './client'

export interface Settings {
  goalRaceName: string | null
  goalRaceDate: ISODate | null
  goalDistanceMi: number | null
  goalTimeS: number | null
}

export const EMPTY_SETTINGS: Settings = {
  goalRaceName: null,
  goalRaceDate: null,
  goalDistanceMi: null,
  goalTimeS: null,
}

/** The user's settings; defaults (all empty) if they've never saved any. */
export async function getSettings(): Promise<Settings> {
  const { data, error } = await supabase
    .from('settings')
    .select('goal_race_name, goal_race_date, goal_distance_mi, goal_time_s')
    .maybeSingle()
  if (error) throw error
  if (!data) return EMPTY_SETTINGS
  return {
    goalRaceName: data.goal_race_name,
    goalRaceDate: data.goal_race_date,
    goalDistanceMi: data.goal_distance_mi === null ? null : Number(data.goal_distance_mi),
    goalTimeS: data.goal_time_s,
  }
}

/** Create or replace the user's settings row (user_id defaults to auth.uid()). */
export async function saveSettings(settings: Settings): Promise<void> {
  const { error } = await supabase.from('settings').upsert(
    {
      goal_race_name: settings.goalRaceName,
      goal_race_date: settings.goalRaceDate,
      goal_distance_mi: settings.goalDistanceMi,
      goal_time_s: settings.goalTimeS,
    },
    { onConflict: 'user_id' },
  )
  if (error) throw error
}
