import type { ISODate } from '../dates'
import { supabase } from './client'

export type HabitKind = 'stretch' | 'habit'
/** 'check' = done or not each day; 'minutes' = an amount each day (screen time). */
export type HabitTracking = 'check' | 'minutes'

export interface Habit {
  id: string
  name: string
  tracking: HabitTracking
  /** Days per week, 1–7 (stretching). */
  weeklyGoal: number
}

/** Habits in use on one tab (archived ones left out), in display order. */
export async function listHabits(kind: HabitKind): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('id, name, tracking, weekly_goal')
    .eq('kind', kind)
    .is('archived_at', null)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map((row) => ({
    id: row.id,
    name: row.name,
    tracking: row.tracking === 'minutes' ? 'minutes' : 'check',
    weeklyGoal: row.weekly_goal,
  }))
}

function friendlyNameError(error: { code?: string }, name: string): Error | null {
  return error.code === '23505' ? new Error(`You already have a habit called "${name}".`) : null
}

/** Add a check-off habit to the Habits tab. */
export async function createHabit(name: string): Promise<Habit> {
  const trimmed = name.trim()
  const { data, error } = await supabase
    .from('habits')
    .insert({ kind: 'habit', name: trimmed, tracking: 'check' })
    .select('id, name, weekly_goal')
    .single()
  if (error) throw friendlyNameError(error, trimmed) ?? error
  return { id: data.id, name: data.name, tracking: 'check', weeklyGoal: data.weekly_goal }
}

export async function renameHabit(habitId: string, name: string): Promise<void> {
  const trimmed = name.trim()
  const { error } = await supabase.from('habits').update({ name: trimmed }).eq('id', habitId)
  if (error) throw friendlyNameError(error, trimmed) ?? error
}

/** Hide a habit from Log and Progress. Its history is kept. */
export async function archiveHabit(habitId: string): Promise<void> {
  const { error } = await supabase
    .from('habits')
    .update({ archived_at: new Date().toISOString() })
    .eq('id', habitId)
  if (error) throw error
}

export interface HabitCheck {
  habitId: string
  date: ISODate
  /** Minutes habits only; null for check-offs. */
  minutes: number | null
}

const CHECK_SELECT = 'habit_id, date, minutes' as const

function toCheck(row: { habit_id: string; date: string; minutes: number | null }): HabitCheck {
  return { habitId: row.habit_id, date: row.date, minutes: row.minutes }
}

/** Entries for each habit with `from <= date <= to`. */
export async function checksBetween(
  habitIds: readonly string[],
  from: ISODate,
  to: ISODate,
): Promise<HabitCheck[]> {
  if (habitIds.length === 0) return []
  const { data, error } = await supabase
    .from('habit_checks')
    .select(CHECK_SELECT)
    .in('habit_id', habitIds)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return data.map(toCheck)
}

/** Mark a habit done or not done on a day. Safe to repeat. */
export async function setCheck(habitId: string, date: ISODate, done: boolean): Promise<void> {
  const { error } = done
    ? await supabase
        .from('habit_checks')
        .upsert({ habit_id: habitId, date }, { onConflict: 'habit_id,date', ignoreDuplicates: true })
    : await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('date', date)
  if (error) throw error
}

/** Record minutes for a day (replacing any earlier value), or clear it with null. */
export async function setMinutes(habitId: string, date: ISODate, minutes: number | null): Promise<void> {
  const { error } =
    minutes === null
      ? await supabase.from('habit_checks').delete().eq('habit_id', habitId).eq('date', date)
      : await supabase
          .from('habit_checks')
          .upsert({ habit_id: habitId, date, minutes }, { onConflict: 'habit_id,date' })
  if (error) throw error
}

export async function setWeeklyGoal(habitId: string, weeklyGoal: number): Promise<void> {
  const { error } = await supabase.from('habits').update({ weekly_goal: weeklyGoal }).eq('id', habitId)
  if (error) throw error
}

/** Supabase returns at most 1000 rows per request; page well under that. */
const PAGE = 1000

/** Every entry for these habits, oldest first. Streaks need full history. */
export async function allChecks(habitIds: readonly string[]): Promise<HabitCheck[]> {
  if (habitIds.length === 0) return []
  const checks: HabitCheck[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('habit_checks')
      .select(CHECK_SELECT)
      .in('habit_id', habitIds)
      .order('date', { ascending: true })
      .order('habit_id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    checks.push(...data.map(toCheck))
    if (data.length < PAGE) break
  }
  return checks
}
