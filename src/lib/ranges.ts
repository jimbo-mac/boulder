import { addDays, weekStart, type ISODate } from './dates'

/** Time ranges on the Progress screen. Week-based ranges count whole Mon–Sun weeks. */
export const RANGES = [
  { value: '4w', label: '4w', weeks: 4 },
  { value: '12w', label: '12w', weeks: 12 },
  { value: '6m', label: '6m', weeks: 26 },
  { value: '1y', label: '1y', weeks: 52 },
  { value: 'all', label: 'All', weeks: null },
] as const

export type RangeValue = (typeof RANGES)[number]['value']

/**
 * First day of the range: the Monday `weeks - 1` weeks before this week's Monday,
 * so the range is exactly `weeks` whole weeks including the current one.
 * Returns null for "all" (no lower bound).
 */
export function rangeStart(range: RangeValue, today: ISODate): ISODate | null {
  const weeks = RANGES.find((r) => r.value === range)?.weeks ?? null
  if (weeks === null) return null
  return addDays(weekStart(today), -7 * (weeks - 1))
}
