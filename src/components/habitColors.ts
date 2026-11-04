// Fixed order (dataviz palette slots 1–2, validated on the stone-900 card).
// Position or a label always goes with the color, so it never carries identity alone.
const HABIT_COLORS = ['#3987e5', '#d95926'] as const

/** Color for the habit at `index` in display order. */
export function habitColor(index: number): string {
  return HABIT_COLORS[index % HABIT_COLORS.length] ?? HABIT_COLORS[0]
}
