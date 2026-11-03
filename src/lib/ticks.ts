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
