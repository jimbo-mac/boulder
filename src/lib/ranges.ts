import { addDays, weekStart, type ISODate } from './dates'

/**
 * Time ranges on the Progress screen, in whole Mon–Sun weeks so weekly charts line up.
 * Short for now while there's little data; longer ranges (6m, 1y, All) can come back later.
 */
export const RANGES: readonly { value: RangeValue; label: string; weeks: number | null }[] = [
  { value: '1w', label: '1w', weeks: 1 },
  { value: '1m', label: '1m', weeks: 4 },
  { value: '3m', label: '3m', weeks: 13 },
]

export type RangeValue = '1w' | '1m' | '3m'

export const DEFAULT_RANGE: RangeValue = '1m'

/**
 * First day of the range: the Monday `weeks - 1` weeks before this week's Monday,
 * so the range is exactly `weeks` whole weeks including the current one.
 * Returns null for a range with no lower bound (weeks: null, e.g. a future "All").
 */
export function rangeStart(range: RangeValue, today: ISODate): ISODate | null {
  const weeks = RANGES.find((r) => r.value === range)?.weeks ?? null
  if (weeks === null) return null
  return addDays(weekStart(today), -7 * (weeks - 1))
}
