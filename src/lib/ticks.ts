/** Clean pace-axis ticks (whole 15s / 30s / 1m / 2m / 5m steps), at most `maxTicks`. */
const PACE_STEPS = [15, 30, 60, 120, 300]

export function paceTicks(min: number, max: number, maxTicks = 5): number[] {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    throw new RangeError(`Invalid pace range ${min}..${max}`)
  }
  for (const step of PACE_STEPS) {
    const lo = Math.floor(min / step) * step
    const hi = Math.ceil(max / step) * step
    // Always show at least one step of headroom so a flat series isn't on the edge.
    const top = hi === lo ? hi + step : hi
    const count = Math.round((top - lo) / step) + 1
    if (count <= maxTicks || step === PACE_STEPS.at(-1)) {
      return Array.from({ length: count }, (_, i) => lo + i * step)
    }
  }
  return [min, max]
}

/**
 * Y-axis ticks for minutes (screen time), from 0 to just past `max`, on round
 * steps: every 30 minutes up to 1.5 hours, hourly up to 6 hours, then every 2 hours.
 */
export function minuteTicks(max: number): number[] {
  if (!Number.isFinite(max) || max < 0) throw new RangeError(`max must be >= 0, got ${max}`)
  const step = max <= 90 ? 30 : max <= 360 ? 60 : 120
  const top = Math.max(step, Math.ceil(max / step) * step)
  const ticks: number[] = []
  for (let t = 0; t <= top; t += step) ticks.push(t)
  return ticks
}

/**
 * Up to `max` items spread evenly from first to last (both always included),
 * for x-axis labels that never crowd each other.
 */
export function evenTicks<T>(items: readonly T[], max: number): T[] {
  if (!Number.isInteger(max) || max < 1) throw new RangeError(`max must be a positive integer, got ${max}`)
  if (items.length <= max) return [...items]
  if (max === 1) return items.slice(0, 1)
  const picked: T[] = []
  for (let k = 0; k < max; k++) {
    const item = items[Math.round((k * (items.length - 1)) / (max - 1))]
    if (item !== undefined) picked.push(item)
  }
  return picked
}
