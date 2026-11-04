import type { ISODate } from '../dates'
import { supabase } from './client'

export type HabitKind = 'stretch' | 'habit'

export interface Habit {
  id: string
  name: string
  /** Days per week, 1–7. */
  weeklyGoal: number
}

/** Habits shown on one tab, in display order. */
export async function listHabits(kind: HabitKind): Promise<Habit[]> {
  const { data, error } = await supabase
    .from('habits')
    .select('id, name, weekly_goal')
    .eq('kind', kind)
    .order('sort_order', { ascending: true })
    .order('created_at', { ascending: true })
  if (error) throw error
  return data.map((row) => ({ id: row.id, name: row.name, weeklyGoal: row.weekly_goal }))
}

export interface HabitCheck {
  habitId: string
  date: ISODate
}

/** Days each habit was done with `from <= date <= to`. */
export async function checksBetween(
  habitIds: readonly string[],
  from: ISODate,
  to: ISODate,
): Promise<HabitCheck[]> {
  if (habitIds.length === 0) return []
  const { data, error } = await supabase
    .from('habit_checks')
    .select('habit_id, date')
    .in('habit_id', habitIds)
    .gte('date', from)
    .lte('date', to)
  if (error) throw error
  return data.map((row) => ({ habitId: row.habit_id, date: row.date }))
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

export async function setWeeklyGoal(habitId: string, weeklyGoal: number): Promise<void> {
  const { error } = await supabase.from('habits').update({ weekly_goal: weeklyGoal }).eq('id', habitId)
  if (error) throw error
}

/** Supabase returns at most 1000 rows per request; page well under that. */
const PAGE = 1000

/** Every check for these habits, oldest first. Streaks need full history. */
export async function allChecks(habitIds: readonly string[]): Promise<HabitCheck[]> {
  if (habitIds.length === 0) return []
  const checks: HabitCheck[] = []
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase
      .from('habit_checks')
      .select('habit_id, date')
      .in('habit_id', habitIds)
      .order('date', { ascending: true })
      .order('habit_id', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (error) throw error
    checks.push(...data.map((row) => ({ habitId: row.habit_id, date: row.date })))
    if (data.length < PAGE) break
  }
  return checks
}
